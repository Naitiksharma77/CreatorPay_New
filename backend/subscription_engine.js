/**
 * Takora — Clean Monthly Subscription & Razorpay AutoPay Engine
 * Dynamically creates/resolves monthly plans and AutoPay subscriptions
 * using only RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
 */

const crypto = require("crypto");
const {
  SUBSCRIPTION_PLANS,
  PLAN_TIER_ORDER,
  getRazorpayKeySecret,
  getRazorpayConfigStatus,
  getRazorpayInstance,
  resolveRazorpayPlanId,
  clearResolvedPlanCache
} = require("./payment_config");

function formatRazorpayError(err, fallback = "Unable to communicate with Razorpay.") {
  if (!err) return fallback;
  if (err.error && typeof err.error === "object") {
    return (
      err.error.description ||
      err.error.reason ||
      err.error.code ||
      err.message ||
      fallback
    );
  }
  return err.message || fallback;
}

/**
 * Creates a live Razorpay Monthly Subscription with AutoPay support
 * purely from RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET and the selected planCode.
 */
async function createRazorpayMonthlySubscription({
  planCode,
  user,
  existingSub = null,
  existingEntitlements = null
}) {
  const cleanPlanCode = String(planCode || "").trim().toLowerCase();
  const targetPlan = SUBSCRIPTION_PLANS[cleanPlanCode];
  if (!targetPlan) {
    const err = new Error("Please select a valid subscription plan: basic, pro, or premium.");
    err.statusCode = 400;
    throw err;
  }

  const rzpStatus = getRazorpayConfigStatus();
  const rzp = getRazorpayInstance();
  if (!rzpStatus.configured || !rzp) {
    const err = new Error(
      `Razorpay credentials missing (${rzpStatus.missingEnvVars.join(", ")}).`
    );
    err.statusCode = 503;
    err.code = "RAZORPAY_NOT_CONFIGURED";
    err.missingEnvVars = rzpStatus.missingEnvVars;
    throw err;
  }

  if (!user || !user.id) {
    const err = new Error("Unable to initialize visitor session for subscription checkout.");
    err.statusCode = 401;
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  const hasRealEmail = Boolean(
    user.email && !String(user.email).endsWith("@member.takora.local")
  );
  const safeUserEmail = hasRealEmail ? String(user.email) : "";

  const upgradeFromId =
    existingSub &&
    existingEntitlements &&
    existingEntitlements.hasActiveSubscription &&
    existingSub.razorpay_subscription_id
      ? String(existingSub.razorpay_subscription_id)
      : "";

  // Razorpay Subscriptions + NPCI UPI AutoPay allow up to 30 years (360 monthly cycles)
  // so subscriptions renew continuously every month until explicitly cancelled.
  const MAX_MONTHLY_AUTOPAY_CYCLES = 360;
  const FALLBACK_MONTHLY_AUTOPAY_CYCLES = 120;

  const buildPayload = (planIdValue, customerIdValue = "", totalCount = MAX_MONTHLY_AUTOPAY_CYCLES) => {
    const payload = {
      plan_id: planIdValue,
      customer_notify: 1,
      total_count: totalCount,
      notes: {
        userId: String(user.id),
        userEmail: safeUserEmail,
        planCode: targetPlan.code,
        app: "takora",
        upgradeFromSubscriptionId: upgradeFromId
      }
    };
    if (customerIdValue) {
      payload.customer_id = customerIdValue;
    }
    return payload;
  };

  let rzpCustomerId = String((user && user.razorpay_customer_id) || "").trim();
  if (!rzpCustomerId && hasRealEmail) {
    try {
      const custReq = {
        name: user.name && user.name !== "Takora Visitor" ? user.name : "Takora Member",
        email: safeUserEmail,
        fail_existing: 0,
        notes: {
          userId: String(user.id),
          app: "takora"
        }
      };
      if (user.phone) custReq.contact = user.phone;
      const customer = await rzp.customers.create(custReq);
      if (customer && customer.id) {
        rzpCustomerId = customer.id;
      }
    } catch (custErr) {
      console.warn("[SubscriptionEngine] Customer create skipped:", formatRazorpayError(custErr));
      rzpCustomerId = "";
    }
  }

  let rzpPlanId;
  try {
    rzpPlanId = await resolveRazorpayPlanId(cleanPlanCode);
  } catch (planErr) {
    const msg = formatRazorpayError(planErr, `Unable to resolve Razorpay monthly plan for ${targetPlan.name}.`);
    const isAuthErr = Number(planErr && planErr.statusCode) === 401 || /auth/i.test(msg);
    const wrapped = new Error(isAuthErr ? `Razorpay Authentication Error: ${msg}` : `Razorpay Plan Error: ${msg}`);
    wrapped.statusCode = isAuthErr ? 502 : (Number(planErr && planErr.statusCode) || 502);
    wrapped.code = isAuthErr ? "RAZORPAY_AUTH_FAILED" : "PLAN_ID_NOT_FOUND";
    throw wrapped;
  }

  let rzpSub = null;
  try {
    rzpSub = await rzp.subscriptions.create(
      buildPayload(rzpPlanId, rzpCustomerId, MAX_MONTHLY_AUTOPAY_CYCLES)
    );
  } catch (firstErr) {
    console.warn(
      `[SubscriptionEngine] Primary subscription create failed (${cleanPlanCode}):`,
      formatRazorpayError(firstErr)
    );

    const firstMsg = formatRazorpayError(firstErr, "");
    if (Number(firstErr && firstErr.statusCode) === 401 || /authentication/i.test(firstMsg)) {
      const authWrapped = new Error(`Razorpay Authentication Failed: ${firstMsg || "Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."}`);
      authWrapped.statusCode = 502;
      authWrapped.code = "RAZORPAY_AUTH_FAILED";
      throw authWrapped;
    }

    // Retry cleanly: if total_count triggered a limit error, fall back to 120 cycles (10 years);
    // otherwise drop possibly-stale customer_id AND resolve/create fresh plan if plan_id failed.
    const isTotalCountLimitErr = /total_count|end_at|cycle|duration|count/i.test(firstMsg);
    if (!isTotalCountLimitErr) {
      clearResolvedPlanCache(cleanPlanCode);
      rzpCustomerId = "";
    }
    try {
      if (!isTotalCountLimitErr) {
        rzpPlanId = await resolveRazorpayPlanId(cleanPlanCode, { forceCreate: true });
      }
      rzpSub = await rzp.subscriptions.create(
        buildPayload(
          rzpPlanId,
          isTotalCountLimitErr ? rzpCustomerId : "",
          isTotalCountLimitErr ? FALLBACK_MONTHLY_AUTOPAY_CYCLES : MAX_MONTHLY_AUTOPAY_CYCLES
        )
      );
    } catch (retryErr) {
      const msg = formatRazorpayError(retryErr, "Unable to create Razorpay subscription.");
      const wrapped = new Error(`Razorpay Subscription Creation Failed: ${msg}`);
      wrapped.statusCode = 502;
      wrapped.code = "SUBSCRIPTION_CREATE_FAILED";
      throw wrapped;
    }
  }

  if (!rzpSub || !rzpSub.id) {
    const err = new Error("Razorpay did not return a valid subscription ID.");
    err.statusCode = 502;
    err.code = "SUBSCRIPTION_CREATE_FAILED";
    throw err;
  }

  return {
    keyId: rzpStatus.keyId,
    plan: targetPlan,
    rzpPlanId,
    rzpCustomerId,
    rzpSub
  };
}

function verifySubscriptionHmacSignature(paymentId, subscriptionId, providedSignature) {
  const secret = getRazorpayKeySecret();
  if (!secret || !paymentId || !subscriptionId || !providedSignature) {
    return false;
  }
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${String(paymentId).trim()}|${String(subscriptionId).trim()}`)
    .digest("hex");

  const sigA = Buffer.from(generatedSignature, "utf8");
  const sigB = Buffer.from(String(providedSignature).trim(), "utf8");
  return sigA.length === sigB.length && crypto.timingSafeEqual(sigA, sigB);
}

module.exports = {
  SUBSCRIPTION_PLANS,
  PLAN_TIER_ORDER,
  formatRazorpayError,
  createRazorpayMonthlySubscription,
  verifySubscriptionHmacSignature
};

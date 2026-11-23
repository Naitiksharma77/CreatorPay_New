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

  const isGuestPlaceholder = String((user && user.email) || "").endsWith("@member.takora.local");
  const upgradeFromId =
    existingSub &&
    existingEntitlements &&
    existingEntitlements.hasActiveSubscription &&
    existingSub.razorpay_subscription_id
      ? String(existingSub.razorpay_subscription_id)
      : "";

  const buildPayload = (planIdValue, customerIdValue = "") => {
    const payload = {
      plan_id: planIdValue,
      customer_notify: 1,
      total_count: 120,
      notes: {
        userId: String(user.id),
        userEmail: isGuestPlaceholder ? "" : String(user.email || ""),
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

  // Optional Razorpay customer creation only for real named/emailed accounts
  let rzpCustomerId = String((user && user.razorpay_customer_id) || "").trim();
  if (!rzpCustomerId && !isGuestPlaceholder && user && user.email) {
    try {
      const custReq = {
        name: user.name || "Takora Member",
        email: user.email,
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

  // Resolve or auto-create the Razorpay monthly plan via Key ID & Key Secret
  let rzpPlanId = await resolveRazorpayPlanId(cleanPlanCode);
  let rzpSub = null;

  try {
    rzpSub = await rzp.subscriptions.create(buildPayload(rzpPlanId, rzpCustomerId));
  } catch (firstErr) {
    console.warn(
      `[SubscriptionEngine] Primary subscription create failed (${cleanPlanCode}):`,
      formatRazorpayError(firstErr)
    );

    // Retry cleanly: drop possibly-stale customer_id AND force-create a fresh monthly plan
    clearResolvedPlanCache(cleanPlanCode);
    rzpCustomerId = "";
    try {
      // First try existing resolved plan without customer_id if customer_id might have been invalid
      rzpPlanId = await resolveRazorpayPlanId(cleanPlanCode, { forceCreate: true });
      rzpSub = await rzp.subscriptions.create(buildPayload(rzpPlanId, ""));
    } catch (retryErr) {
      const msg = formatRazorpayError(retryErr, "Unable to create Razorpay subscription.");
      const wrapped = new Error(`Razorpay Subscription Error: ${msg}`);
      wrapped.statusCode = 502;
      throw wrapped;
    }
  }

  if (!rzpSub || !rzpSub.id) {
    const err = new Error("Razorpay did not return a valid subscription ID.");
    err.statusCode = 502;
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

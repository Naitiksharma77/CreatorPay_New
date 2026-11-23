require("dotenv").config();

const Razorpay = require("razorpay");

const SUBSCRIPTION_PLANS = {
  basic: {
    code: "basic",
    name: "Basic",
    priceInr: 9,
    amountPaise: 900,
    interval: "month",
    badge: "Starter",
    tagline: "Chat & full profile access",
    description: "Takora Basic Monthly Membership - Chat & Profile Access",
    features: {
      profiles: true,
      chat: true,
      voice_call: false,
      video_call: false
    },
    featureList: [
      { label: "Browse all creator profiles", included: true },
      { label: "Unlimited 1-on-1 Chat access", included: true },
      { label: "Voice / Phone Call access", included: false },
      { label: "HD Video Call access", included: false }
    ]
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceInr: 29,
    amountPaise: 2900,
    interval: "month",
    badge: "Most Popular",
    tagline: "Chat + Audio & Phone Calls",
    description: "Takora Pro Monthly Membership - Chat & Voice Call Access",
    features: {
      profiles: true,
      chat: true,
      voice_call: true,
      video_call: false
    },
    featureList: [
      { label: "Browse all creator profiles", included: true },
      { label: "Unlimited 1-on-1 Chat access", included: true },
      { label: "Voice / Phone Call access", included: true },
      { label: "HD Video Call access", included: false }
    ]
  },
  premium: {
    code: "premium",
    name: "Premium",
    priceInr: 99,
    amountPaise: 9900,
    interval: "month",
    badge: "All Access",
    tagline: "Chat + Voice Calls + Video Calls",
    description: "Takora Premium Monthly Membership - Full Chat, Voice & Video Access",
    features: {
      profiles: true,
      chat: true,
      voice_call: true,
      video_call: true
    },
    featureList: [
      { label: "Browse all creator profiles", included: true },
      { label: "Unlimited 1-on-1 Chat access", included: true },
      { label: "Voice / Phone Call access", included: true },
      { label: "HD Video Call access", included: true }
    ]
  }
};

const PLAN_TIER_ORDER = {
  basic: 1,
  pro: 2,
  premium: 3
};

function getRazorpayKeyId() {
  return String(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || "").trim();
}

function getRazorpayKeySecret() {
  return String(process.env.RAZORPAY_KEY_SECRET || "").trim();
}

function getRazorpayWebhookSecret() {
  return String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
}

function getRazorpayConfigStatus() {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const webhookSecret = getRazorpayWebhookSecret();

  const missingEnvVars = [];
  if (!keyId) missingEnvVars.push("RAZORPAY_KEY_ID");
  if (!keySecret) missingEnvVars.push("RAZORPAY_KEY_SECRET");

  return {
    configured: Boolean(keyId && keySecret),
    webhookConfigured: Boolean(webhookSecret),
    keyId,
    missingEnvVars
  };
}

let cachedRazorpayClient = null;
let cachedKeyPair = "";

function getRazorpayInstance() {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return null;
  }
  const pair = `${keyId}:${keySecret}`;
  if (!cachedRazorpayClient || cachedKeyPair !== pair) {
    cachedRazorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    cachedKeyPair = pair;
  }
  return cachedRazorpayClient;
}

const resolvedPlanIdCache = {};

function clearResolvedPlanCache(planCode) {
  if (planCode) {
    delete resolvedPlanIdCache[planCode];
  } else {
    Object.keys(resolvedPlanIdCache).forEach((k) => delete resolvedPlanIdCache[k]);
  }
}

async function resolveRazorpayPlanId(planCode, { forceCreate = false } = {}) {
  const plan = SUBSCRIPTION_PLANS[planCode];
  if (!plan) {
    throw new Error(`Invalid subscription plan code: ${planCode}`);
  }

  if (!forceCreate && resolvedPlanIdCache[planCode]) {
    return resolvedPlanIdCache[planCode];
  }

  const rzp = getRazorpayInstance();
  if (!rzp) {
    throw new Error("Razorpay credentials are not configured.");
  }

  // Locate an existing monthly Razorpay plan matching this package's exact amount and Takora tag
  if (!forceCreate) {
    try {
      const existingPlans = await rzp.plans.all({ count: 100 });
      const items = Array.isArray(existingPlans && existingPlans.items) ? existingPlans.items : [];
      const match = items.find((p) => {
        const item = p && p.item ? p.item : {};
        const notes = (p && p.notes) || {};
        return (
          p.period === "monthly" &&
          Number(p.interval) === 1 &&
          Number(item.amount) === plan.amountPaise &&
          item.currency === "INR" &&
          (notes.plan_code === planCode || String(item.name || "").toLowerCase().includes(`takora ${planCode}`))
        );
      });
      if (match && match.id) {
        resolvedPlanIdCache[planCode] = match.id;
        return match.id;
      }
    } catch (listErr) {
      console.warn(`[Razorpay] Plan lookup warning for ${planCode}:`, listErr.message || listErr);
    }
  }

  // Auto-create monthly plan on Razorpay via Key ID & Key Secret
  const createdPlan = await rzp.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Takora ${plan.name} Monthly`,
      amount: plan.amountPaise,
      currency: "INR",
      description: plan.description
    },
    notes: {
      app: "takora",
      plan_code: plan.code
    }
  });

  if (!createdPlan || !createdPlan.id) {
    throw new Error(`Failed to provision Razorpay plan for ${plan.name}`);
  }

  resolvedPlanIdCache[planCode] = createdPlan.id;
  return createdPlan.id;
}

module.exports = {
  SUBSCRIPTION_PLANS,
  PLAN_TIER_ORDER,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
  getRazorpayConfigStatus,
  getRazorpayInstance,
  resolveRazorpayPlanId,
  clearResolvedPlanCache
};
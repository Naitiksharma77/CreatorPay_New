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

const fs = require("fs");
const path = require("path");
const supabase = require("./supabase_config");

const PLAN_STORE_FILE = path.join(__dirname, "analytics_store.json");
const resolvedPlanIdCache = {};
const inFlightPlanPromises = {};

function clearResolvedPlanCache(planCode) {
  if (planCode) {
    delete resolvedPlanIdCache[planCode];
  } else {
    Object.keys(resolvedPlanIdCache).forEach((k) => delete resolvedPlanIdCache[k]);
  }
}

function getEnvPlanId(planCode) {
  const map = {
    basic: process.env.RAZORPAY_PLAN_BASIC_ID,
    pro: process.env.RAZORPAY_PLAN_PRO_ID,
    premium: process.env.RAZORPAY_PLAN_PREMIUM_ID
  };
  return String(map[planCode] || "").trim();
}

function readPersistedPlanIdFromJson(planCode) {
  try {
    if (!fs.existsSync(PLAN_STORE_FILE)) return "";
    const parsed = JSON.parse(fs.readFileSync(PLAN_STORE_FILE, "utf8"));
    const plansMap = parsed && parsed.razorpay_plans;
    const entry = plansMap && plansMap[planCode];
    if (!entry) return "";
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "object" && entry.razorpay_plan_id) {
      if (Number(entry.amount_paise) && Number(entry.amount_paise) !== SUBSCRIPTION_PLANS[planCode].amountPaise) {
        return "";
      }
      return String(entry.razorpay_plan_id).trim();
    }
  } catch (_) {}
  return "";
}

function writePersistedPlanToJson(plan, rzpPlanId) {
  try {
    let data = {};
    if (fs.existsSync(PLAN_STORE_FILE)) {
      data = JSON.parse(fs.readFileSync(PLAN_STORE_FILE, "utf8")) || {};
    }
    data.razorpay_plans = data.razorpay_plans && typeof data.razorpay_plans === "object"
      ? data.razorpay_plans
      : {};
    const nowIso = new Date().toISOString();
    data.razorpay_plans[plan.code] = {
      plan_key: plan.code,
      razorpay_plan_id: rzpPlanId,
      plan_name: plan.name,
      amount_paise: plan.amountPaise,
      period: "monthly",
      interval_count: 1,
      currency: "INR",
      updated_at: nowIso,
      created_at: (data.razorpay_plans[plan.code] && data.razorpay_plans[plan.code].created_at) || nowIso
    };
    fs.writeFileSync(PLAN_STORE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("[Razorpay] Unable to persist plan ID to local store:", err.message || err);
  }
}

async function readPersistedPlanIdFromSupabase(planCode) {
  if (!supabase || !supabase.isSupabaseLive) return "";
  try {
    const { data, error } = await supabase
      .from("razorpay_plans")
      .select("razorpay_plan_id, amount_paise, period, interval_count, currency")
      .eq("plan_key", planCode)
      .maybeSingle();
    if (!error && data && data.razorpay_plan_id) {
      const plan = SUBSCRIPTION_PLANS[planCode];
      if (
        Number(data.amount_paise) === plan.amountPaise &&
        data.period === "monthly" &&
        Number(data.interval_count) === 1 &&
        data.currency === "INR"
      ) {
        return String(data.razorpay_plan_id).trim();
      }
    }
  } catch (_) {}
  return "";
}

async function persistPlanId(plan, rzpPlanId) {
  resolvedPlanIdCache[plan.code] = rzpPlanId;
  writePersistedPlanToJson(plan, rzpPlanId);
  if (supabase && supabase.isSupabaseLive) {
    try {
      const nowIso = new Date().toISOString();
      await supabase.from("razorpay_plans").upsert(
        {
          plan_key: plan.code,
          razorpay_plan_id: rzpPlanId,
          plan_name: plan.name,
          amount_paise: plan.amountPaise,
          period: "monthly",
          interval_count: 1,
          currency: "INR",
          updated_at: nowIso
        },
        { onConflict: "plan_key" }
      );
    } catch (_) {}
  }
}

function isMatchingRazorpayPlan(rzpPlan, plan) {
  if (!rzpPlan || !rzpPlan.id || !rzpPlan.item) return false;
  return (
    rzpPlan.period === "monthly" &&
    Number(rzpPlan.interval) === 1 &&
    Number(rzpPlan.item.amount) === plan.amountPaise &&
    rzpPlan.item.currency === "INR"
  );
}

async function validateCandidatePlanId(rzp, candidateId, plan) {
  if (!candidateId) return false;
  try {
    const fetched = await rzp.plans.fetch(candidateId);
    return isMatchingRazorpayPlan(fetched, plan);
  } catch (_) {
    return false;
  }
}

async function resolveRazorpayPlanId(planCode, { forceCreate = false } = {}) {
  const cleanCode = String(planCode || "").trim().toLowerCase();
  const plan = SUBSCRIPTION_PLANS[cleanCode];
  if (!plan) {
    const err = new Error(`Invalid subscription plan code: ${planCode}`);
    err.statusCode = 400;
    err.code = "INVALID_PLAN";
    throw err;
  }

  if (!forceCreate && resolvedPlanIdCache[cleanCode]) {
    return resolvedPlanIdCache[cleanCode];
  }

  const lockKey = forceCreate ? `${cleanCode}:force` : cleanCode;
  if (inFlightPlanPromises[lockKey]) {
    return inFlightPlanPromises[lockKey];
  }

  const resolverPromise = (async () => {
    const rzp = getRazorpayInstance();
    if (!rzp) {
      const err = new Error("Razorpay credentials are not configured.");
      err.statusCode = 503;
      err.code = "RAZORPAY_NOT_CONFIGURED";
      throw err;
    }

    if (!forceCreate) {
      // 1. Check persisted JSON / Supabase / env candidates and validate against live Razorpay
      const candidates = [
        readPersistedPlanIdFromJson(cleanCode),
        await readPersistedPlanIdFromSupabase(cleanCode),
        getEnvPlanId(cleanCode)
      ].filter(Boolean);

      const seen = new Set();
      for (const candidateId of candidates) {
        if (seen.has(candidateId)) continue;
        seen.add(candidateId);
        const valid = await validateCandidatePlanId(rzp, candidateId, plan);
        if (valid) {
          await persistPlanId(plan, candidateId);
          return candidateId;
        }
      }

      // 2. Scan existing Razorpay monthly plans so we never duplicate an existing matching plan
      try {
        const existingPlans = await rzp.plans.all({ count: 100 });
        const items = Array.isArray(existingPlans && existingPlans.items) ? existingPlans.items : [];
        const match = items.find((p) => {
          if (!isMatchingRazorpayPlan(p, plan)) return false;
          const notes = (p && p.notes) || {};
          const itemName = String((p.item && p.item.name) || "").toLowerCase();
          return (
            notes.plan_code === cleanCode ||
            itemName.includes(`takora ${cleanCode}`)
          );
        });
        if (match && match.id) {
          await persistPlanId(plan, match.id);
          return match.id;
        }
      } catch (listErr) {
        console.warn(`[Razorpay] Plan lookup warning for ${cleanCode}:`, listErr.message || listErr);
      }
    }

    // 3. Create once cleanly via Razorpay Plans API
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
      const err = new Error(`Failed to provision Razorpay plan for ${plan.name}`);
      err.statusCode = 502;
      err.code = "PLAN_ID_NOT_FOUND";
      throw err;
    }

    await persistPlanId(plan, createdPlan.id);
    return createdPlan.id;
  })();

  inFlightPlanPromises[lockKey] = resolverPromise;
  try {
    return await resolverPromise;
  } finally {
    delete inFlightPlanPromises[lockKey];
  }
}

async function initializeMonthlyPlans() {
  const status = getRazorpayConfigStatus();
  if (!status.configured) {
    return { initialized: false, reason: "RAZORPAY_NOT_CONFIGURED", plans: {} };
  }
  const results = {};
  for (const code of Object.keys(SUBSCRIPTION_PLANS)) {
    try {
      results[code] = await resolveRazorpayPlanId(code);
    } catch (err) {
      console.warn(`[Razorpay] Startup plan resolution failed for ${code}:`, err.message || err);
      results[code] = null;
    }
  }
  return { initialized: true, plans: results };
}

function getResolvedPlansSnapshot() {
  const out = {};
  for (const code of Object.keys(SUBSCRIPTION_PLANS)) {
    out[code] = resolvedPlanIdCache[code] || readPersistedPlanIdFromJson(code) || getEnvPlanId(code) || null;
  }
  return out;
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
  clearResolvedPlanCache,
  initializeMonthlyPlans,
  getResolvedPlansSnapshot
};
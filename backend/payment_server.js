require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const {
  SUBSCRIPTION_PLANS,
  PLAN_TIER_ORDER,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
  getRazorpayConfigStatus,
  getRazorpayInstance
} = require("./payment_config");
const {
  createRazorpayMonthlySubscription,
  verifySubscriptionHmacSignature
} = require("./subscription_engine");
const supabase = require("./supabase_config");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.use(
  cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-razorpay-signature",
      "x-razorpay-event-id"
    ]
  })
);

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(express.urlencoded({ extended: false }));

// Serve static frontend files
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "creator_home.html"));
});

// ======================================
// ANALYTICS & PERSISTENT APPLICATION STORE
// ======================================

const ANALYTICS_DATA_FILE = path.join(__dirname, "analytics_store.json");

function loadAnalyticsStore() {
  try {
    if (fs.existsSync(ANALYTICS_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_DATA_FILE, "utf-8"));
      return {
        payments: Array.isArray(data.payments) ? data.payments : [],
        active_users: Array.isArray(data.active_users) ? data.active_users : [],
        active_sessions:
          data.active_sessions && typeof data.active_sessions === "object"
            ? data.active_sessions
            : {},
        events: Array.isArray(data.events) ? data.events : [],
        pending_orders:
          data.pending_orders && typeof data.pending_orders === "object"
            ? data.pending_orders
            : {},
        messages: Array.isArray(data.messages) ? data.messages : [],
        creator_metadata:
          data.creator_metadata && typeof data.creator_metadata === "object"
            ? data.creator_metadata
            : {},
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        users: Array.isArray(data.users) ? data.users : [],
        subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
        subscription_payments: Array.isArray(data.subscription_payments)
          ? data.subscription_payments
          : [],
        webhook_events: Array.isArray(data.webhook_events) ? data.webhook_events : [],
        interaction_sessions: Array.isArray(data.interaction_sessions)
          ? data.interaction_sessions
          : [],
        _runtime_session_secret:
          typeof data._runtime_session_secret === "string"
            ? data._runtime_session_secret
            : "",
        tracking_started: data.tracking_started || new Date().toISOString()
      };
    }
  } catch (e) {
    console.warn("Could not read analytics store:", e.message);
  }
  return {
    payments: [],
    active_users: [],
    active_sessions: {},
    events: [],
    pending_orders: {},
    messages: [],
    creator_metadata: {},
    bookings: [],
    users: [],
    subscriptions: [],
    subscription_payments: [],
    webhook_events: [],
    interaction_sessions: [],
    _runtime_session_secret: "",
    tracking_started: new Date().toISOString()
  };
}

function saveAnalyticsStore(data) {
  try {
    fs.writeFileSync(ANALYTICS_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save analytics store:", e.message);
  }
}

// ======================================
// GENERAL & AUTH HELPERS
// ======================================

function sendError(res, statusCode, message, error = null, extra = {}) {
  if (error) {
    console.error(message, error.message || error);
  }
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra
  });
}

function getNumericPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function getSessionSecret() {
  const envSecret = String(process.env.SESSION_SECRET || "").trim();
  if (envSecret.length >= 16) {
    return envSecret;
  }
  const store = loadAnalyticsStore();
  if (!store._runtime_session_secret) {
    store._runtime_session_secret = crypto.randomBytes(32).toString("hex");
    saveAnalyticsStore(store);
  }
  return store._runtime_session_secret;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash: derived };
}

function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  try {
    const derived = crypto.scryptSync(String(password), String(salt), 64);
    const expectedBuf = Buffer.from(String(expectedHash), "hex");
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch (_) {
    return false;
  }
}

function signSessionToken(user) {
  const payload = {
    uid: String(user.id),
    email: String(user.email || ""),
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;
  try {
    const expectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(payloadB64)
      .digest("base64url");
    const a = Buffer.from(providedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload || !payload.uid || (payload.exp && Date.now() > payload.exp)) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) cookies[k] = decodeURIComponent(v);
    }
  });
  return cookies;
}

function setSessionCookie(req, res, token) {
  const isHttps =
    req.secure ||
    String(req.headers["x-forwarded-proto"] || "").toLowerCase().includes("https");
  const parts = [
    `takora_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${30 * 24 * 60 * 60}`
  ];
  if (isHttps) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const isHttps =
    req.secure ||
    String(req.headers["x-forwarded-proto"] || "").toLowerCase().includes("https");
  const parts = ["takora_session=", "Path=/", "HttpOnly", "Max-Age=0"];
  if (isHttps) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    name: String(user.name || "Takora Member"),
    email: String(user.email || ""),
    phone: String(user.phone || ""),
    role: String(user.role || "user"),
    created_at: user.created_at || new Date().toISOString()
  };
}

async function findUserByEmail(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return null;
  const store = loadAnalyticsStore();
  let user = (store.users || []).find(
    (u) => String(u.email || "").toLowerCase() === cleanEmail
  );
  if (!user && supabase.isSupabaseLive) {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (data) user = data;
    } catch (_) {}
  }
  return user || null;
}

async function findUserById(userId) {
  if (!userId) return null;
  const cleanId = String(userId).trim();
  const store = loadAnalyticsStore();
  let user = (store.users || []).find((u) => String(u.id) === cleanId);
  if (!user && supabase.isSupabaseLive) {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", cleanId)
        .maybeSingle();
      if (data) user = data;
    } catch (_) {}
  }
  return user || null;
}

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  let token = cookies.takora_session || "";
  if (!token && req.headers && req.headers.authorization) {
    const auth = String(req.headers.authorization);
    if (auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }
  const decoded = verifySessionToken(token);
  if (!decoded || !decoded.uid) return null;
  const user = await findUserById(decoded.uid);
  return user || null;
}

async function requireAuth(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Active membership required. Please select a plan to continue."
    });
    return null;
  }
  return user;
}

async function createInstantMemberSession(req, res) {
  const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const { salt, hash } = hashPassword(crypto.randomBytes(24).toString("hex"));
  const nowIso = new Date().toISOString();
  const newUser = {
    id: `usr_${uniqueSuffix}`,
    name: "Takora Member",
    email: `member_${uniqueSuffix}@member.takora.local`,
    phone: "",
    password_hash: hash,
    password_salt: salt,
    role: "member",
    has_access: false,
    status: "active",
    razorpay_customer_id: "",
    created_at: nowIso,
    updated_at: nowIso
  };

  const store = loadAnalyticsStore();
  store.users = store.users || [];
  store.users.unshift(newUser);
  saveAnalyticsStore(store);

  if (supabase.isSupabaseLive) {
    try {
      await supabase.from("users").insert([newUser]);
    } catch (err) {
      console.warn("[Supabase] Instant member insert warning:", err.message || err);
    }
  }

  const token = signSessionToken(newUser);
  setSessionCookie(req, res, token);
  return { user: newUser, token };
}

// ======================================
// SUBSCRIPTION & ENTITLEMENT HELPERS
// ======================================

function unixToIso(sec) {
  if (!sec || !Number.isFinite(Number(sec))) return null;
  return new Date(Number(sec) * 1000).toISOString();
}

function addOneMonthIso(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function computeEntitlements(subscription) {
  const baseNone = {
    hasActiveSubscription: false,
    planCode: null,
    planName: "Free",
    amountInr: 0,
    status: subscription ? subscription.status : "none",
    canViewProfiles: false,
    canChat: false,
    canVoiceCall: false,
    canVideoCall: false,
    currentStart: subscription ? subscription.current_start || null : null,
    currentEnd: subscription ? subscription.current_end || null : null,
    nextBillingDate: subscription ? subscription.next_billing_date || null : null,
    cancelAtPeriodEnd: Boolean(subscription && subscription.cancel_at_period_end),
    pendingMandate: Boolean(
      subscription &&
        subscription.status === "authenticated" &&
        subscription.payment_verification_status !== "verified"
    )
  };

  if (!subscription) {
    return baseNone;
  }

  const isVerifiedPaid = subscription.payment_verification_status === "verified";
  const periodEndMs = subscription.current_end
    ? new Date(subscription.current_end).getTime()
    : 0;
  const withinPaidPeriod = !periodEndMs || periodEndMs > Date.now();

  const isActive = Boolean(
    isVerifiedPaid &&
      (subscription.status === "active" ||
        (subscription.status === "cancelled" &&
          subscription.cancel_at_period_end &&
          withinPaidPeriod))
  );

  if (!isActive) {
    return baseNone;
  }

  const plan = SUBSCRIPTION_PLANS[subscription.plan_code] || SUBSCRIPTION_PLANS.basic;
  return {
    hasActiveSubscription: true,
    planCode: plan.code,
    planName: plan.name,
    amountInr: plan.priceInr,
    status: subscription.status,
    canViewProfiles: Boolean(plan.features.profiles),
    canChat: Boolean(plan.features.chat),
    canVoiceCall: Boolean(plan.features.voice_call),
    canVideoCall: Boolean(plan.features.video_call),
    currentStart: subscription.current_start || null,
    currentEnd: subscription.current_end || null,
    nextBillingDate: subscription.cancel_at_period_end
      ? null
      : subscription.next_billing_date || subscription.current_end || null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    pendingMandate: false
  };
}

function getRequiredPlanForFeature(feature) {
  if (feature === "video_call") return "premium";
  if (feature === "voice_call") return "pro";
  return "basic";
}

function checkFeatureAllowance(entitlements, feature) {
  if (!entitlements || !entitlements.hasActiveSubscription) {
    return false;
  }
  if (feature === "video_call") return Boolean(entitlements.canVideoCall);
  if (feature === "voice_call") return Boolean(entitlements.canVoiceCall);
  if (feature === "chat") return Boolean(entitlements.canChat);
  return Boolean(entitlements.canViewProfiles);
}

async function getUserSubscriptions(userId) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return [];

  const store = loadAnalyticsStore();
  let subs = (store.subscriptions || []).filter(
    (s) => String(s.user_id) === cleanUserId
  );

  if (supabase.isSupabaseLive) {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", cleanUserId)
        .order("updated_at", { ascending: false });
      if (Array.isArray(data) && data.length > 0) {
        subs = data;
      }
    } catch (_) {}
  }

  subs.sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
  );
  return subs;
}

async function getPrimaryUserSubscription(userId) {
  const subs = await getUserSubscriptions(userId);
  if (subs.length === 0) return null;

  // Prefer currently entitled active subscription first
  const entitled = subs.find((s) => computeEntitlements(s).hasActiveSubscription);
  if (entitled) return entitled;

  // Otherwise return most recently updated subscription (e.g., authenticated/cancelled/halted)
  return subs[0];
}

async function getUserPaymentHistory(userId) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return [];
  const store = loadAnalyticsStore();
  let list = (store.subscription_payments || []).filter(
    (p) => String(p.user_id) === cleanUserId
  );
  if (supabase.isSupabaseLive && list.length === 0) {
    try {
      const { data } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("user_id", cleanUserId)
        .order("created_at", { ascending: false });
      if (Array.isArray(data) && data.length > 0) list = data;
    } catch (_) {}
  }
  return [...list].sort(
    (a, b) =>
      new Date(b.paid_at || b.created_at || 0).getTime() -
      new Date(a.paid_at || a.created_at || 0).getTime()
  );
}

async function saveSubscriptionRecord(subObj) {
  const store = loadAnalyticsStore();
  store.subscriptions = store.subscriptions || [];
  const idx = store.subscriptions.findIndex(
    (s) =>
      s.razorpay_subscription_id === subObj.razorpay_subscription_id ||
      s.id === subObj.id
  );
  const nowIso = new Date().toISOString();
  const merged =
    idx !== -1
      ? { ...store.subscriptions[idx], ...subObj, updated_at: nowIso }
      : {
          id: subObj.id || `sub_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          created_at: nowIso,
          updated_at: nowIso,
          ...subObj
        };

  if (idx !== -1) {
    store.subscriptions[idx] = merged;
  } else {
    store.subscriptions.unshift(merged);
  }
  saveAnalyticsStore(store);

  if (supabase.isSupabaseLive) {
    try {
      await supabase
        .from("subscriptions")
        .upsert(merged, { onConflict: "razorpay_subscription_id" });
    } catch (err) {
      console.warn("[Supabase] Subscription upsert warning:", err.message || err);
    }
  }
  return merged;
}

async function recordSubscriptionPayment(paymentObj) {
  const store = loadAnalyticsStore();
  store.subscription_payments = store.subscription_payments || [];
  const existingIdx = paymentObj.razorpay_payment_id
    ? store.subscription_payments.findIndex(
        (p) => p.razorpay_payment_id === paymentObj.razorpay_payment_id
      )
    : -1;

  const nowIso = new Date().toISOString();
  const record =
    existingIdx !== -1
      ? { ...store.subscription_payments[existingIdx], ...paymentObj }
      : {
          id: `subpay_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          currency: "INR",
          created_at: nowIso,
          ...paymentObj
        };

  if (existingIdx !== -1) {
    store.subscription_payments[existingIdx] = record;
  } else {
    store.subscription_payments.unshift(record);
  }
  saveAnalyticsStore(store);

  if (supabase.isSupabaseLive && record.razorpay_payment_id) {
    try {
      await supabase
        .from("subscription_payments")
        .upsert(record, { onConflict: "razorpay_payment_id" });
    } catch (err) {
      console.warn("[Supabase] Subscription payment upsert warning:", err.message || err);
    }
  }
  return record;
}

async function syncUserAccessFlag(userId, hasAccess, razorpayCustomerId = "") {
  if (!userId) return;
  const store = loadAnalyticsStore();
  const idx = (store.users || []).findIndex((u) => String(u.id) === String(userId));
  if (idx !== -1) {
    store.users[idx].has_access = Boolean(hasAccess);
    if (razorpayCustomerId) store.users[idx].razorpay_customer_id = razorpayCustomerId;
    store.users[idx].updated_at = new Date().toISOString();
    saveAnalyticsStore(store);
  }
  if (supabase.isSupabaseLive) {
    try {
      const updateFields = {
        has_access: Boolean(hasAccess),
        updated_at: new Date().toISOString()
      };
      if (razorpayCustomerId) updateFields.razorpay_customer_id = razorpayCustomerId;
      await supabase.from("users").update(updateFields).eq("id", String(userId));
    } catch (_) {}
  }
}

// ======================================
// BACKEND STATUS
// ======================================

app.get("/api/status", (req, res) => {
  const rzpStatus = getRazorpayConfigStatus();
  res.json({
    success: true,
    app: "Takora",
    message: "Takora subscription platform backend is running!",
    razorpayConfigured: rzpStatus.configured,
    webhookConfigured: rzpStatus.webhookConfigured,
    missingEnvVars: rzpStatus.missingEnvVars
  });
});

// ======================================
// FREE USER AUTHENTICATION ENDPOINTS
// ======================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();
    const rawPassword = String(password || "");

    if (!cleanName || cleanName.length < 2) {
      return sendError(res, 400, "Please enter your full name (at least 2 characters).");
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return sendError(res, 400, "Please enter a valid email address.");
    }
    if (rawPassword.length < 6) {
      return sendError(res, 400, "Password must be at least 6 characters long.");
    }

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      return sendError(res, 409, "An account with this email already exists. Please log in instead.");
    }

    const { salt, hash } = hashPassword(rawPassword);
    const nowIso = new Date().toISOString();
    const newUser = {
      id: `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      password_hash: hash,
      password_salt: salt,
      role: "user",
      has_access: false,
      status: "active",
      razorpay_customer_id: "",
      created_at: nowIso,
      updated_at: nowIso
    };

    const store = loadAnalyticsStore();
    store.users = store.users || [];
    store.users.unshift(newUser);
    saveAnalyticsStore(store);

    if (supabase.isSupabaseLive) {
      try {
        await supabase.from("users").insert([newUser]);
      } catch (err) {
        console.warn("[Supabase] Register insert warning:", err.message || err);
      }
    }

    const token = signSessionToken(newUser);
    setSessionCookie(req, res, token);

    logAnalyticsEvent("user_registered", {
      page: "auth",
      details: cleanEmail
    });

    return res.status(201).json({
      success: true,
      message: "Account created for free! Choose a membership plan whenever you are ready to connect.",
      user: sanitizeUser(newUser),
      subscription: null,
      entitlements: computeEntitlements(null),
      paymentHistory: [],
      token
    });
  } catch (error) {
    return sendError(res, 500, "Unable to complete registration.", error);
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!cleanEmail || !rawPassword) {
      return sendError(res, 400, "Email and password are required.");
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user || !verifyPassword(rawPassword, user.password_salt, user.password_hash)) {
      return sendError(res, 401, "Invalid email or password.");
    }

    const token = signSessionToken(user);
    setSessionCookie(req, res, token);

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    const paymentHistory = await getUserPaymentHistory(user.id);

    return res.json({
      success: true,
      message: "Logged in successfully.",
      user: sanitizeUser(user),
      subscription,
      entitlements,
      paymentHistory,
      token
    });
  } catch (error) {
    return sendError(res, 500, "Unable to log in.", error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  return res.json({
    success: true,
    message: "Logged out successfully."
  });
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.json({
        success: true,
        authenticated: false,
        user: null,
        subscription: null,
        entitlements: computeEntitlements(null),
        paymentHistory: []
      });
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    const paymentHistory = await getUserPaymentHistory(user.id);

    return res.json({
      success: true,
      authenticated: true,
      user: sanitizeUser(user),
      subscription,
      entitlements,
      paymentHistory
    });
  } catch (error) {
    return sendError(res, 500, "Unable to fetch user session.", error);
  }
});

// ======================================
// CENTRALIZED SUBSCRIPTIONS & RAZORPAY AUTOPAY
// ======================================

app.get("/api/subscriptions/plans", (req, res) => {
  const rzpStatus = getRazorpayConfigStatus();
  return res.json({
    success: true,
    plans: Object.values(SUBSCRIPTION_PLANS),
    razorpay: {
      configured: rzpStatus.configured,
      webhookConfigured: rzpStatus.webhookConfigured,
      keyId: rzpStatus.keyId,
      missingEnvVars: rzpStatus.missingEnvVars
    }
  });
});

app.get("/api/subscriptions/me", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    const paymentHistory = await getUserPaymentHistory(user.id);

    return res.json({
      success: true,
      user: sanitizeUser(user),
      subscription,
      entitlements,
      paymentHistory
    });
  } catch (error) {
    return sendError(res, 500, "Unable to fetch subscription status.", error);
  }
});

async function createSubscriptionCheckout({ req, res, isUpgrade = false }) {
  try {
    let user = null;
    let issuedToken = null;
    try {
      user = await getAuthenticatedUser(req);
    } catch (_) {
      user = null;
    }
    if (!user) {
      const instantSession = await createInstantMemberSession(req, res);
      user = instantSession.user;
      issuedToken = instantSession.token;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const cleanPlanCode = String(body.planCode || "").trim().toLowerCase();
    const targetPlan = SUBSCRIPTION_PLANS[cleanPlanCode];

    if (!targetPlan) {
      return sendError(
        res,
        400,
        "Please select a valid subscription plan: basic, pro, or premium."
      );
    }

    const rzpStatus = getRazorpayConfigStatus();
    if (!rzpStatus.configured) {
      return res.status(503).json({
        success: false,
        code: "RAZORPAY_NOT_CONFIGURED",
        missingEnvVars: rzpStatus.missingEnvVars,
        message: `Razorpay Subscriptions is not configured on this server yet. Set ${rzpStatus.missingEnvVars.join(
          " and "
        )} in environment variables to enable AutoPay checkouts.`
      });
    }

    let existingSub = null;
    try {
      existingSub = await getPrimaryUserSubscription(user.id);
    } catch (_) {
      existingSub = null;
    }
    const existingEntitlements = computeEntitlements(existingSub);

    if (existingEntitlements.hasActiveSubscription && !existingEntitlements.cancelAtPeriodEnd) {
      if (existingEntitlements.planCode === cleanPlanCode) {
        return sendError(
          res,
          409,
          `You already have an active ${targetPlan.name} subscription.`
        );
      }
      const currentTier = PLAN_TIER_ORDER[existingEntitlements.planCode] || 0;
      const requestedTier = PLAN_TIER_ORDER[cleanPlanCode] || 0;
      if (isUpgrade && requestedTier <= currentTier) {
        return sendError(
          res,
          400,
          `Please select a plan higher than your current ${existingEntitlements.planName} plan to upgrade.`
        );
      }
      if (!isUpgrade && requestedTier <= currentTier) {
        return sendError(
          res,
          400,
          `You already have ${existingEntitlements.planName} access. Cancel your current plan at cycle end if you wish to switch to a lower tier next month.`
        );
      }
    }

    const {
      keyId,
      plan,
      rzpPlanId,
      rzpCustomerId,
      rzpSub
    } = await createRazorpayMonthlySubscription({
      planCode: cleanPlanCode,
      user,
      existingSub,
      existingEntitlements
    });

    const isGuestPlaceholder = String(user.email || "").endsWith("@member.takora.local");
    if (rzpCustomerId && !user.razorpay_customer_id) {
      await syncUserAccessFlag(user.id, existingEntitlements.hasActiveSubscription, rzpCustomerId);
    }

    const savedSub = await saveSubscriptionRecord({
      user_id: String(user.id),
      user_email: isGuestPlaceholder ? "" : String(user.email),
      plan_code: plan.code,
      plan_name: plan.name,
      amount_inr: plan.priceInr,
      razorpay_plan_id: rzpPlanId,
      razorpay_subscription_id: rzpSub.id,
      razorpay_customer_id: rzpCustomerId || rzpSub.customer_id || "",
      status: rzpSub.status || "created",
      payment_verification_status: "pending",
      has_access: false,
      cancel_at_period_end: false,
      current_start: unixToIso(rzpSub.current_start),
      current_end: unixToIso(rzpSub.current_end),
      next_billing_date: unixToIso(rzpSub.charge_at || rzpSub.current_end),
      short_url: rzpSub.short_url || "",
      superseded_subscription_id:
        existingSub && existingEntitlements.hasActiveSubscription
          ? existingSub.razorpay_subscription_id
          : ""
    });

    logAnalyticsEvent("checkout_initiated", {
      page: "pricing.html",
      amount: plan.priceInr,
      creatorName: `${plan.name} Plan`
    });

    const prefill = isGuestPlaceholder
      ? {}
      : {
          name: user.name,
          email: user.email,
          contact: user.phone || ""
        };

    return res.json({
      success: true,
      keyId,
      sessionToken: issuedToken || undefined,
      plan,
      subscription: {
        id: rzpSub.id,
        plan_id: rzpPlanId,
        status: savedSub.status,
        short_url: rzpSub.short_url || ""
      },
      prefill
    });
  } catch (err) {
    const statusCode = Number(err && err.statusCode) || 502;
    const msg =
      (err && err.message) ||
      "Unable to initialize Razorpay monthly subscription.";
    return sendError(res, statusCode, msg, err, {
      code: err && err.code ? err.code : undefined,
      missingEnvVars: err && err.missingEnvVars ? err.missingEnvVars : undefined
    });
  }
}

app.post("/api/subscriptions/create", (req, res) =>
  createSubscriptionCheckout({ req, res, isUpgrade: false })
);

app.post("/api/subscriptions/upgrade", (req, res) =>
  createSubscriptionCheckout({ req, res, isUpgrade: true })
);

async function activateVerifiedSubscription({
  user,
  rzp,
  rzpSub,
  rzpPay,
  signature = "",
  existingRow = null,
  analyticsPage = "pricing.html"
}) {
  const planCode =
    (rzpSub && rzpSub.notes && rzpSub.notes.planCode) ||
    (existingRow && existingRow.plan_code) ||
    "basic";
  const plan = SUBSCRIPTION_PLANS[planCode] || SUBSCRIPTION_PLANS.basic;
  const paidAmountInr =
    rzpPay && rzpPay.amount ? Math.round(Number(rzpPay.amount) / 100) : plan.priceInr;

  const paymentSettled = Boolean(
    rzpPay &&
      (rzpPay.status === "captured" ||
        (rzpPay.status === "authorized" && Number((rzpSub && rzpSub.paid_count) || 0) >= 1))
  );
  const subscriptionActive = Boolean(
    rzpSub &&
      (rzpSub.status === "active" ||
        (paymentSettled && Number(rzpSub.paid_count || 0) >= 1))
  );

  if (!paymentSettled || !subscriptionActive) {
    const pendingRow = await saveSubscriptionRecord({
      user_id: String(user.id),
      user_email: String(user.email || "").endsWith("@member.takora.local")
        ? ""
        : String(user.email || ""),
      plan_code: plan.code,
      plan_name: plan.name,
      amount_inr: plan.priceInr,
      razorpay_plan_id:
        (rzpSub && rzpSub.plan_id) || (existingRow && existingRow.razorpay_plan_id) || "",
      razorpay_subscription_id: rzpSub.id,
      razorpay_customer_id: rzpSub.customer_id || "",
      status: rzpSub.status || "created",
      payment_verification_status: "pending",
      has_access: false,
      current_start: unixToIso(rzpSub.current_start),
      current_end: unixToIso(rzpSub.current_end),
      next_billing_date: unixToIso(rzpSub.charge_at || rzpSub.current_end),
      paid_count: Number(rzpSub.paid_count || 0)
    });

    return {
      settled: false,
      plan,
      row: pendingRow
    };
  }

  const nowIso = new Date().toISOString();
  const currentStartIso = unixToIso(rzpSub.current_start) || nowIso;
  const currentEndIso = unixToIso(rzpSub.current_end) || addOneMonthIso(nowIso);
  const nextBillingIso = unixToIso(rzpSub.charge_at || rzpSub.current_end) || currentEndIso;

  const payerEmail = String((rzpPay && rzpPay.email) || "").trim().toLowerCase();
  const payerContact = String((rzpPay && rzpPay.contact) || "").trim();
  const currentEmail = String(user.email || "");
  const resolvedEmail = currentEmail.endsWith("@member.takora.local")
    ? payerEmail || payerContact || ""
    : currentEmail;

  if (currentEmail.endsWith("@member.takora.local") && (payerEmail || payerContact)) {
    const uStore = loadAnalyticsStore();
    const uIdx = (uStore.users || []).findIndex((u) => String(u.id) === String(user.id));
    if (uIdx !== -1) {
      if (payerEmail) uStore.users[uIdx].email = payerEmail;
      if (payerContact) uStore.users[uIdx].phone = payerContact;
      uStore.users[uIdx].updated_at = nowIso;
      saveAnalyticsStore(uStore);
    }
  }

  const activeRow = await saveSubscriptionRecord({
    user_id: String(user.id),
    user_email: resolvedEmail,
    plan_code: plan.code,
    plan_name: plan.name,
    amount_inr: plan.priceInr,
    razorpay_plan_id:
      (rzpSub && rzpSub.plan_id) || (existingRow && existingRow.razorpay_plan_id) || "",
    razorpay_subscription_id: rzpSub.id,
    razorpay_customer_id: rzpSub.customer_id || "",
    status: "active",
    payment_verification_status: "verified",
    has_access: true,
    cancel_at_period_end: false,
    current_start: currentStartIso,
    current_end: currentEndIso,
    next_billing_date: nextBillingIso,
    paid_count: Math.max(1, Number(rzpSub.paid_count || 1))
  });

  const payRecord = await recordSubscriptionPayment({
    subscription_id: activeRow.id,
    razorpay_subscription_id: rzpSub.id,
    user_id: String(user.id),
    user_email: resolvedEmail,
    plan_code: plan.code,
    razorpay_payment_id: rzpPay.id,
    razorpay_signature: String(signature || "razorpay_api_synced"),
    amount_inr: paidAmountInr,
    status: rzpPay.status || "captured",
    method: rzpPay.method || "autopay",
    paid_at: nowIso
  });

  await syncUserAccessFlag(user.id, true, rzpSub.customer_id || "");

  // Cancel superseded lower-tier subscription cleanly on Razorpay if this was an upgrade
  const oldSubId =
    (rzpSub.notes && rzpSub.notes.upgradeFromSubscriptionId) ||
    (existingRow && existingRow.superseded_subscription_id) ||
    "";
  if (oldSubId && oldSubId !== rzpSub.id) {
    try {
      await rzp.subscriptions.cancel(oldSubId, false);
      const freshStore = loadAnalyticsStore();
      const oldRow = (freshStore.subscriptions || []).find(
        (s) => s.razorpay_subscription_id === oldSubId
      );
      if (oldRow) {
        await saveSubscriptionRecord({
          ...oldRow,
          status: "cancelled",
          has_access: false,
          superseded_by: rzpSub.id,
          cancelled_at: nowIso
        });
      }
    } catch (cancelOldErr) {
      console.warn(
        "[Razorpay] Old subscription cancel warning:",
        cancelOldErr.message || cancelOldErr
      );
    }
  }

  logAnalyticsEvent("payment_success", {
    page: analyticsPage,
    amount: paidAmountInr,
    creatorName: `${plan.name} Membership`
  });

  return {
    settled: true,
    plan,
    row: activeRow,
    payment: payRecord
  };
}

app.post("/api/subscriptions/verify", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature
    } = req.body || {};

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return sendError(
        res,
        400,
        "Missing Razorpay subscription verification fields (payment ID, subscription ID, signature)."
      );
    }

    const secret = getRazorpayKeySecret();
    const rzp = getRazorpayInstance();
    if (!secret || !rzp) {
      return sendError(
        res,
        503,
        "Razorpay verification credentials are not configured on the server."
      );
    }

    // Razorpay Subscription signature: HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret)
    if (!verifySubscriptionHmacSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
      return sendError(res, 400, "Razorpay subscription signature verification failed.");
    }

    // Cross-check live subscription & payment entities with Razorpay API
    const [rzpSub, rzpPay] = await Promise.all([
      rzp.subscriptions.fetch(String(razorpay_subscription_id).trim()),
      rzp.payments.fetch(String(razorpay_payment_id).trim())
    ]);

    const store = loadAnalyticsStore();
    const existingRow = (store.subscriptions || []).find(
      (s) => s.razorpay_subscription_id === String(razorpay_subscription_id).trim()
    );

    const ownerUserId =
      (rzpSub && rzpSub.notes && rzpSub.notes.userId) ||
      (existingRow && existingRow.user_id) ||
      "";
    if (String(ownerUserId) !== String(user.id)) {
      return sendError(res, 403, "This subscription does not belong to your account.");
    }

    const activation = await activateVerifiedSubscription({
      user,
      rzp,
      rzpSub,
      rzpPay,
      signature: String(razorpay_signature),
      existingRow,
      analyticsPage: "pricing.html"
    });

    if (!activation.settled) {
      return res.status(202).json({
        success: false,
        pendingConfirmation: true,
        subscription: activation.row,
        entitlements: computeEntitlements(activation.row),
        message:
          "Your AutoPay mandate is authorized and awaiting initial payment confirmation from Razorpay. Access will unlock automatically once the charge settles."
      });
    }

    return res.json({
      success: true,
      message: `Your ${activation.plan.name} membership is active!`,
      subscription: activation.row,
      entitlements: computeEntitlements(activation.row),
      payment: activation.payment
    });
  } catch (error) {
    return sendError(res, 500, "Unable to verify subscription payment.", error);
  }
});

app.post("/api/subscriptions/sync-status", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const rzp = getRazorpayInstance();
    if (!rzp) {
      return sendError(
        res,
        503,
        "Razorpay credentials are not configured on the server."
      );
    }

    const store = loadAnalyticsStore();
    let targetSubId = String((req.body && req.body.subscriptionId) || "").trim();
    if (!targetSubId) {
      const latestSub = await getPrimaryUserSubscription(user.id);
      targetSubId = latestSub ? String(latestSub.razorpay_subscription_id || "").trim() : "";
    }

    if (!targetSubId) {
      return res.status(404).json({
        success: false,
        message: "No subscription ID found to verify."
      });
    }

    const existingRow = (store.subscriptions || []).find(
      (s) => s.razorpay_subscription_id === targetSubId
    );
    const rzpSub = await rzp.subscriptions.fetch(targetSubId);
    const ownerUserId =
      (rzpSub && rzpSub.notes && rzpSub.notes.userId) ||
      (existingRow && existingRow.user_id) ||
      "";
    if (String(ownerUserId) !== String(user.id)) {
      return sendError(res, 403, "This subscription does not belong to your account.");
    }

    // Check invoices on Razorpay for a real settled payment (covers hosted rzp.io / UPI flows)
    let settledPay = null;
    try {
      const invRes = await rzp.invoices.all({ subscription_id: targetSubId, count: 10 });
      const invoices = Array.isArray(invRes && invRes.items) ? invRes.items : [];
      const paidInvoice = invoices.find(
        (inv) => inv && inv.payment_id && (inv.status === "paid" || Number(inv.amount_paid || 0) > 0)
      );
      if (paidInvoice && paidInvoice.payment_id) {
        settledPay = await rzp.payments.fetch(paidInvoice.payment_id);
      }
    } catch (invErr) {
      console.warn("[Razorpay] Invoice lookup warning:", invErr.message || invErr);
    }

    const activation = await activateVerifiedSubscription({
      user,
      rzp,
      rzpSub,
      rzpPay: settledPay,
      signature: "razorpay_api_synced",
      existingRow,
      analyticsPage: "pricing.html"
    });

    if (!activation.settled) {
      return res.status(202).json({
        success: false,
        pendingConfirmation: true,
        status: rzpSub.status || "created",
        subscription: activation.row,
        entitlements: computeEntitlements(activation.row),
        message:
          rzpSub.status === "authenticated"
            ? "AutoPay mandate authorized and awaiting Razorpay payment settlement."
            : "Payment is not completed on Razorpay yet."
      });
    }

    return res.json({
      success: true,
      message: `Your ${activation.plan.name} membership is active!`,
      subscription: activation.row,
      entitlements: computeEntitlements(activation.row),
      payment: activation.payment
    });
  } catch (error) {
    return sendError(res, 500, "Unable to sync subscription status with Razorpay.", error);
  }
});

app.post("/api/subscriptions/callback", async (req, res) => {
  try {
    const body = req.body || {};
    const paymentId = String(body.razorpay_payment_id || "").trim();
    const subId = String(body.razorpay_subscription_id || "").trim();
    const signature = String(body.razorpay_signature || "").trim();

    if (!paymentId || !subId || !signature) {
      return res.redirect(303, "/pricing.html?checkout_error=missing_params");
    }

    const secret = getRazorpayKeySecret();
    const rzp = getRazorpayInstance();
    if (!secret || !rzp) {
      return res.redirect(303, "/pricing.html?checkout_error=gateway_not_configured");
    }

    if (!verifySubscriptionHmacSignature(paymentId, subId, signature)) {
      return res.redirect(303, "/pricing.html?checkout_error=invalid_signature");
    }

    const [rzpSub, rzpPay] = await Promise.all([
      rzp.subscriptions.fetch(subId),
      rzp.payments.fetch(paymentId)
    ]);

    const store = loadAnalyticsStore();
    const existingRow = (store.subscriptions || []).find(
      (s) => s.razorpay_subscription_id === subId
    );
    const ownerUserId =
      (rzpSub && rzpSub.notes && rzpSub.notes.userId) ||
      (existingRow && existingRow.user_id) ||
      "";
    const ownerUser = ownerUserId ? await findUserById(ownerUserId) : null;
    if (!ownerUser) {
      return res.redirect(303, "/pricing.html?checkout_error=user_not_found");
    }

    const token = signSessionToken(ownerUser);
    setSessionCookie(req, res, token);

    const activation = await activateVerifiedSubscription({
      user: ownerUser,
      rzp,
      rzpSub,
      rzpPay,
      signature,
      existingRow,
      analyticsPage: "pricing_callback"
    });

    const planCode = encodeURIComponent(activation.plan.code || "basic");
    return res.redirect(
      303,
      `/payment_success.html?subscription_id=${encodeURIComponent(subId)}&plan=${planCode}`
    );
  } catch (err) {
    console.error("[Razorpay Callback] Error:", err.message || err);
    return res.redirect(303, "/pricing.html?checkout_error=callback_failed");
  }
});

app.get("/api/subscriptions/callback", (req, res) => {
  const subId = String(
    req.query.razorpay_subscription_id || req.query.subscription_id || ""
  ).trim();
  if (subId) {
    return res.redirect(303, `/payment_success.html?subscription_id=${encodeURIComponent(subId)}`);
  }
  return res.redirect(303, "/pricing.html");
});

app.post("/api/subscriptions/cancel", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const currentSub = await getPrimaryUserSubscription(user.id);
    if (!currentSub || !currentSub.razorpay_subscription_id) {
      return sendError(res, 404, "No active subscription found on your account.");
    }
    if (currentSub.cancel_at_period_end || currentSub.status === "cancelled") {
      return res.json({
        success: true,
        message: "AutoPay is already scheduled to cancel at the end of your current billing period.",
        subscription: currentSub,
        entitlements: computeEntitlements(currentSub)
      });
    }

    const rzp = getRazorpayInstance();
    if (!rzp) {
      return sendError(
        res,
        503,
        "Razorpay credentials are not configured; unable to cancel remote subscription."
      );
    }

    // Razorpay Node SDK v2 signature: subscriptions.cancel(subId, cancelAtCycleEndBoolean)
    const rzpCancelled = await rzp.subscriptions.cancel(
      currentSub.razorpay_subscription_id,
      true
    );

    const nowIso = new Date().toISOString();
    const updated = await saveSubscriptionRecord({
      ...currentSub,
      status: "cancelled",
      cancel_at_period_end: true,
      cancelled_at: nowIso,
      current_end:
        unixToIso(rzpCancelled && rzpCancelled.current_end) ||
        currentSub.current_end ||
        addOneMonthIso(nowIso),
      next_billing_date: null
    });

    return res.json({
      success: true,
      message:
        "AutoPay cancelled. You will continue to enjoy your membership benefits until the end of your current billing cycle.",
      subscription: updated,
      entitlements: computeEntitlements(updated)
    });
  } catch (error) {
    const rzpMsg =
      (error && error.error && error.error.description) ||
      error.message ||
      "Unable to cancel subscription.";
    return sendError(res, 500, rzpMsg, error);
  }
});

// ======================================
// RAZORPAY SUBSCRIPTION WEBHOOK (RAW BODY HMAC + IDEMPOTENCY)
// ======================================

app.post("/api/razorpay-webhook", async (req, res) => {
  try {
    const signature = String(req.headers["x-razorpay-signature"] || "").trim();
    const webhookSecret = getRazorpayWebhookSecret();

    if (!webhookSecret) {
      return res.status(503).json({
        success: false,
        message: "RAZORPAY_WEBHOOK_SECRET is not configured on the server."
      });
    }
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing x-razorpay-signature header."
      });
    }

    const rawPayload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : req.rawBody || JSON.stringify(req.body || {});

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    const sigA = Buffer.from(expectedSignature, "utf8");
    const sigB = Buffer.from(signature, "utf8");
    const isAuthentic = sigA.length === sigB.length && crypto.timingSafeEqual(sigA, sigB);

    if (!isAuthentic) {
      console.warn("[Webhook] Invalid Razorpay webhook signature rejected");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature."
      });
    }

    const eventData = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const eventType = String(eventData.event || "");
    const subEntity = eventData.payload?.subscription?.entity || null;
    const payEntity = eventData.payload?.payment?.entity || null;

    const eventId =
      String(req.headers["x-razorpay-event-id"] || "").trim() ||
      crypto
        .createHash("sha256")
        .update(`${eventType}:${subEntity?.id || ""}:${payEntity?.id || ""}:${eventData.created_at || ""}`)
        .digest("hex");

    // Idempotency check
    const store = loadAnalyticsStore();
    store.webhook_events = store.webhook_events || [];
    if (store.webhook_events.some((we) => we.event_id === eventId)) {
      return res.status(200).json({ status: "ok", deduplicated: true });
    }

    const webhookRecord = {
      event_id: eventId,
      event_type: eventType,
      subscription_id: subEntity ? subEntity.id : "",
      payment_id: payEntity ? payEntity.id : "",
      processed_at: new Date().toISOString()
    };
    store.webhook_events.unshift(webhookRecord);
    if (store.webhook_events.length > 2000) {
      store.webhook_events = store.webhook_events.slice(0, 2000);
    }
    saveAnalyticsStore(store);

    if (supabase.isSupabaseLive) {
      try {
        await supabase.from("webhook_events").upsert(webhookRecord, { onConflict: "event_id" });
      } catch (_) {}
    }

    const rzpSubId = (subEntity && subEntity.id) || (payEntity && payEntity.subscription_id) || "";
    const existingSub = rzpSubId
      ? (loadAnalyticsStore().subscriptions || []).find(
          (s) => s.razorpay_subscription_id === rzpSubId
        )
      : null;
    const notes = (subEntity && subEntity.notes) || (payEntity && payEntity.notes) || {};
    const targetUserId = (existingSub && existingSub.user_id) || notes.userId || "";
    const targetUserEmail = (existingSub && existingSub.user_email) || notes.userEmail || (payEntity && payEntity.email) || "";
    const targetPlanCode = (existingSub && existingSub.plan_code) || notes.planCode || "basic";
    const plan = SUBSCRIPTION_PLANS[targetPlanCode] || SUBSCRIPTION_PLANS.basic;

    console.log(`[Webhook] Verified event ${eventType} (sub: ${rzpSubId || "n/a"})`);

    switch (eventType) {
      case "subscription.authenticated": {
        if (rzpSubId && targetUserId) {
          await saveSubscriptionRecord({
            user_id: targetUserId,
            user_email: targetUserEmail,
            plan_code: plan.code,
            plan_name: plan.name,
            amount_inr: plan.priceInr,
            razorpay_plan_id: (subEntity && subEntity.plan_id) || "",
            razorpay_subscription_id: rzpSubId,
            razorpay_customer_id: (subEntity && subEntity.customer_id) || "",
            status: "authenticated",
            payment_verification_status:
              existingSub && existingSub.payment_verification_status === "verified"
                ? "verified"
                : "pending",
            has_access: Boolean(existingSub && existingSub.has_access),
            current_start: unixToIso(subEntity && subEntity.current_start),
            current_end: unixToIso(subEntity && subEntity.current_end),
            next_billing_date: unixToIso(subEntity && (subEntity.charge_at || subEntity.current_end))
          });
        }
        break;
      }

      case "subscription.activated":
      case "subscription.charged": {
        const paidCount = Number((subEntity && subEntity.paid_count) || 0);
        const hasVerifiedCharge = Boolean(
          (payEntity && (payEntity.status === "captured" || payEntity.status === "authorized")) ||
            paidCount >= 1
        );
        if (rzpSubId && targetUserId) {
          const nowIso = new Date().toISOString();
          const currentStart = unixToIso(subEntity && subEntity.current_start) || nowIso;
          const currentEnd = unixToIso(subEntity && subEntity.current_end) || addOneMonthIso(nowIso);
          const nextCharge = unixToIso(subEntity && (subEntity.charge_at || subEntity.current_end)) || currentEnd;

          const subSaved = await saveSubscriptionRecord({
            user_id: targetUserId,
            user_email: targetUserEmail,
            plan_code: plan.code,
            plan_name: plan.name,
            amount_inr: plan.priceInr,
            razorpay_plan_id: (subEntity && subEntity.plan_id) || "",
            razorpay_subscription_id: rzpSubId,
            razorpay_customer_id: (subEntity && subEntity.customer_id) || "",
            status: "active",
            payment_verification_status: hasVerifiedCharge ? "verified" : "pending",
            has_access: hasVerifiedCharge,
            cancel_at_period_end: false,
            current_start: currentStart,
            current_end: currentEnd,
            next_billing_date: nextCharge,
            paid_count: Math.max(1, paidCount)
          });

          if (payEntity && payEntity.id) {
            const amtInr = payEntity.amount
              ? Math.round(Number(payEntity.amount) / 100)
              : plan.priceInr;
            await recordSubscriptionPayment({
              subscription_id: subSaved.id,
              razorpay_subscription_id: rzpSubId,
              user_id: targetUserId,
              user_email: targetUserEmail,
              plan_code: plan.code,
              razorpay_payment_id: payEntity.id,
              amount_inr: amtInr,
              status: payEntity.status || "captured",
              method: payEntity.method || "autopay",
              paid_at: nowIso
            });
            logAnalyticsEvent("payment_success", {
              page: "webhook",
              amount: amtInr,
              creatorName: `${plan.name} Renewal`
            });
          }

          if (hasVerifiedCharge) {
            await syncUserAccessFlag(targetUserId, true, (subEntity && subEntity.customer_id) || "");
          }
        }
        break;
      }

      case "subscription.pending":
      case "subscription.halted": {
        if (existingSub) {
          const revoked = eventType === "subscription.halted";
          await saveSubscriptionRecord({
            ...existingSub,
            status: revoked ? "halted" : "pending",
            has_access: revoked ? false : existingSub.has_access
          });
          if (revoked) {
            await syncUserAccessFlag(existingSub.user_id, false);
          }
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.expired": {
        if (existingSub) {
          const newStatus =
            eventType === "subscription.completed"
              ? "completed"
              : eventType === "subscription.expired"
              ? "expired"
              : "cancelled";
          const endIso =
            unixToIso(subEntity && subEntity.current_end) || existingSub.current_end || null;
          const keepUntilCycleEnd =
            newStatus === "cancelled" &&
            existingSub.payment_verification_status === "verified" &&
            endIso &&
            new Date(endIso).getTime() > Date.now();

          await saveSubscriptionRecord({
            ...existingSub,
            status: newStatus,
            cancel_at_period_end: newStatus === "cancelled",
            cancelled_at: existingSub.cancelled_at || new Date().toISOString(),
            current_end: endIso,
            next_billing_date: null,
            has_access: Boolean(keepUntilCycleEnd)
          });

          if (!keepUntilCycleEnd) {
            await syncUserAccessFlag(existingSub.user_id, false);
          }
        }
        break;
      }

      case "payment.failed": {
        if (payEntity) {
          const amtInr = payEntity.amount
            ? Math.round(Number(payEntity.amount) / 100)
            : plan.priceInr;
          if (targetUserId) {
            await recordSubscriptionPayment({
              subscription_id: existingSub ? existingSub.id : "",
              razorpay_subscription_id: rzpSubId,
              user_id: targetUserId,
              user_email: targetUserEmail,
              plan_code: plan.code,
              razorpay_payment_id: payEntity.id,
              amount_inr: amtInr,
              status: "failed",
              method: payEntity.method || "autopay",
              error_reason: payEntity.error_description || payEntity.error_reason || "Payment failed"
            });
          }
          logAnalyticsEvent("payment_failed", {
            page: "pricing.html",
            amount: amtInr,
            creatorName: plan.name
          });
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing error"
    });
  }
});

// ======================================
// ENTITLEMENT & FEATURE GATING ENDPOINTS
// ======================================

app.get("/api/entitlements/check", async (req, res) => {
  try {
    const feature = String(req.query.feature || "chat").trim().toLowerCase();
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.json({
        success: true,
        authenticated: false,
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        requiredPlan: getRequiredPlanForFeature(feature),
        redirectTo: `/pricing.html?plan=${getRequiredPlanForFeature(feature)}`,
        entitlements: computeEntitlements(null)
      });
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    const allowed = checkFeatureAllowance(entitlements, feature);
    const requiredPlan = getRequiredPlanForFeature(feature);

    let reason = null;
    let redirectTo = "/pricing.html";
    if (!entitlements.hasActiveSubscription) {
      reason = entitlements.pendingMandate ? "PAYMENT_PENDING" : "SUBSCRIPTION_REQUIRED";
      redirectTo = `/pricing.html?plan=${requiredPlan}`;
    } else if (!allowed) {
      reason = "UPGRADE_REQUIRED";
      redirectTo = `/pricing.html?plan=${requiredPlan}&upgrade=1`;
    }

    return res.json({
      success: true,
      authenticated: true,
      allowed,
      reason,
      requiredPlan,
      redirectTo,
      user: sanitizeUser(user),
      subscription,
      entitlements
    });
  } catch (error) {
    return sendError(res, 500, "Unable to check entitlements.", error);
  }
});

app.post("/api/interactions/start", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { creatorId, feature } = req.body || {};
    const cleanFeature = String(feature || "chat").trim().toLowerCase();
    if (!["chat", "voice_call", "video_call"].includes(cleanFeature)) {
      return sendError(res, 400, "Invalid interaction feature.");
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    const requiredPlan = getRequiredPlanForFeature(cleanFeature);

    if (!entitlements.hasActiveSubscription) {
      return res.status(403).json({
        success: false,
        code: entitlements.pendingMandate ? "PAYMENT_PENDING" : "SUBSCRIPTION_REQUIRED",
        requiredPlan,
        redirectTo: `/pricing.html?plan=${requiredPlan}`,
        entitlements,
        message: entitlements.pendingMandate
          ? "Your AutoPay mandate is awaiting bank confirmation. Access unlocks once payment clears."
          : "Choose a Takora monthly membership plan to connect with creators."
      });
    }

    if (!checkFeatureAllowance(entitlements, cleanFeature)) {
      const featureLabel = cleanFeature === "video_call" ? "Video Calls" : "Voice Calls";
      const planInfo = SUBSCRIPTION_PLANS[requiredPlan];
      return res.status(403).json({
        success: false,
        code: "UPGRADE_REQUIRED",
        requiredPlan,
        redirectTo: `/pricing.html?plan=${requiredPlan}&upgrade=1`,
        entitlements,
        message: `${featureLabel} require the ${planInfo.name} plan (₹${planInfo.priceInr}/month) or higher. Upgrade to unlock.`
      });
    }

    let creator = null;
    if (creatorId) {
      try {
        const { data } = await supabase
          .from("creators")
          .select("id, name, category, profile_image, bio, creator_age, creator_location")
          .eq("id", String(creatorId))
          .single();
        if (data) creator = data;
      } catch (_) {}
      if (!creator && Array.isArray(memoryCreatorsCache)) {
        creator = memoryCreatorsCache.find((c) => String(c.id) === String(creatorId)) || null;
      }
    }

    const sessionRecord = {
      id: `int_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      user_id: String(user.id),
      creator_id: String(creatorId || "general"),
      creator_name: (creator && creator.name) || "Takora Partner",
      interaction_type: cleanFeature,
      plan_code: entitlements.planCode,
      created_at: new Date().toISOString()
    };

    const store = loadAnalyticsStore();
    store.interaction_sessions = store.interaction_sessions || [];
    store.interaction_sessions.unshift(sessionRecord);
    if (store.interaction_sessions.length > 2000) {
      store.interaction_sessions = store.interaction_sessions.slice(0, 2000);
    }
    saveAnalyticsStore(store);

    if (supabase.isSupabaseLive) {
      try {
        await supabase.from("interaction_sessions").insert([sessionRecord]);
      } catch (_) {}
    }

    return res.json({
      success: true,
      allowed: true,
      session: sessionRecord,
      creator,
      entitlements
    });
  } catch (error) {
    return sendError(res, 500, "Unable to start interaction session.", error);
  }
});

// ======================================
// LEGACY PER-CREATOR PAYMENT ROUTES REMOVED
// ======================================

app.post("/api/create-order", (req, res) => {
  return res.status(410).json({
    success: false,
    code: "LEGACY_PAYMENT_REMOVED",
    message:
      "Per-creator payments have been removed. Please use centralized monthly subscriptions at /api/subscriptions/create."
  });
});

app.post("/api/verify-payment", (req, res) => {
  return res.status(410).json({
    success: false,
    code: "LEGACY_PAYMENT_REMOVED",
    message:
      "Per-creator payment verification has been replaced by /api/subscriptions/verify."
  });
});

// ======================================
// SUBSCRIPTION-GATED CHAT ROUTES
// ======================================

app.post("/api/chat/verify-access", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { creatorId } = req.body || {};
    if (!creatorId) {
      return sendError(res, 400, "Creator ID is required.");
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);

    if (!entitlements.hasActiveSubscription || !entitlements.canChat) {
      return res.status(403).json({
        success: false,
        authorized: false,
        code: "SUBSCRIPTION_REQUIRED",
        redirectTo: "/pricing.html?plan=basic",
        entitlements,
        message: "An active Takora membership (Basic ₹9/mo or higher) is required to chat."
      });
    }

    let creator = null;
    try {
      const { data, error } = await supabase
        .from("creators")
        .select("id, name, category, profile_image, bio, creator_age, creator_location")
        .eq("id", String(creatorId))
        .single();
      if (!error && data) creator = data;
    } catch (_) {}
    if (!creator && Array.isArray(memoryCreatorsCache)) {
      creator = memoryCreatorsCache.find((c) => String(c.id) === String(creatorId)) || null;
    }

    return res.json({
      success: true,
      authorized: true,
      creatorId: String(creatorId),
      user: sanitizeUser(user),
      entitlements,
      creator: creator || {
        id: String(creatorId),
        name: "Takora Partner",
        category: "Conversation & Connection",
        profile_image: ""
      }
    });
  } catch (err) {
    return sendError(res, 500, "Error verifying chat access", err);
  }
});

app.post("/api/chat/messages", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { creatorId } = req.body || {};
    if (!creatorId) {
      return sendError(res, 400, "Creator ID is required.");
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    if (!entitlements.hasActiveSubscription || !entitlements.canChat) {
      return res.status(403).json({
        success: false,
        authorized: false,
        code: "SUBSCRIPTION_REQUIRED",
        message: "Active Basic, Pro, or Premium membership required to view messages."
      });
    }

    const store = loadAnalyticsStore();
    const chatMessages = (store.messages || []).filter(
      (m) =>
        String(m.creator_id) === String(creatorId) &&
        (!m.user_id || String(m.user_id) === String(user.id))
    );

    return res.json({
      success: true,
      messages: chatMessages
    });
  } catch (err) {
    return sendError(res, 500, "Error retrieving messages", err);
  }
});

app.post("/api/chat/send", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { creatorId, messageText } = req.body || {};
    if (!creatorId) {
      return sendError(res, 400, "Creator ID is required.");
    }

    const subscription = await getPrimaryUserSubscription(user.id);
    const entitlements = computeEntitlements(subscription);
    if (!entitlements.hasActiveSubscription || !entitlements.canChat) {
      return res.status(403).json({
        success: false,
        authorized: false,
        code: "SUBSCRIPTION_REQUIRED",
        message: "Active Basic, Pro, or Premium membership required to send messages."
      });
    }

    const text = String(messageText || "").trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty."
      });
    }
    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message is too long (maximum 2000 characters)."
      });
    }

    const store = loadAnalyticsStore();
    store.messages = store.messages || [];

    const newMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      creator_id: String(creatorId),
      user_id: String(user.id),
      sender_name: user.name || "You",
      text,
      timestamp: new Date().toISOString()
    };

    store.messages.push(newMessage);
    saveAnalyticsStore(store);

    logAnalyticsEvent("message_sent", {
      creatorId: String(creatorId),
      page: "chat.html"
    });

    return res.json({
      success: true,
      message: newMessage
    });
  } catch (err) {
    return sendError(res, 500, "Error sending message", err);
  }
});

// ======================================
// CREATOR DIRECTORY & ADMIN CRUD (PRESERVED)
// ======================================

let memoryCreatorsCache = [];

function getDefaultAvailableDates(seedOffset = 0) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    if ((i + seedOffset) % 2 === 0 || (i + seedOffset) % 3 === 0) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dates;
}

function getDefaultTags(category, bio) {
  const str = `${category || ""} ${bio || ""}`.toLowerCase();
  const tags = [];
  if (str.includes("food") || str.includes("dine") || str.includes("coffee") || str.includes("eat")) {
    tags.push("Coffee & Conversation", "Fine Dining");
  } else if (str.includes("design") || str.includes("art") || str.includes("creative")) {
    tags.push("Art & Museums", "Creative Talks", "Coffee & Conversation");
  } else if (str.includes("tech") || str.includes("code") || str.includes("growth")) {
    tags.push("Startup & Tech", "Evening Walk", "Coffee & Conversation");
  } else if (str.includes("student") || str.includes("science")) {
    tags.push("Coffee & Conversation", "Campus Walks", "Bookstores");
  } else {
    tags.push("Coffee & Conversation", "Fine Dining", "Casual Walk");
  }
  return tags;
}

function enrichCreator(creator, index = 0) {
  if (!creator) return creator;
  let store = {};
  try {
    store = loadAnalyticsStore();
  } catch (_) {}
  const meta = (store.creator_metadata && store.creator_metadata[String(creator.id)]) || {};

  let dates = meta.available_dates;
  if (!dates && creator.available_dates) {
    dates =
      typeof creator.available_dates === "string"
        ? (() => {
            try {
              return JSON.parse(creator.available_dates);
            } catch (_) {
              return [];
            }
          })()
        : creator.available_dates;
  }
  if (!Array.isArray(dates) || dates.length === 0) {
    const seed = (String(creator.id || "").charCodeAt(0) || 0) + index;
    dates = getDefaultAvailableDates(seed);
  }

  let tags = meta.tags;
  if (!tags && creator.tags) {
    tags =
      typeof creator.tags === "string"
        ? creator.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : creator.tags;
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    tags = getDefaultTags(creator.category, creator.bio);
  }

  return {
    ...creator,
    available_dates: dates,
    tags
  };
}

async function refreshCreatorsCache() {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      memoryCreatorsCache = data;
      return data;
    }
  } catch (err) {
    console.warn("[Cache] Supabase refresh issue:", err.message);
  }
  return null;
}

function sortCreatorsByCreatedAtDesc(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const tA = a && a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b && b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
}

refreshCreatorsCache().catch(() => {});

app.get("/api/creators", async (req, res) => {
  try {
    let fetchedData = null;
    try {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedData = sortCreatorsByCreatedAtDesc(data);
        memoryCreatorsCache = fetchedData;
      } else if (error) {
        console.warn("[Creators] Supabase query error:", error.message || error);
      }
    } catch (dbErr) {
      console.warn("[Creators] Supabase query exception:", dbErr.message);
    }

    if (fetchedData && fetchedData.length > 0) {
      const enriched = sortCreatorsByCreatedAtDesc(
        fetchedData.map((c, i) => enrichCreator(c, i))
      );
      return res.json({
        success: true,
        creators: enriched,
        source: "supabase"
      });
    }

    if (Array.isArray(memoryCreatorsCache) && memoryCreatorsCache.length > 0) {
      const enriched = sortCreatorsByCreatedAtDesc(
        memoryCreatorsCache.map((c, i) => enrichCreator(c, i))
      );
      return res.json({
        success: true,
        creators: enriched,
        source: "memory_cache"
      });
    }

    return res.json({
      success: true,
      creators: [],
      source: "empty"
    });
  } catch (error) {
    console.error("Critical error in /api/creators:", error);
    const fallback = memoryCreatorsCache.length > 0 ? memoryCreatorsCache : [];
    return res.json({
      success: true,
      creators: fallback.map((c, i) => enrichCreator(c, i)),
      source: "emergency_fallback"
    });
  }
});

app.post(
  "/api/upload-creator-image",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "Profile image is required");
      }

      const originalName = req.file.originalname || "image.jpg";
      const extension = originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "jpg";
      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
        ? extension
        : "jpg";
      const fileName = `creator_${Date.now()}_${crypto
        .randomBytes(4)
        .toString("hex")}.${safeExtension}`;

      const { error } = await supabase.storage
        .from("creator-images")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (error) {
        return sendError(res, 500, "Unable to upload profile image", error);
      }

      const { data: publicUrlData } = supabase.storage
        .from("creator-images")
        .getPublicUrl(fileName);

      return res.json({
        success: true,
        message: "Profile image uploaded successfully",
        image_url: publicUrlData.publicUrl
      });
    } catch (error) {
      return sendError(res, 500, "Image upload failed", error);
    }
  }
);

app.post("/api/creators", async (req, res) => {
  try {
    const {
      name,
      category,
      bio,
      price,
      creator_age,
      age,
      creator_location,
      location,
      profile_image
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return sendError(res, 400, "Creator name is required");
    }

    // Preserve DB compatibility if Supabase table requires non-null price column
    const numericPrice = getNumericPrice(price) || 49;
    const finalAge = creator_age !== undefined ? creator_age : age !== undefined ? age : "";
    const finalLocation =
      creator_location !== undefined ? creator_location : location !== undefined ? location : "";

    const insertPayload = {
      name: String(name).trim(),
      category: category ? String(category).trim() : "",
      bio: bio ? String(bio).trim() : "",
      price: numericPrice,
      creator_age: finalAge !== null && finalAge !== "" ? String(finalAge).trim() : "",
      creator_location:
        finalLocation !== null && finalLocation !== "" ? String(finalLocation).trim() : "",
      profile_image: profile_image || ""
    };

    const { data, error } = await supabase
      .from("creators")
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      return sendError(res, 500, "Unable to add creator", error);
    }

    if (data && Array.isArray(memoryCreatorsCache)) {
      memoryCreatorsCache.unshift(data);
    }

    return res.json({
      success: true,
      message: "Creator added successfully",
      creator: enrichCreator(data)
    });
  } catch (error) {
    return sendError(res, 500, "Creator creation failed", error);
  }
});

const handleUpdateCreator = async (req, res) => {
  const rawId = req.params.id || req.body.id || req.body.creatorId;
  const cleanId = rawId ? String(rawId).trim() : "";

  const {
    name,
    category,
    bio,
    price,
    amount,
    creator_age,
    age,
    creator_location,
    location,
    profile_image
  } = req.body || {};

  if (!cleanId) {
    return sendError(res, 400, "Creator ID is required");
  }

  try {
    const updatePayload = {};

    const rawPrice = price !== undefined && price !== null && price !== "" ? price : amount;
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
      const num = getNumericPrice(rawPrice);
      if (num !== null) updatePayload.price = num;
    }

    if (name !== undefined && String(name).trim() !== "") {
      updatePayload.name = String(name).trim();
    }
    if (category !== undefined) {
      updatePayload.category = String(category).trim();
    }
    if (bio !== undefined) {
      updatePayload.bio = String(bio).trim();
    }
    if (creator_age !== undefined || age !== undefined) {
      const val = creator_age !== undefined ? creator_age : age;
      updatePayload.creator_age = val !== null && val !== "" ? String(val).trim() : "";
    }
    if (creator_location !== undefined || location !== undefined) {
      const val = creator_location !== undefined ? creator_location : location;
      updatePayload.creator_location = val !== null && val !== "" ? String(val).trim() : "";
    }
    if (profile_image !== undefined && profile_image !== null && String(profile_image).trim() !== "") {
      updatePayload.profile_image = String(profile_image).trim();
    }

    let updatedRecord = null;
    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabase
        .from("creators")
        .update(updatePayload)
        .eq("id", cleanId)
        .select()
        .single();

      if (error) {
        const statusCode = error.code === "PGRST116" ? 404 : 500;
        return sendError(
          res,
          statusCode,
          error.code === "PGRST116"
            ? "Creator not found"
            : `Unable to update creator: ${error.message || "Database error"}`,
          error
        );
      }
      updatedRecord = data;
    } else {
      const { data } = await supabase.from("creators").select("*").eq("id", cleanId).single();
      updatedRecord = data;
    }

    if (!updatedRecord) {
      return sendError(res, 404, "Creator record not found");
    }

    if (req.body.tags !== undefined || req.body.available_dates !== undefined) {
      try {
        const store = loadAnalyticsStore();
        store.creator_metadata = store.creator_metadata || {};
        store.creator_metadata[cleanId] = store.creator_metadata[cleanId] || {};
        if (req.body.tags !== undefined) {
          store.creator_metadata[cleanId].tags = Array.isArray(req.body.tags)
            ? req.body.tags
            : String(req.body.tags)
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
        }
        if (req.body.available_dates !== undefined && Array.isArray(req.body.available_dates)) {
          store.creator_metadata[cleanId].available_dates = req.body.available_dates;
        }
        saveAnalyticsStore(store);
      } catch (metaErr) {
        console.warn("[Admin Update] Metadata save issue:", metaErr.message);
      }
    }

    const finalCreator = enrichCreator(updatedRecord);
    if (finalCreator && Array.isArray(memoryCreatorsCache)) {
      const idx = memoryCreatorsCache.findIndex((c) => String(c.id) === String(cleanId));
      if (idx !== -1) {
        memoryCreatorsCache[idx] = { ...memoryCreatorsCache[idx], ...finalCreator };
      }
    }

    return res.json({
      success: true,
      message: "Creator updated successfully",
      creator: finalCreator
    });
  } catch (error) {
    return sendError(res, 500, "Creator update failed due to server error", error);
  }
};

app.put("/api/creators/:id", handleUpdateCreator);
app.patch("/api/creators/:id", handleUpdateCreator);
app.put("/api/creators", handleUpdateCreator);
app.patch("/api/creators", handleUpdateCreator);

app.get("/api/creators/:id/dates", (req, res) => {
  const { id } = req.params;
  const store = loadAnalyticsStore();
  const meta = (store.creator_metadata && store.creator_metadata[String(id)]) || {};
  let dates = meta.available_dates;
  if (!Array.isArray(dates) || dates.length === 0) {
    const seed = String(id).charCodeAt(0) || 0;
    dates = getDefaultAvailableDates(seed);
  }
  return res.json({
    success: true,
    creatorId: id,
    available_dates: dates
  });
});

app.put("/api/creators/:id/dates", async (req, res) => {
  try {
    const { id } = req.params;
    const { available_dates } = req.body;
    if (!Array.isArray(available_dates)) {
      return sendError(res, 400, "available_dates must be an array of date strings (YYYY-MM-DD)");
    }

    const store = loadAnalyticsStore();
    store.creator_metadata = store.creator_metadata || {};
    store.creator_metadata[String(id)] = {
      ...(store.creator_metadata[String(id)] || {}),
      available_dates
    };
    saveAnalyticsStore(store);

    if (Array.isArray(memoryCreatorsCache)) {
      const idx = memoryCreatorsCache.findIndex((c) => String(c.id) === String(id));
      if (idx !== -1) {
        memoryCreatorsCache[idx].available_dates = available_dates;
      }
    }

    try {
      await supabase
        .from("creators")
        .update({ available_dates: JSON.stringify(available_dates) })
        .eq("id", id);
    } catch (_) {}

    return res.json({
      success: true,
      message: "Available dates updated successfully",
      creatorId: id,
      available_dates
    });
  } catch (err) {
    return sendError(res, 500, "Failed to update available dates", err);
  }
});

app.delete("/api/creators/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("creators")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return sendError(res, 500, "Unable to delete creator", error);
    }

    if (Array.isArray(memoryCreatorsCache)) {
      memoryCreatorsCache = memoryCreatorsCache.filter((c) => String(c.id) !== String(id));
    }

    return res.json({
      success: true,
      message: "Creator deleted successfully",
      creator: data
    });
  } catch (error) {
    return sendError(res, 500, "Creator deletion failed", error);
  }
});

// ======================================
// ANALYTICS & SUBSCRIPTION METRICS ENGINE
// ======================================

function logAnalyticsEvent(type, details = {}) {
  try {
    const store = loadAnalyticsStore();
    store.events = store.events || [];

    const event = {
      id: "evt_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex"),
      type: String(type || "page_view"),
      visitorId: details.visitorId ? String(details.visitorId) : "v_anon",
      sessionId: details.sessionId ? String(details.sessionId) : null,
      isNewVisitor: details.isNewVisitor !== undefined ? !!details.isNewVisitor : false,
      page: details.page ? String(details.page) : "creator_home.html",
      title: details.title ? String(details.title) : "",
      creatorId: details.creatorId ? String(details.creatorId) : null,
      creatorName: details.creatorName ? String(details.creatorName) : null,
      buttonName: details.buttonName ? String(details.buttonName) : null,
      amount: details.amount !== undefined && details.amount !== null ? Number(details.amount) : null,
      source: details.source ? String(details.source) : "Direct",
      referrer: details.referrer ? String(details.referrer) : "",
      timestamp: details.timestamp || new Date().toISOString()
    };

    if (type !== "heartbeat") {
      store.events.push(event);
      if (store.events.length > 10000) {
        store.events = store.events.slice(-10000);
      }
    }

    const sId = details.sessionId || event.visitorId;
    if (sId) {
      store.active_sessions = store.active_sessions || {};
      store.active_sessions[sId] = {
        visitorId: event.visitorId,
        lastSeen: event.timestamp,
        page: event.page,
        creatorId: event.creatorId,
        source: event.source
      };
    }

    if (event.visitorId && event.visitorId !== "v_anon") {
      const today = event.timestamp.slice(0, 10);
      store.active_users = store.active_users || [];
      if (!store.active_users.some((u) => u.userId === event.visitorId && u.date === today)) {
        store.active_users.push({
          userId: event.visitorId,
          date: today,
          timestamp: event.timestamp
        });
        if (store.active_users.length > 5000) {
          store.active_users = store.active_users.slice(-5000);
        }
      }
    }

    saveAnalyticsStore(store);
    return event;
  } catch (e) {
    console.warn("Failed to log analytics event:", e.message);
    return null;
  }
}

app.post("/api/analytics/event", (req, res) => {
  try {
    const {
      type,
      visitorId,
      sessionId,
      isNewVisitor,
      page,
      title,
      creatorId,
      creatorName,
      buttonName,
      amount,
      source,
      referrer,
      timestamp
    } = req.body || {};

    if (!type || typeof type !== "string") {
      return res.status(400).json({ success: false, message: "Event type required" });
    }

    const event = logAnalyticsEvent(type, {
      visitorId,
      sessionId,
      isNewVisitor,
      page,
      title,
      creatorId,
      creatorName,
      buttonName,
      amount,
      source,
      referrer,
      timestamp
    });

    return res.json({ success: true, eventId: event ? event.id : null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/analytics/ping", (req, res) => {
  try {
    const { userId, sessionId, page } = req.body || {};
    if (!userId || typeof userId !== "string" || userId.length > 100) {
      return res.json({ success: true, recorded: false });
    }
    logAnalyticsEvent("heartbeat", {
      visitorId: userId,
      sessionId: sessionId || null,
      page: page || "creator_home.html"
    });
    return res.json({ success: true, recorded: true });
  } catch (e) {
    return res.json({ success: true, error: e.message });
  }
});

function getRelativeTimeString(dateStr) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 10) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (_) {
    return "Recently";
  }
}

app.get("/api/analytics", async (req, res) => {
  try {
    const period = String(req.query.period || "7d").toLowerCase();
    const store = loadAnalyticsStore();
    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = now.toISOString().slice(0, 10);

    const fiveMinutesCutoff = nowMs - 5 * 60 * 1000;
    const thirtyMinutesCutoff = nowMs - 30 * 60 * 1000;
    const activeSessionsMap = store.active_sessions || {};
    const liveVisitorIds = new Set();
    let liveActiveSessionsCount = 0;

    for (const [sId, sess] of Object.entries(activeSessionsMap)) {
      const lastSeenMs = new Date(sess.lastSeen || 0).getTime();
      if (lastSeenMs >= fiveMinutesCutoff) {
        liveVisitorIds.add(sess.visitorId || sId);
        liveActiveSessionsCount++;
      } else if (lastSeenMs < thirtyMinutesCutoff) {
        delete activeSessionsMap[sId];
      }
    }
    (store.events || []).forEach((e) => {
      const eMs = new Date(e.timestamp || 0).getTime();
      if (eMs >= fiveMinutesCutoff && e.visitorId && e.visitorId !== "v_anon") {
        liveVisitorIds.add(e.visitorId);
      }
    });
    const liveActiveUsersCount = liveVisitorIds.size;

    const todayEvents = (store.events || []).filter(
      (e) => (e.timestamp || "").slice(0, 10) === todayStr
    );
    const todayVisitorsSet = new Set(todayEvents.map((e) => e.visitorId).filter(Boolean));
    const todayNewVisitorsSet = new Set(
      todayEvents.filter((e) => e.isNewVisitor).map((e) => e.visitorId).filter(Boolean)
    );
    const visitorsToday = todayVisitorsSet.size;
    const newVisitorsToday = todayNewVisitorsSet.size;
    const returningVisitorsToday = Math.max(0, visitorsToday - newVisitorsToday);
    const pageViewsToday = todayEvents.filter((e) => e.type === "page_view").length;

    let daysToInclude = 7;
    if (period === "today") daysToInclude = 1;
    else if (period === "30d") daysToInclude = 30;
    else if (period === "lifetime") daysToInclude = 365;

    const periodCutoffMs =
      period === "today"
        ? new Date(todayStr + "T00:00:00").getTime()
        : period === "lifetime"
        ? 0
        : nowMs - daysToInclude * 86400000;

    const timelineLength = period === "today" ? 1 : Math.min(daysToInclude, 30);
    const timelineKeys = [];
    for (let i = timelineLength - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400000);
      timelineKeys.push(d.toISOString().slice(0, 10));
    }

    const allEvents = store.events || [];
    const periodEvents = allEvents.filter(
      (e) => new Date(e.timestamp || 0).getTime() >= periodCutoffMs
    );

    // Real Subscription Metrics (Strictly computed from actual subscription & payment records)
    let allSubs = store.subscriptions || [];
    let allSubPayments = store.subscription_payments || [];
    let allRegisteredUsers = store.users || [];

    if (supabase.isSupabaseLive) {
      try {
        const [sbSubs, sbPays, sbUsers] = await Promise.all([
          supabase.from("subscriptions").select("*"),
          supabase.from("subscription_payments").select("*"),
          supabase.from("users").select("id, name, email, created_at")
        ]);
        if (Array.isArray(sbSubs.data) && sbSubs.data.length > 0) allSubs = sbSubs.data;
        if (Array.isArray(sbPays.data) && sbPays.data.length > 0) allSubPayments = sbPays.data;
        if (Array.isArray(sbUsers.data) && sbUsers.data.length > 0) allRegisteredUsers = sbUsers.data;
      } catch (_) {}
    }

    const activeSubs = allSubs.filter((s) => computeEntitlements(s).hasActiveSubscription);
    const planCounts = { basic: 0, pro: 0, premium: 0 };
    let mrr = 0;
    activeSubs.forEach((s) => {
      const code = s.plan_code;
      if (planCounts[code] !== undefined) planCounts[code]++;
      const plan = SUBSCRIPTION_PLANS[code];
      mrr += plan ? plan.priceInr : Number(s.amount_inr || 0);
    });

    const cancelledSubscriptions = allSubs.filter(
      (s) => s.status === "cancelled" || s.cancel_at_period_end === true
    ).length;
    const haltedSubscriptions = allSubs.filter((s) => s.status === "halted").length;

    const verifiedSubPayments = allSubPayments.filter(
      (p) => p.status === "captured" || p.status === "authorized" || p.status === "verified"
    );
    const failedSubPayments = allSubPayments.filter((p) => p.status === "failed");

    let periodSubscriptionRevenue = 0;
    let lifetimeSubscriptionRevenue = 0;
    let todaySubscriptionRevenue = 0;

    verifiedSubPayments.forEach((p) => {
      const amt = Number(p.amount_inr || 0);
      const pMs = new Date(p.paid_at || p.created_at || 0).getTime();
      const pDateStr = new Date(pMs).toISOString().slice(0, 10);
      lifetimeSubscriptionRevenue += amt;
      if (pMs >= periodCutoffMs) periodSubscriptionRevenue += amt;
      if (pDateStr === todayStr) todaySubscriptionRevenue += amt;
    });

    const uniqueSubscriberIds = new Set(allSubs.map((s) => s.user_id).filter(Boolean));
    const totalPaymentAttempts = verifiedSubPayments.length + failedSubPayments.length;
    const paymentSuccessRate =
      totalPaymentAttempts > 0
        ? Math.round((verifiedSubPayments.length / totalPaymentAttempts) * 100)
        : 100;

    // Visitor metrics
    const allUniqueVisitorsSet = new Set();
    const allSessionsSet = new Set();
    allEvents.forEach((e) => {
      if (e.visitorId && e.visitorId !== "v_anon") allUniqueVisitorsSet.add(e.visitorId);
      if (e.sessionId) allSessionsSet.add(e.sessionId);
    });
    (store.active_users || []).forEach((u) => {
      if (u.userId) allUniqueVisitorsSet.add(u.userId);
    });

    const periodUsersSet = new Set(periodEvents.map((e) => e.visitorId).filter(Boolean));
    const periodActiveUsers = periodUsersSet.size;

    // Timeline Series
    const usersByDate = {};
    const viewsByDate = {};
    const revenueByDate = {};
    const paymentsByDate = {};

    timelineKeys.forEach((k) => {
      usersByDate[k] = new Set();
      viewsByDate[k] = 0;
      revenueByDate[k] = 0;
      paymentsByDate[k] = 0;
    });

    periodEvents.forEach((e) => {
      const d = (e.timestamp || "").slice(0, 10);
      if (usersByDate[d] && e.visitorId) usersByDate[d].add(e.visitorId);
      if (viewsByDate[d] !== undefined && e.type === "page_view") viewsByDate[d]++;
    });

    verifiedSubPayments.forEach((p) => {
      const d = (p.paid_at || p.created_at || "").slice(0, 10);
      if (revenueByDate[d] !== undefined) {
        revenueByDate[d] += Number(p.amount_inr || 0);
        paymentsByDate[d] += 1;
      }
    });

    const timeline = timelineKeys.map((dateKey) => {
      const dateObj = new Date(dateKey + "T00:00:00");
      const label =
        period === "today"
          ? "Today"
          : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateKey,
        label,
        activeUsers: usersByDate[dateKey] ? usersByDate[dateKey].size : 0,
        pageViews: viewsByDate[dateKey] || 0,
        revenue: revenueByDate[dateKey] || 0,
        paymentsCount: paymentsByDate[dateKey] || 0
      };
    });

    const subscriptionTransactions = allSubPayments
      .slice(0, 40)
      .map((p) => ({
        id: p.id,
        razorpay_payment_id: p.razorpay_payment_id || "",
        razorpay_subscription_id: p.razorpay_subscription_id || "",
        user_email: p.user_email || "",
        plan_code: p.plan_code || "basic",
        amount_inr: Number(p.amount_inr || 0),
        status: p.status || "pending",
        method: p.method || "autopay",
        error_reason: p.error_reason || "",
        paid_at: p.paid_at || p.created_at
      }));

    return res.json({
      success: true,
      period,
      trackingStarted: store.tracking_started || new Date().toISOString().slice(0, 10),
      lastUpdated: now.toISOString(),
      live: {
        activeUsers: liveActiveUsersCount,
        activeSessions: liveActiveSessionsCount,
        visitorsToday,
        newVisitorsToday,
        returningVisitorsToday,
        pageViewsToday,
        lastUpdated: now.toISOString()
      },
      users: {
        registeredUsers: allRegisteredUsers.length,
        lifetimeUniqueVisitors: allUniqueVisitorsSet.size,
        totalSessions: allSessionsSet.size,
        periodActiveUsers
      },
      subscriptions: {
        totalSubscribers: uniqueSubscriberIds.size,
        activeSubscriptions: activeSubs.length,
        planCounts,
        mrr,
        totalSubscriptionRevenue: lifetimeSubscriptionRevenue,
        periodSubscriptionRevenue,
        todaySubscriptionRevenue,
        successfulSubscriptionPayments: verifiedSubPayments.length,
        failedSubscriptionPayments: failedSubPayments.length,
        cancelledSubscriptions,
        haltedSubscriptions,
        paymentSuccessRate,
        subscriptionTransactions
      },
      revenue: {
        lifetimeRevenue: lifetimeSubscriptionRevenue,
        todayRevenue: todaySubscriptionRevenue,
        periodRevenue: periodSubscriptionRevenue,
        totalSuccessfulPayments: verifiedSubPayments.length,
        paidOrders: verifiedSubPayments.length,
        totalOrders: allSubs.length,
        failedPayments: failedSubPayments.length,
        paymentSuccessRate,
        netRevenue: lifetimeSubscriptionRevenue,
        currency: "INR"
      },
      timeline,
      recentEvents: allEvents.slice(-25).reverse().map((e) => ({
        id: e.id,
        type: e.type,
        page: e.page,
        amount: e.amount,
        creatorName: e.creatorName,
        timestamp: e.timestamp,
        relativeTime: getRelativeTimeString(e.timestamp)
      }))
    });
  } catch (err) {
    return sendError(res, 500, "Error compiling analytics", err);
  }
});

// ======================================
// 404 ROUTE
// ======================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// Express JSON error handler so unhandled rejections or malformed JSON never return HTML 500
app.use((err, req, res, _next) => {
  const statusCode = Number(err && (err.statusCode || err.status)) || 500;
  console.error("[Express Error]", err && (err.stack || err.message || err));
  if (res.headersSent) return;
  res.status(statusCode).json({
    success: false,
    message: (err && err.message) || "Unexpected server error."
  });
});

// ======================================
// START SERVER
// ======================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Takora backend running on http://0.0.0.0:${PORT}`);
});
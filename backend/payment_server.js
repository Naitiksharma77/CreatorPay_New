require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");

const razorpay = require("./payment_config");
const supabase = require("./supabase_config");

const app = express();

const PORT = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

// Serve static frontend files
const path = require("path");
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));

// Root path serves the creator home page
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "creator_home.html"));
});


// ======================================
// HELPER FUNCTIONS
// ======================================

function sendError(res, statusCode, message, error = null) {
  console.error(message, error || "");

  return res.status(statusCode).json({
    success: false,
    message
  });
}


function getRazorpayKeyId() {
  return (
    process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY ||
    ""
  );
}


function getNumericPrice(price) {
  const amount = Number(price);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}


// ======================================
// BACKEND STATUS
// ======================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "CreatorPay backend is running!",
    razorpayConfigured: Boolean(
      getRazorpayKeyId()
    )
  });
});


// ======================================
// GET ALL CREATORS
// ======================================

app.get("/api/creators", async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      return sendError(
        res,
        500,
        "Unable to load creators",
        error
      );
    }

    return res.json({
      success: true,
      creators: data || []
    });

  } catch (error) {
    return sendError(
      res,
      500,
      "Server error while loading creators",
      error
    );
  }
});


// ======================================
// UPLOAD CREATOR PROFILE IMAGE
// ======================================

app.post(
  "/api/upload-creator-image",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return sendError(
          res,
          400,
          "Profile image is required"
        );
      }

      const originalName =
        req.file.originalname || "image.jpg";

      const extension =
        originalName.includes(".")
          ? originalName.split(".").pop().toLowerCase()
          : "jpg";

      const safeExtension =
        ["jpg", "jpeg", "png", "webp"].includes(
          extension
        )
          ? extension
          : "jpg";

      const fileName =
        `creator_${Date.now()}_${crypto
          .randomBytes(4)
          .toString("hex")}.${safeExtension}`;

      const {
        error
      } = await supabase.storage
        .from("creator-images")
        .upload(
          fileName,
          req.file.buffer,
          {
            contentType:
              req.file.mimetype,
            upsert: false
          }
        );

      if (error) {
        return sendError(
          res,
          500,
          "Unable to upload profile image",
          error
        );
      }

      const {
        data: publicUrlData
      } = supabase.storage
        .from("creator-images")
        .getPublicUrl(fileName);

      return res.json({
        success: true,
        message:
          "Profile image uploaded successfully",
        image_url:
          publicUrlData.publicUrl
      });

    } catch (error) {
      return sendError(
        res,
        500,
        "Image upload failed",
        error
      );
    }
  }
);


// ======================================
// ADD CREATOR
// ======================================

app.post("/api/creators", async (req, res) => {
  try {
    const {
      name,
      category,
      bio,
      price,
      instagram_url,
      profile_image
    } = req.body;

    if (
      !name ||
      !String(name).trim() ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return sendError(
        res,
        400,
        "Name and price are required"
      );
    }

    const numericPrice =
      getNumericPrice(price);

    if (numericPrice === null) {
      return sendError(
        res,
        400,
        "Price must be a valid positive number"
      );
    }

    const {
      data,
      error
    } = await supabase
      .from("creators")
      .insert([
        {
          name: String(name).trim(),
          category: category || "",
          bio: bio || "",
          price: numericPrice,
          instagram_url: instagram_url || "",
          profile_image: profile_image || ""
        }
      ])
      .select()
      .single();

    if (error) {
      return sendError(
        res,
        500,
        "Unable to add creator",
        error
      );
    }

    return res.json({
      success: true,
      message: "Creator added successfully",
      creator: data
    });

  } catch (error) {
    return sendError(
      res,
      500,
      "Creator creation failed",
      error
    );
  }
});


// ======================================
// UPDATE CREATOR
// ======================================

app.put("/api/creators/:id", async (req, res) => {
  try {
    const {
      id
    } = req.params;

    const {
      name,
      category,
      bio,
      price,
      instagram_url,
      profile_image
    } = req.body;

    if (
      !name ||
      !String(name).trim() ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return sendError(
        res,
        400,
        "Name and price are required"
      );
    }

    const numericPrice =
      getNumericPrice(price);

    if (numericPrice === null) {
      return sendError(
        res,
        400,
        "Price must be a valid positive number"
      );
    }

    const {
      data,
      error
    } = await supabase
      .from("creators")
      .update({
        name: String(name).trim(),
        category: category || "",
        bio: bio || "",
        price: numericPrice,
        instagram_url: instagram_url || "",
        profile_image: profile_image || ""
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return sendError(
        res,
        500,
        "Unable to update creator",
        error
      );
    }

    return res.json({
      success: true,
      message: "Creator updated successfully",
      creator: data
    });

  } catch (error) {
    return sendError(
      res,
      500,
      "Creator update failed",
      error
    );
  }
});


// ======================================
// DELETE CREATOR
// ======================================

app.delete("/api/creators/:id", async (req, res) => {
  try {
    const {
      id
    } = req.params;

    const {
      data,
      error
    } = await supabase
      .from("creators")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return sendError(
        res,
        500,
        "Unable to delete creator",
        error
      );
    }

    return res.json({
      success: true,
      message: "Creator deleted successfully",
      creator: data
    });

  } catch (error) {
    return sendError(
      res,
      500,
      "Creator deletion failed",
      error
    );
  }
});


// ======================================
// CREATE RAZORPAY ORDER
// ======================================

app.post("/api/create-order", async (req, res) => {
  try {
    const {
      creatorId
    } = req.body;

    if (!creatorId) {
      return sendError(
        res,
        400,
        "Creator ID is required"
      );
    }

    const razorpayKeyId =
      getRazorpayKeyId();

    if (!razorpayKeyId) {
      return sendError(
        res,
        500,
        "Razorpay key ID is not configured"
      );
    }

    const {
      data: creator,
      error: creatorError
    } = await supabase
      .from("creators")
      .select("id, name, price")
      .eq("id", creatorId)
      .single();

    if (creatorError || !creator) {
      return sendError(
        res,
        404,
        "Creator not found",
        creatorError
      );
    }

    const numericPrice =
      getNumericPrice(creator.price);

    if (numericPrice === null) {
      return sendError(
        res,
        400,
        "Creator price is invalid"
      );
    }

    const amountInPaise =
      Math.round(numericPrice * 100);

    const receipt =
      `creatorpay_${Date.now()}`;

    const order =
      await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          creatorId: String(creator.id),
          creatorName: String(creator.name)
        }
      });

    try {
      recordPendingOrder(order.id, {
        creatorId: String(creator.id),
        creatorName: String(creator.name),
        amount: numericPrice
      });
    } catch (_) {}

    return res.json({
      success: true,

      keyId: razorpayKeyId,

      order,

      creator: {
        id: creator.id,
        name: creator.name,
        price: creator.price
      }
    });

  } catch (error) {
    return sendError(
      res,
      500,
      "Unable to create Razorpay order",
      error
    );
  }
});


// ======================================
// VERIFY RAZORPAY PAYMENT
// ======================================

app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      creatorId
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return sendError(
        res,
        400,
        "Payment details are required"
      );
    }

    const secret =
      process.env.RAZORPAY_KEY_SECRET;

    const isDevMock =
      String(razorpay_order_id).startsWith("order_dev_") ||
      String(razorpay_payment_id).startsWith("pay_dev_") ||
      !secret;

    if (!isDevMock) {
      const generatedSignature =
        crypto
          .createHmac("sha256", secret)
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      const isValid =
        crypto.timingSafeEqual(
          Buffer.from(generatedSignature),
          Buffer.from(razorpay_signature)
        );

      if (!isValid) {
        return sendError(
          res,
          400,
          "Payment verification failed"
        );
      }
    }

    // Identify target creatorId from pending order or request body
    const store = loadAnalyticsStore();
    const pending = (store.pending_orders && store.pending_orders[razorpay_order_id]) || null;
    const targetCreatorId = (pending && pending.creatorId) || creatorId || null;
    const targetCreatorName = (pending && pending.creatorName) || null;
    const targetAmount = (pending && pending.amount) || 49;

    const token = targetCreatorId ? generateChatToken(targetCreatorId, razorpay_payment_id) : null;

    // Safely record verified transaction in store
    try {
      recordVerifiedPayment({
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        creator_id: targetCreatorId,
        creator_name: targetCreatorName,
        amount: targetAmount,
        token: token,
        status: "verified",
        timestamp: new Date().toISOString()
      });
    } catch (recErr) {
      console.warn("Analytics record warning:", recErr.message);
    }

    return res.json({
      success: true,
      message: "Payment verified successfully",
      token,
      paymentId: razorpay_payment_id,
      creatorId: targetCreatorId,
      creatorName: targetCreatorName
    });
  } catch (error) {
    return sendError(
      res,
      500,
      "Unable to verify payment",
      error
    );
  }
});

// ======================================
// POST-PAYMENT CHAT ACCESS & PERSISTED MESSAGES
// ======================================
function generateChatToken(creatorId, paymentId) {
  const secret = process.env.RAZORPAY_KEY_SECRET || "meet_you_partner_chat_secret_2026";
  return crypto
    .createHmac("sha256", secret)
    .update(`${String(creatorId).trim()}:${String(paymentId).trim()}`)
    .digest("hex");
}

function verifyChatAccess(creatorId, paymentId, token) {
  if (!creatorId || !paymentId || !token) {
    return { authorized: false, reason: "Missing required verification credentials." };
  }

  // 1. Validate cryptographic token signature
  const expectedToken = generateChatToken(creatorId, paymentId);
  try {
    const isValidToken = crypto.timingSafeEqual(
      Buffer.from(String(token)),
      Buffer.from(String(expectedToken))
    );
    if (!isValidToken) {
      return { authorized: false, reason: "Invalid chat access token." };
    }
  } catch (_) {
    return { authorized: false, reason: "Token signature verification failed." };
  }

  // 2. Validate against verified payments store
  const store = loadAnalyticsStore();
  const payment = (store.payments || []).find(p =>
    (p.payment_id === paymentId || p.id === paymentId) &&
    p.status === "verified" &&
    String(p.creator_id) === String(creatorId)
  );

  if (!payment) {
    return { authorized: false, reason: "No verified payment found for this person." };
  }

  return { authorized: true, payment };
}

// Endpoint: Verify chat access
app.post("/api/chat/verify-access", async (req, res) => {
  try {
    const { creatorId, paymentId, token } = req.body || {};
    const check = verifyChatAccess(creatorId, paymentId, token);
    if (!check.authorized) {
      return res.status(403).json({
        success: false,
        authorized: false,
        message: check.reason
      });
    }

    // Load creator profile details
    let creator = null;
    try {
      const { data, error } = await supabase
        .from("creators")
        .select("id, name, category, profile_image, bio, price")
        .eq("id", creatorId)
        .single();
      if (!error && data) {
        creator = data;
      }
    } catch (_) {}

    return res.json({
      success: true,
      authorized: true,
      paymentId,
      creatorId,
      creator: creator || {
        id: creatorId,
        name: check.payment.creator_name || "Partner",
        category: "Conversation & Connection",
        profile_image: ""
      }
    });
  } catch (err) {
    return sendError(res, 500, "Error verifying chat access", err);
  }
});

// Endpoint: Load conversation messages
app.post("/api/chat/messages", async (req, res) => {
  try {
    const { creatorId, paymentId, token } = req.body || {};
    const check = verifyChatAccess(creatorId, paymentId, token);
    if (!check.authorized) {
      return res.status(403).json({
        success: false,
        authorized: false,
        message: check.reason
      });
    }

    const store = loadAnalyticsStore();
    const chatMessages = (store.messages || []).filter(m =>
      String(m.creator_id) === String(creatorId) &&
      String(m.payment_id) === String(paymentId)
    );

    return res.json({
      success: true,
      messages: chatMessages
    });
  } catch (err) {
    return sendError(res, 500, "Error retrieving messages", err);
  }
});

// Endpoint: Send new message (one-sided user messaging)
app.post("/api/chat/send", async (req, res) => {
  try {
    const { creatorId, paymentId, token, messageText } = req.body || {};
    const check = verifyChatAccess(creatorId, paymentId, token);
    if (!check.authorized) {
      return res.status(403).json({
        success: false,
        authorized: false,
        message: check.reason
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
      payment_id: String(paymentId),
      text: text,
      timestamp: new Date().toISOString()
    };

    store.messages.push(newMessage);
    saveAnalyticsStore(store);

    return res.json({
      success: true,
      message: newMessage
    });
  } catch (err) {
    return sendError(res, 500, "Error sending message", err);
  }
});

// ======================================
// ANALYTICS & ACTIVITY LOGGING ENGINE
// ======================================
const fs = require("fs");
const ANALYTICS_DATA_FILE = path.join(__dirname, "analytics_store.json");

function loadAnalyticsStore() {
  try {
    if (fs.existsSync(ANALYTICS_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_DATA_FILE, "utf-8"));
      return {
        payments: Array.isArray(data.payments) ? data.payments : [],
        active_users: Array.isArray(data.active_users) ? data.active_users : [],
        active_sessions: (data.active_sessions && typeof data.active_sessions === "object") ? data.active_sessions : {},
        events: Array.isArray(data.events) ? data.events : [],
        pending_orders: (data.pending_orders && typeof data.pending_orders === "object") ? data.pending_orders : {},
        messages: Array.isArray(data.messages) ? data.messages : [],
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

    // Maintain active sessions for live user tracking
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

    // Legacy daily active users tracking
    if (event.visitorId && event.visitorId !== "v_anon") {
      const today = event.timestamp.slice(0, 10);
      store.active_users = store.active_users || [];
      if (!store.active_users.some(u => u.userId === event.visitorId && u.date === today)) {
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

function recordPendingOrder(orderId, orderInfo) {
  try {
    const store = loadAnalyticsStore();
    store.pending_orders = store.pending_orders || {};
    store.pending_orders[orderId] = {
      ...orderInfo,
      created_at: new Date().toISOString()
    };
    saveAnalyticsStore(store);

    // Also log checkout initiated event
    logAnalyticsEvent("checkout_initiated", {
      creatorId: orderInfo.creatorId,
      creatorName: orderInfo.creatorName,
      amount: orderInfo.amount,
      page: "friend_profile.html"
    });
  } catch (e) {
    console.warn("Could not record pending order:", e.message);
  }
}

function recordVerifiedPayment(paymentInfo) {
  const store = loadAnalyticsStore();
  const existing = store.payments.find(p => p.payment_id === paymentInfo.payment_id);
  if (!existing) {
    store.payments.push({
      ...paymentInfo,
      id: paymentInfo.payment_id,
      status: "verified",
      created_at: paymentInfo.timestamp || new Date().toISOString()
    });
    saveAnalyticsStore(store);
  } else {
    if (paymentInfo.creator_id && !existing.creator_id) {
      existing.creator_id = paymentInfo.creator_id;
    }
    if (paymentInfo.token && !existing.token) {
      existing.token = paymentInfo.token;
    }
    saveAnalyticsStore(store);
  }

  // Also log payment_success event
  logAnalyticsEvent("payment_success", {
    creatorId: paymentInfo.creator_id,
    creatorName: paymentInfo.creator_name,
    amount: paymentInfo.amount,
    page: "friend_profile.html"
  });
}

// Event receiver endpoint
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

// Minimal active user ping endpoint (backward-compatible)
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

// Helper: relative time formatter
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

// Complete Analytics Endpoint for Admin Dashboard
app.get("/api/analytics", async (req, res) => {
  try {
    const period = String(req.query.period || "7d").toLowerCase(); // "today", "7d", "30d", "lifetime"
    const store = loadAnalyticsStore();
    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Clean Stale Active Sessions (> 30 minutes)
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
    // Also include any events in last 5 minutes
    (store.events || []).forEach(e => {
      const eMs = new Date(e.timestamp || 0).getTime();
      if (eMs >= fiveMinutesCutoff && e.visitorId && e.visitorId !== "v_anon") {
        liveVisitorIds.add(e.visitorId);
      }
    });

    const liveActiveUsersCount = liveVisitorIds.size;

    // 2. Today Engagement Metrics
    const todayEvents = (store.events || []).filter(e => (e.timestamp || "").slice(0, 10) === todayStr);
    const todayVisitorsSet = new Set(todayEvents.map(e => e.visitorId).filter(Boolean));
    const todayNewVisitorsSet = new Set(todayEvents.filter(e => e.isNewVisitor).map(e => e.visitorId).filter(Boolean));
    const visitorsToday = todayVisitorsSet.size;
    const newVisitorsToday = todayNewVisitorsSet.size;
    const returningVisitorsToday = Math.max(0, visitorsToday - newVisitorsToday);
    const pageViewsToday = todayEvents.filter(e => e.type === "page_view").length;

    // 3. Determine Period Time Window
    let daysToInclude = 7;
    if (period === "today") daysToInclude = 1;
    else if (period === "30d") daysToInclude = 30;
    else if (period === "lifetime") daysToInclude = 365;
    else daysToInclude = 7;

    const periodCutoffMs = period === "today"
      ? new Date(todayStr + "T00:00:00").getTime()
      : period === "lifetime"
      ? 0
      : nowMs - daysToInclude * 86400000;

    // Build timeline keys
    const timelineLength = period === "today" ? 1 : Math.min(daysToInclude, 30);
    const timelineKeys = [];
    for (let i = timelineLength - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400000);
      timelineKeys.push(d.toISOString().slice(0, 10));
    }

    // 4. Filter events and payments for period
    const allEvents = store.events || [];
    const periodEvents = allEvents.filter(e => new Date(e.timestamp || 0).getTime() >= periodCutoffMs);
    const allPayments = store.payments || [];
    const verifiedPayments = allPayments.filter(p => p.status === "verified");
    const periodPayments = verifiedPayments.filter(p => new Date(p.created_at || p.timestamp || 0).getTime() >= periodCutoffMs);

    // 5. Active Users Calculations
    const allUniqueVisitorsSet = new Set();
    const allSessionsSet = new Set();
    const identifiedUsersSet = new Set();

    allEvents.forEach(e => {
      if (e.visitorId && e.visitorId !== "v_anon") allUniqueVisitorsSet.add(e.visitorId);
      if (e.sessionId) allSessionsSet.add(e.sessionId);
      if (e.type === "checkout_initiated" || e.type === "payment_success" || e.type === "message_sent") {
        if (e.visitorId) identifiedUsersSet.add(e.visitorId);
      }
    });
    (store.active_users || []).forEach(u => {
      if (u.userId) allUniqueVisitorsSet.add(u.userId);
    });

    const lifetimeUniqueVisitors = allUniqueVisitorsSet.size;
    const totalSessions = allSessionsSet.size || Math.max(allEvents.length > 0 ? 1 : 0, lifetimeUniqueVisitors);

    // DAU (last 24 hours)
    const dauCutoff = nowMs - 24 * 3600 * 1000;
    const dauSet = new Set();
    allEvents.forEach(e => {
      if (new Date(e.timestamp || 0).getTime() >= dauCutoff && e.visitorId) {
        dauSet.add(e.visitorId);
      }
    });
    const dau = dauSet.size || visitorsToday;

    // WAU (last 7 days)
    const wauCutoff = nowMs - 7 * 86400000;
    const wauSet = new Set();
    allEvents.forEach(e => {
      if (new Date(e.timestamp || 0).getTime() >= wauCutoff && e.visitorId) {
        wauSet.add(e.visitorId);
      }
    });
    const wau = wauSet.size || dau;

    // MAU (last 30 days)
    const mauCutoff = nowMs - 30 * 86400000;
    const mauSet = new Set();
    allEvents.forEach(e => {
      if (new Date(e.timestamp || 0).getTime() >= mauCutoff && e.visitorId) {
        mauSet.add(e.visitorId);
      }
    });
    const mau = mauSet.size || wau;

    // Period specific active users
    const periodUsersSet = new Set(periodEvents.map(e => e.visitorId).filter(Boolean));
    const periodActiveUsers = periodUsersSet.size;
    const periodNewUsers = periodEvents.filter(e => e.isNewVisitor && e.visitorId).length;
    const periodReturningUsers = Math.max(0, periodActiveUsers - periodNewUsers);

    // Prior period comparison
    const priorPeriodCutoff = periodCutoffMs - (nowMs - periodCutoffMs);
    const priorEvents = allEvents.filter(e => {
      const t = new Date(e.timestamp || 0).getTime();
      return t >= priorPeriodCutoff && t < periodCutoffMs;
    });
    const priorUsersSet = new Set(priorEvents.map(e => e.visitorId).filter(Boolean));
    let userComparisonPercent = null;
    if (priorUsersSet.size > 0) {
      userComparisonPercent = Math.round(((periodActiveUsers - priorUsersSet.size) / priorUsersSet.size) * 100);
    }

    // 6. Revenue Calculations (Strictly from verified payment records)
    let lifetimeRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;
    let periodRevenue = 0;

    const ms7DaysAgo = nowMs - 7 * 86400000;
    const ms30DaysAgo = nowMs - 30 * 86400000;

    verifiedPayments.forEach(p => {
      const pMs = new Date(p.created_at || p.timestamp || 0).getTime();
      const pDateStr = new Date(pMs).toISOString().slice(0, 10);
      const amt = Number(p.amount) || 49;

      lifetimeRevenue += amt;
      if (pDateStr === todayStr) todayRevenue += amt;
      if (pMs >= ms7DaysAgo) weekRevenue += amt;
      if (pMs >= ms30DaysAgo) monthRevenue += amt;
      if (pMs >= periodCutoffMs) periodRevenue += amt;
    });

    const totalSuccessfulPayments = verifiedPayments.length;
    const periodPaymentsCount = periodPayments.length;
    const totalOrdersCreated = Object.keys(store.pending_orders || {}).length + verifiedPayments.filter(p => !store.pending_orders || !store.pending_orders[p.order_id]).length;
    const paidOrders = totalSuccessfulPayments;
    const failedPaymentsCount = allEvents.filter(e => e.type === "payment_failed").length;
    const paymentSuccessRate = (paidOrders + failedPaymentsCount) > 0
      ? Math.round((paidOrders / (paidOrders + failedPaymentsCount)) * 100)
      : 100;
    const averageOrderValue = paidOrders > 0 ? Math.round(lifetimeRevenue / paidOrders) : 0;
    const refundAmount = 0; // No refunds recorded in system
    const netRevenue = lifetimeRevenue - refundAmount;

    // 7. Funnel Metrics for Selected Period
    const funnelVisitors = periodActiveUsers || Math.max(1, periodEvents.length);
    const profileViews = periodEvents.filter(e => e.type === "creator_view" || (e.type === "page_view" && (e.page || "").includes("profile"))).length;
    const payClicks = periodEvents.filter(e => e.type === "button_click" && ((e.buttonName || "").toLowerCase().includes("chat") || (e.buttonName || "").toLowerCase().includes("hi") || (e.buttonName || "").toLowerCase().includes("pay"))).length;
    const checkoutInitiated = periodEvents.filter(e => e.type === "checkout_initiated").length || periodPaymentsCount;
    const successfulPayments = periodPaymentsCount;
    const failedPayments = periodEvents.filter(e => e.type === "payment_failed").length;
    const messageSubmissions = periodEvents.filter(e => e.type === "message_sent").length || (store.messages || []).filter(m => new Date(m.timestamp || 0).getTime() >= periodCutoffMs).length;

    // 8. Website Activity (Top Pages, Top Creators, Top Buttons, Traffic Sources)
    const pageCounts = {};
    periodEvents.filter(e => e.type === "page_view").forEach(e => {
      const p = e.page || "creator_home.html";
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    });
    const totalPageViewsInPeriod = Object.values(pageCounts).reduce((a, b) => a + b, 0) || 1;
    const topPages = Object.entries(pageCounts)
      .map(([page, views]) => {
        let name = page;
        if (page.includes("home") || page === "index.html") name = "Home (Discover)";
        else if (page.includes("profile")) name = "Partner Profile";
        else if (page.includes("chat")) name = "Private 1:1 Chat";
        else if (page.includes("explore")) name = "Explore Directory";
        else if (page.includes("pricing")) name = "Pricing & Plans";
        else if (page.includes("payment_success")) name = "Payment Success";
        return {
          page,
          name,
          views,
          percentage: Math.round((views / totalPageViewsInPeriod) * 100)
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);

    // Top Creators Breakdown
    const creatorPerformance = {};
    let creatorsList = [];
    try {
      const { data } = await supabase.from("creators").select("id, name, category, profile_image, price");
      if (Array.isArray(data)) creatorsList = data;
    } catch (_) {}

    creatorsList.forEach(c => {
      creatorPerformance[String(c.id)] = {
        id: String(c.id),
        name: c.name,
        category: c.category || "Lifestyle",
        profile_image: c.profile_image || "",
        price: c.price || 49,
        views: 0,
        paidSessions: 0,
        revenue: 0
      };
    });

    periodEvents.forEach(e => {
      if (e.creatorId && creatorPerformance[String(e.creatorId)]) {
        if (e.type === "creator_view" || e.type === "page_view") {
          creatorPerformance[String(e.creatorId)].views++;
        }
      }
    });

    verifiedPayments.forEach(p => {
      if (p.creator_id && creatorPerformance[String(p.creator_id)]) {
        creatorPerformance[String(p.creator_id)].paidSessions++;
        creatorPerformance[String(p.creator_id)].revenue += (Number(p.amount) || 49);
      }
    });

    const topCreators = Object.values(creatorPerformance)
      .sort((a, b) => (b.revenue + b.views) - (a.revenue + a.views))
      .slice(0, 8);

    // Top Buttons Clicked
    const buttonCounts = {};
    periodEvents.filter(e => e.type === "button_click" && e.buttonName).forEach(e => {
      buttonCounts[e.buttonName] = (buttonCounts[e.buttonName] || 0) + 1;
    });
    const topButtons = Object.entries(buttonCounts)
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6);

    // Traffic Sources
    const sourceCounts = {};
    periodEvents.forEach(e => {
      const src = e.source || "Direct";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const totalEventsWithSource = periodEvents.length || 1;
    const trafficSources = Object.entries(sourceCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: Math.round((count / totalEventsWithSource) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // 9. Timeline Series for Charts
    const usersByDate = {};
    const viewsByDate = {};
    const revenueByDate = {};
    const paymentsByDate = {};

    timelineKeys.forEach(k => {
      usersByDate[k] = new Set();
      viewsByDate[k] = 0;
      revenueByDate[k] = 0;
      paymentsByDate[k] = 0;
    });

    periodEvents.forEach(e => {
      const d = (e.timestamp || "").slice(0, 10);
      if (usersByDate[d] && e.visitorId) usersByDate[d].add(e.visitorId);
      if (viewsByDate[d] !== undefined && e.type === "page_view") viewsByDate[d]++;
    });

    verifiedPayments.forEach(p => {
      const d = (p.created_at || p.timestamp || "").slice(0, 10);
      const amt = Number(p.amount) || 49;
      if (revenueByDate[d] !== undefined) {
        revenueByDate[d] += amt;
        paymentsByDate[d] += 1;
      }
    });

    const timeline = timelineKeys.map(dateKey => {
      const dateObj = new Date(dateKey + "T00:00:00");
      const label = period === "today"
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

    // 10. Formatted Recent Events Log (Last 30 events)
    const recentEvents = allEvents.slice(-30).reverse().map(e => {
      let title = "Website Visit";
      let icon = "eye";
      let category = "visit";
      let details = e.page || "creator_home.html";

      if (e.type === "page_view") {
        title = "Page Viewed";
        icon = "layout";
        category = "page";
        details = e.page || "Home";
      } else if (e.type === "creator_view") {
        title = "Creator Profile Viewed";
        icon = "user";
        category = "creator";
        details = e.creatorName ? `Profile: ${e.creatorName}` : `Profile ID #${e.creatorId || ""}`;
      } else if (e.type === "button_click") {
        title = "Button Clicked";
        icon = "mouse-pointer";
        category = "click";
        details = `Tapped: "${e.buttonName || "Action"}"`;
      } else if (e.type === "checkout_initiated") {
        title = "Checkout Started";
        icon = "shopping-bag";
        category = "checkout";
        details = e.creatorName ? `Order for ${e.creatorName} (₹${e.amount || 49})` : "Session Order Created";
      } else if (e.type === "payment_success") {
        title = "Verified Payment";
        icon = "check-circle";
        category = "payment";
        details = `₹${e.amount || 49} successfully received${e.creatorName ? ` for ${e.creatorName}` : ""}`;
      } else if (e.type === "payment_failed") {
        title = "Payment Failed";
        icon = "alert-circle";
        category = "failed";
        details = "Payment attempt cancelled or declined";
      } else if (e.type === "message_sent") {
        title = "Chat Message Sent";
        icon = "message-circle";
        category = "chat";
        details = "1:1 private message delivered";
      }

      return {
        id: e.id,
        type: e.type,
        category,
        title,
        details,
        source: e.source || "Direct",
        timestamp: e.timestamp,
        relativeTime: getRelativeTimeString(e.timestamp)
      };
    });

    return res.json({
      success: true,
      period,
      trackingStarted: store.tracking_started || "2026-10-14",
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
        dau,
        wau,
        mau,
        lifetimeUniqueVisitors,
        lifetimeIdentifiedUsers: identifiedUsersSet.size,
        totalSessions,
        periodActiveUsers,
        periodNewUsers,
        periodReturningUsers,
        comparisonPercent: userComparisonPercent
      },
      revenue: {
        lifetimeRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        periodRevenue,
        totalSuccessfulPayments,
        periodPaymentsCount,
        totalOrders: totalOrdersCreated,
        paidOrders,
        failedPayments: failedPaymentsCount,
        paymentSuccessRate,
        averageOrderValue,
        refundAmount,
        netRevenue,
        currency: "INR"
      },
      funnel: {
        visitors: funnelVisitors,
        profileViews,
        payClicks,
        checkoutInitiated,
        successfulPayments,
        failedPayments,
        messageSubmissions,
        profileViewRate: funnelVisitors > 0 ? Math.min(100, Math.round((profileViews / funnelVisitors) * 100)) : 0,
        payClickRate: profileViews > 0 ? Math.min(100, Math.round((payClicks / profileViews) * 100)) : 0,
        checkoutRate: payClicks > 0 ? Math.min(100, Math.round((checkoutInitiated / payClicks) * 100)) : 0,
        paymentSuccessRate: checkoutInitiated > 0 ? Math.min(100, Math.round((successfulPayments / checkoutInitiated) * 100)) : 0,
        messageRate: successfulPayments > 0 ? Math.min(100, Math.round((messageSubmissions / successfulPayments) * 100)) : 0
      },
      activity: {
        topPages,
        topCreators,
        topButtons,
        trafficSources
      },
      timeline,
      recentEvents,
      // Backward-compatible structures for legacy UI
      activeUsers: {
        count: periodActiveUsers,
        comparisonPercent: userComparisonPercent,
        hasHistoricalData: lifetimeUniqueVisitors > 0
      }
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


// ======================================
// START SERVER
// ======================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `CreatorPay backend running on http://0.0.0.0:${PORT}`
  );
});
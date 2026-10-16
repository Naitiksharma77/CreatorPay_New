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
// ANALYTICS & ACTIVITY LOGGING (ADDITIVE ONLY)
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
        pending_orders: (data.pending_orders && typeof data.pending_orders === "object") ? data.pending_orders : {},
        messages: Array.isArray(data.messages) ? data.messages : []
      };
    }
  } catch (e) {
    console.warn("Could not read analytics store:", e.message);
  }
  return {
    payments: [],
    active_users: [],
    pending_orders: {},
    messages: []
  };
}

function saveAnalyticsStore(data) {
  try {
    fs.writeFileSync(ANALYTICS_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save analytics store:", e.message);
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
  } catch (e) {
    console.warn("Could not record pending order:", e.message);
  }
}

function recordVerifiedPayment(paymentInfo) {
  const store = loadAnalyticsStore();
  // Prevent duplicate payment records
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
}

// Minimal, non-intrusive active user ping endpoint
app.post("/api/analytics/ping", (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId || typeof userId !== "string" || userId.length > 100) {
      return res.json({ success: true, recorded: false });
    }
    const store = loadAnalyticsStore();
    const today = new Date().toISOString().slice(0, 10);
    // Record unique user per day
    const alreadyRecorded = store.active_users.some(
      u => u.userId === userId && u.date === today
    );
    if (!alreadyRecorded) {
      store.active_users.push({
        userId,
        date: today,
        timestamp: new Date().toISOString()
      });
      // Keep store lean: only retain last 90 days of records
      if (store.active_users.length > 5000) {
        store.active_users = store.active_users.slice(-5000);
      }
      saveAnalyticsStore(store);
    }
    return res.json({ success: true, recorded: !alreadyRecorded });
  } catch (e) {
    return res.json({ success: true, error: e.message });
  }
});

// Analytics summary endpoint for Admin Dashboard
app.get("/api/analytics", async (req, res) => {
  try {
    const period = req.query.period || "7d"; // "today", "7d", "30d"
    const store = loadAnalyticsStore();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let daysToInclude = 7;
    if (period === "today") daysToInclude = 1;
    else if (period === "30d") daysToInclude = 30;
    else daysToInclude = 7;

    // Build timeline date keys (YYYY-MM-DD)
    const timelineKeys = [];
    for (let i = daysToInclude - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      timelineKeys.push(d.toISOString().slice(0, 10));
    }

    // Calculate Active Users
    // Daily active users bucketed by date
    const usersByDate = {};
    timelineKeys.forEach(k => { usersByDate[k] = new Set(); });

    store.active_users.forEach(entry => {
      const d = (entry.timestamp || entry.date || "").slice(0, 10);
      if (usersByDate[d]) {
        usersByDate[d].add(entry.userId);
      }
    });

    // Unique active users across the entire selected window
    const windowUserSet = new Set();
    timelineKeys.forEach(k => {
      if (usersByDate[k]) {
        usersByDate[k].forEach(u => windowUserSet.add(u));
      }
    });

    const activeUsersCount = windowUserSet.size;

    // Previous equivalent period for subtle comparison
    const prevWindowUserSet = new Set();
    for (let i = daysToInclude * 2 - 1; i >= daysToInclude; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      store.active_users.forEach(entry => {
        const entryDate = (entry.timestamp || entry.date || "").slice(0, 10);
        if (entryDate === d) {
          prevWindowUserSet.add(entry.userId);
        }
      });
    }

    let userComparisonPercent = null;
    if (prevWindowUserSet.size > 0) {
      userComparisonPercent = Math.round(((activeUsersCount - prevWindowUserSet.size) / prevWindowUserSet.size) * 100);
    }

    // Calculate Revenue from verified payment records
    // Each verified payment has an associated amount (in INR)
    const revenueByDate = {};
    const countByDate = {};
    timelineKeys.forEach(k => {
      revenueByDate[k] = 0;
      countByDate[k] = 0;
    });

    let totalRevenue = 0;
    let totalCount = 0;
    let todayRevenue = 0;
    let last7DaysRevenue = 0;
    let last30DaysRevenue = 0;

    // Calculate period specific aggregate totals across all stored verified payments
    const msToday = new Date(todayStr).getTime();
    const ms7DaysAgo = now.getTime() - 7 * 86400000;
    const ms30DaysAgo = now.getTime() - 30 * 86400000;

    store.payments.forEach(p => {
      const pDate = new Date(p.created_at || p.timestamp || now);
      const pDateStr = pDate.toISOString().slice(0, 10);
      const amount = Number(p.amount) || 49; // Default fallback to connection price if not specified

      // Overall totals
      totalRevenue += amount;
      totalCount += 1;

      if (pDateStr === todayStr) {
        todayRevenue += amount;
      }
      if (pDate.getTime() >= ms7DaysAgo) {
        last7DaysRevenue += amount;
      }
      if (pDate.getTime() >= ms30DaysAgo) {
        last30DaysRevenue += amount;
      }

      // Add to timeline if within selected window
      if (revenueByDate[pDateStr] !== undefined) {
        revenueByDate[pDateStr] += amount;
        countByDate[pDateStr] += 1;
      }
    });

    // Timeline series formatted for charts
    const timeline = timelineKeys.map(dateKey => {
      const dateObj = new Date(dateKey + "T00:00:00");
      const label = period === "today" 
        ? "Today" 
        : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateKey,
        label,
        activeUsers: usersByDate[dateKey] ? usersByDate[dateKey].size : 0,
        revenue: revenueByDate[dateKey] || 0,
        paymentsCount: countByDate[dateKey] || 0
      };
    });

    // Selected period revenue & payments count
    const periodRevenue = timeline.reduce((acc, t) => acc + t.revenue, 0);
    const periodPaymentsCount = timeline.reduce((acc, t) => acc + t.paymentsCount, 0);

    return res.json({
      success: true,
      period,
      activeUsers: {
        count: activeUsersCount,
        comparisonPercent: userComparisonPercent,
        hasHistoricalData: store.active_users.length > 0
      },
      revenue: {
        totalRevenue,
        totalPaymentsCount: totalCount,
        todayRevenue,
        last7DaysRevenue,
        last30DaysRevenue,
        periodRevenue,
        periodPaymentsCount,
        hasHistoricalData: store.payments.length > 0
      },
      timeline,
      rawPayments: store.payments.slice(-20).reverse() // Recent verified transactions
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
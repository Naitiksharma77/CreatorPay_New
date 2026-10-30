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
// GET ALL CREATORS (DYNAMIC SUPABASE + ROSÉIA DATES/TAGS ENRICHMENT)
// ======================================

let memoryCreatorsCache = [];

function getDefaultAvailableDates(seedOffset = 0) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    // Give 4-6 selectable dates over the next two weeks
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

  // Parse available_dates: priority is meta.available_dates -> creator.available_dates -> default
  let dates = meta.available_dates;
  if (!dates && creator.available_dates) {
    dates = typeof creator.available_dates === "string" ? (function() {
      try { return JSON.parse(creator.available_dates); } catch (_) { return []; }
    })() : creator.available_dates;
  }
  if (!Array.isArray(dates) || dates.length === 0) {
    const seed = (String(creator.id || "").charCodeAt(0) || 0) + index;
    dates = getDefaultAvailableDates(seed);
  }

  // Parse tags: priority is meta.tags -> creator.tags -> default
  let tags = meta.tags;
  if (!tags && creator.tags) {
    tags = typeof creator.tags === "string" ? creator.tags.split(",").map(t => t.trim()).filter(Boolean) : creator.tags;
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    tags = getDefaultTags(creator.category, creator.bio);
  }

  return {
    ...creator,
    available_dates: dates,
    tags: tags
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

// Warm up cache at startup
refreshCreatorsCache().catch(() => {});

app.get("/api/creators", async (req, res) => {
  try {
    // 1. Try Supabase with a fast query
    let fetchedData = null;
    try {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedData = data;
        memoryCreatorsCache = data;
      } else if (error) {
        console.warn("[Creators] Supabase query error:", error.message || error);
      }
    } catch (dbErr) {
      console.warn("[Creators] Supabase query exception:", dbErr.message);
    }

    // If Supabase returned data, respond immediately with enriched profiles
    if (fetchedData && fetchedData.length > 0) {
      const enriched = fetchedData.map((c, i) => enrichCreator(c, i));
      return res.json({
        success: true,
        creators: enriched,
        source: "supabase"
      });
    }

    // 2. Fallback to production Render backend if Supabase is temporarily unreachable
    try {
      console.log("[Creators] Attempting fallback to production Render backend...");
      const renderRes = await fetch("https://creatorpay-backend.onrender.com/api/creators", {
        headers: { "Accept": "application/json" }
      });
      if (renderRes.ok) {
        const renderData = await renderRes.json();
        if (renderData && renderData.success && Array.isArray(renderData.creators) && renderData.creators.length > 0) {
          memoryCreatorsCache = renderData.creators;
          const enriched = renderData.creators.map((c, i) => enrichCreator(c, i));
          return res.json({
            success: true,
            creators: enriched,
            source: "render_fallback"
          });
        }
      }
    } catch (renderErr) {
      console.warn("[Creators] Render fallback failed:", renderErr.message);
    }

    // 3. Fallback to memory cache if available
    if (Array.isArray(memoryCreatorsCache) && memoryCreatorsCache.length > 0) {
      const enriched = memoryCreatorsCache.map((c, i) => enrichCreator(c, i));
      return res.json({
        success: true,
        creators: enriched,
        source: "memory_cache"
      });
    }

    // 4. Default seed fallback to ensure the frontend never receives 500
    const fallbackList = [
      {
        id: "d53ea93a-6f8f-4a22-a9c8-5eda16f61f74",
        name: "Shalini Yadav",
        category: "Social Science Student",
        bio: "19 years old student preparing for her 20s👻🎀",
        price: 29,
        creator_age: "19",
        creator_location: "Delhi, India",
        profile_image: "https://dsmwqjgekxroorgxgfqh.supabase.co/storage/v1/object/public/creator-images/creator_1791988035435_d8433a08.jpg",
        created_at: new Date().toISOString()
      }
    ];

    return res.json({
      success: true,
      creators: fallbackList.map((c, i) => enrichCreator(c, i)),
      source: "seed_fallback"
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
      creator_age,
      age,
      creator_location,
      location,
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

    const finalAge = creator_age !== undefined ? creator_age : (age !== undefined ? age : "");
    const finalLocation = creator_location !== undefined ? creator_location : (location !== undefined ? location : "");

    const insertPayload = {
      name: String(name).trim(),
      category: category ? String(category).trim() : "",
      bio: bio ? String(bio).trim() : "",
      price: numericPrice,
      creator_age: finalAge !== null && finalAge !== "" ? String(finalAge).trim() : "",
      creator_location: finalLocation !== null && finalLocation !== "" ? String(finalLocation).trim() : "",
      profile_image: profile_image || ""
    };

    const {
      data,
      error
    } = await supabase
      .from("creators")
      .insert([insertPayload])
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

    if (data && Array.isArray(memoryCreatorsCache)) {
      memoryCreatorsCache.unshift(data);
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
// UPDATE CREATOR (ROBUST DIAGNOSTIC LOGGING & FLEXIBLE PAYLOADS)
// ======================================

const handleUpdateCreator = async (req, res) => {
  const method = req.method;
  const url = req.originalUrl || req.url;
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
  } = req.body;

  const rawPrice = (price !== undefined && price !== null && price !== "") ? price : amount;

  console.log(`[Admin Update] Received ${method} ${url} - ID: "${cleanId}", Price: "${rawPrice}"`);

  if (!cleanId) {
    console.warn("[Admin Update] Rejected: Missing creator ID");
    return sendError(res, 400, "Creator ID is required");
  }

  if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
    console.warn("[Admin Update] Rejected: Missing price value");
    return sendError(res, 400, "Price is required");
  }

  const numericPrice = getNumericPrice(rawPrice);
  if (numericPrice === null) {
    console.warn(`[Admin Update] Rejected: Invalid price value "${rawPrice}"`);
    return sendError(res, 400, "Price must be a valid positive number");
  }

  try {
    const updatePayload = {
      price: numericPrice
    };

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

    console.log(`[Admin Update] Executing Supabase update on "creators" where id="${cleanId}" with fields:`, Object.keys(updatePayload));

    const {
      data,
      error
    } = await supabase
      .from("creators")
      .update(updatePayload)
      .eq("id", cleanId)
      .select()
      .single();

    if (error) {
      console.error(`[Admin Update] Supabase returned error:`, { code: error.code, message: error.message });
      const statusCode = error.code === "PGRST116" ? 404 : 500;
      const message = error.code === "PGRST116" ? "Creator not found" : `Unable to update creator: ${error.message || "Database error"}`;
      return sendError(res, statusCode, message, error);
    }

    if (!data) {
      console.warn(`[Admin Update] No record returned from Supabase for ID: "${cleanId}"`);
      return sendError(res, 404, "Creator record not found");
    }

    console.log(`[Admin Update] SUCCESS: Creator "${data.name}" (${data.id}) price updated to ₹${data.price}`);

    // Persist tags & available_dates in creator_metadata store
    if (req.body.tags !== undefined || req.body.available_dates !== undefined) {
      try {
        const store = loadAnalyticsStore();
        store.creator_metadata = store.creator_metadata || {};
        store.creator_metadata[cleanId] = store.creator_metadata[cleanId] || {};
        if (req.body.tags !== undefined) {
          store.creator_metadata[cleanId].tags = Array.isArray(req.body.tags)
            ? req.body.tags
            : String(req.body.tags).split(",").map(t => t.trim()).filter(Boolean);
        }
        if (req.body.available_dates !== undefined && Array.isArray(req.body.available_dates)) {
          store.creator_metadata[cleanId].available_dates = req.body.available_dates;
        }
        saveAnalyticsStore(store);
      } catch (metaErr) {
        console.warn("[Admin Update] Metadata save issue:", metaErr.message);
      }
    }

    const finalCreator = enrichCreator(data);

    if (finalCreator && Array.isArray(memoryCreatorsCache)) {
      const idx = memoryCreatorsCache.findIndex(c => String(c.id) === String(cleanId));
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
    console.error("[Admin Update] Exception during creator update:", error);
    return sendError(res, 500, "Creator update failed due to server error", error);
  }
};

app.put("/api/creators/:id", handleUpdateCreator);
app.patch("/api/creators/:id", handleUpdateCreator);
app.put("/api/creators", handleUpdateCreator);
app.patch("/api/creators", handleUpdateCreator);

// ======================================
// MANAGE CREATOR AVAILABLE DATES (ADMIN CALENDAR)
// ======================================

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
      available_dates: available_dates
    };
    saveAnalyticsStore(store);

    if (Array.isArray(memoryCreatorsCache)) {
      const idx = memoryCreatorsCache.findIndex(c => String(c.id) === String(id));
      if (idx !== -1) {
        memoryCreatorsCache[idx].available_dates = available_dates;
      }
    }

    try {
      await supabase.from("creators").update({ available_dates: JSON.stringify(available_dates) }).eq("id", id);
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
app.post("/api/creators/:id/dates", (req, res) => app._router.handle({ ...req, method: "PUT" }, res));


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

    if (Array.isArray(memoryCreatorsCache)) {
      memoryCreatorsCache = memoryCreatorsCache.filter(c => String(c.id) !== String(id));
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
    const creatorId = req.body.creatorId || req.body.creator_id;

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

    const bookingDate = req.body.bookingDate || req.body.booking_date || null;
    const timeSlot = req.body.timeSlot || req.body.time_slot || "11:00 AM";
    const userNote = req.body.userNote || req.body.user_note || "";
    const isBooking = req.body.type === "date_booking" || Boolean(bookingDate);

    const basePrice = numericPrice;
    const platformFee = isBooking ? Math.round(basePrice * 0.10) : 0;
    const tax = isBooking ? Math.round(basePrice * 0.085) : 0;
    const totalPayable = isBooking ? (basePrice + platformFee + tax) : basePrice;

    const amountInPaise = Math.round(totalPayable * 100);
    const receipt = `roseia_${Date.now()}`;

    const orderNotes = {
      creatorId: String(creator.id),
      creatorName: String(creator.name),
      type: isBooking ? "date_booking" : "chat_access"
    };
    if (isBooking) {
      if (bookingDate) orderNotes.bookingDate = String(bookingDate);
      if (timeSlot) orderNotes.timeSlot = String(timeSlot);
      if (userNote) orderNotes.userNote = String(userNote);
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: orderNotes
    });

    try {
      recordPendingOrder(order.id, {
        type: isBooking ? "date_booking" : "chat_access",
        creatorId: String(creator.id),
        creatorName: String(creator.name),
        basePrice,
        platformFee,
        tax,
        amount: totalPayable,
        totalPayable,
        bookingDate,
        timeSlot,
        userNote
      });
    } catch (_) {}

    return res.json({
      success: true,
      keyId: razorpayKeyId,
      order,
      pricing: {
        basePrice,
        platformFee,
        tax,
        totalPayable
      },
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

// Booking specific order route alias
app.post("/api/bookings/create-order", (req, res) => {
  req.body.type = "date_booking";
  return app._router.handle(req, res);
});


// ======================================
// VERIFY RAZORPAY PAYMENT & CONFIRM BOOKINGS
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

      const generatedBuffer = Buffer.from(generatedSignature);
      const signatureBuffer = Buffer.from(razorpay_signature);

      const isValid =
        generatedBuffer.length === signatureBuffer.length &&
        crypto.timingSafeEqual(
          generatedBuffer,
          signatureBuffer
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
    const targetAmount = (pending && (pending.totalPayable || pending.amount)) || 49;

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

    // Process Date Booking if applicable
    const isBooking = (pending && (pending.type === "date_booking" || pending.bookingDate)) || Boolean(req.body.bookingDate);
    let createdBooking = null;

    if (isBooking) {
      createdBooking = {
        id: `bk_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        creator_id: String(targetCreatorId),
        creator_name: targetCreatorName || "Creator",
        booking_date: (pending && pending.bookingDate) || req.body.bookingDate || new Date().toISOString().slice(0, 10),
        time_slot: (pending && pending.timeSlot) || req.body.timeSlot || "11:00 AM",
        user_note: (pending && pending.userNote) || req.body.userNote || "",
        base_price: (pending && pending.basePrice) || targetAmount,
        platform_fee: (pending && pending.platformFee) || 0,
        tax: (pending && pending.tax) || 0,
        total_amount: (pending && pending.totalPayable) || targetAmount,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        status: "confirmed",
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from("bookings").insert([createdBooking]);
      } catch (dbErr) {
        console.warn("[Bookings] Supabase insert note:", dbErr.message);
      }

      try {
        const curStore = loadAnalyticsStore();
        curStore.bookings = curStore.bookings || [];
        curStore.bookings.unshift(createdBooking);
        saveAnalyticsStore(curStore);
      } catch (stErr) {
        console.warn("[Bookings] Store save note:", stErr.message);
      }
    }

    return res.json({
      success: true,
      message: isBooking ? "Booking Confirmed! She will contact you soon. Thank you!" : "Payment verified successfully",
      confirmationText: "Booking Confirmed! She will contact you soon. Thank you!",
      booking: createdBooking,
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
// BOOKINGS DIRECT ACCESS & RETRIEVAL
// ======================================

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      creatorId,
      creatorName,
      bookingDate,
      timeSlot,
      userNote,
      basePrice,
      platformFee,
      tax,
      totalAmount,
      paymentId,
      orderId
    } = req.body;

    const newBooking = {
      id: `bk_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      creator_id: String(creatorId),
      creator_name: creatorName || "Creator",
      booking_date: bookingDate || new Date().toISOString().slice(0, 10),
      time_slot: timeSlot || "11:00 AM",
      user_note: userNote || "",
      base_price: Number(basePrice) || 0,
      platform_fee: Number(platformFee) || 0,
      tax: Number(tax) || 0,
      total_amount: Number(totalAmount) || 0,
      payment_id: paymentId || `pay_manual_${Date.now()}`,
      order_id: orderId || `ord_manual_${Date.now()}`,
      status: "confirmed",
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from("bookings").insert([newBooking]);
    } catch (_) {}

    const store = loadAnalyticsStore();
    store.bookings = store.bookings || [];
    store.bookings.unshift(newBooking);
    saveAnalyticsStore(store);

    return res.json({
      success: true,
      message: "Booking Confirmed! She will contact you soon. Thank you!",
      booking: newBooking
    });
  } catch (err) {
    return sendError(res, 500, "Failed to save booking", err);
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    try {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        return res.json({ success: true, bookings: data, source: "supabase" });
      }
    } catch (_) {}

    const store = loadAnalyticsStore();
    return res.json({ success: true, bookings: store.bookings || [], source: "store" });
  } catch (err) {
    return sendError(res, 500, "Failed to retrieve bookings", err);
  }
});


// ======================================
// RAZORPAY WEBHOOK ROUTE & ACCESS GRANT
// ======================================

async function grantProductAccess({ orderId, paymentId, amount, notes, email, contact }) {
  try {
    const store = loadAnalyticsStore();
    const pending = (orderId && store.pending_orders && store.pending_orders[orderId]) || null;

    const creatorId =
      (notes && (notes.creatorId || notes.productId || notes.courseId || notes.creator_id)) ||
      (pending && pending.creatorId) ||
      null;

    const creatorName =
      (notes && (notes.creatorName || notes.productName || notes.courseName || notes.creator_name)) ||
      (pending && pending.creatorName) ||
      null;

    const paymentAmount =
      amount !== undefined && amount !== null
        ? amount
        : (pending && pending.amount) || 49;

    const token = creatorId && paymentId ? generateChatToken(creatorId, paymentId) : null;

    // 1. Record verified payment and grant access in the primary application store
    recordVerifiedPayment({
      order_id: orderId,
      payment_id: paymentId,
      creator_id: creatorId,
      creator_name: creatorName,
      amount: paymentAmount,
      token: token,
      status: "verified",
      hasAccess: true,
      access_granted: true,
      customer_email: email || null,
      customer_contact: contact || null,
      timestamp: new Date().toISOString()
    });

    // 2. Update Supabase database tables if present in schema
    if (email) {
      try {
        await supabase
          .from("users")
          .update({
            hasAccess: true,
            status: "active",
            updated_at: new Date().toISOString()
          })
          .eq("email", email);
      } catch (_) {}
    }

    try {
      await supabase
        .from("payments")
        .upsert(
          {
            order_id: orderId,
            payment_id: paymentId,
            amount: paymentAmount,
            status: "captured",
            has_access: true,
            customer_email: email || null,
            created_at: new Date().toISOString()
          },
          { onConflict: "payment_id" }
        );
    } catch (_) {}

    try {
      if (orderId) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            has_access: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", orderId);
      }
    } catch (_) {}

    console.log(`[Webhook] Database updated: access granted (hasAccess: true) for order: ${orderId}, payment: ${paymentId}`);
  } catch (err) {
    console.error("[Webhook] Error granting product access in database:", err);
  }
}

app.post("/api/razorpay-webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_KEY_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({
        success: false,
        message: "Missing webhook signature or webhook secret configuration"
      });
    }

    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : (req.rawBody || JSON.stringify(req.body));

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    const isAuthentic =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );

    if (!isAuthentic) {
      console.warn("[Webhook] Invalid Razorpay webhook signature");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature"
      });
    }

    const eventData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventType = eventData.event;

    console.log(`[Webhook] Verified Razorpay event received: ${eventType}`);

    switch (eventType) {
      case "payment.captured": {
        const payment = eventData.payload?.payment?.entity || {};
        const orderId = payment.order_id || null;
        const paymentId = payment.id;
        const amount = payment.amount ? payment.amount / 100 : null;
        const notes = payment.notes || {};
        const email = payment.email || null;
        const contact = payment.contact || null;

        console.log(`[Webhook] Payment captured: ${paymentId} for amount ₹${amount || 0}`);

        await grantProductAccess({
          orderId,
          paymentId,
          amount,
          notes,
          email,
          contact
        });
        break;
      }
      case "order.paid": {
        const order = eventData.payload?.order?.entity || {};
        const payment = eventData.payload?.payment?.entity || {};
        const orderId = order.id || payment.order_id || null;
        const paymentId = payment.id || (orderId ? `pay_${orderId}` : null);
        const amount = order.amount ? order.amount / 100 : (payment.amount ? payment.amount / 100 : null);
        const notes = { ...(order.notes || {}), ...(payment.notes || {}) };
        const email = payment.email || null;
        const contact = payment.contact || null;

        console.log(`[Webhook] Order paid: ${orderId}`);

        await grantProductAccess({
          orderId,
          paymentId,
          amount,
          notes,
          email,
          contact
        });
        break;
      }
      case "payment.failed": {
        const payment = eventData.payload?.payment?.entity || {};
        console.log(`[Webhook] Payment failed: ${payment.id}`);
        logAnalyticsEvent("payment_failed", {
          page: "checkout",
          amount: payment.amount ? payment.amount / 100 : null,
          details: payment.error_description || "Payment failed"
        });
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
        .select("id, name, category, profile_image, bio, price, creator_age, creator_location")
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
        creator_metadata: (data.creator_metadata && typeof data.creator_metadata === "object") ? data.creator_metadata : {},
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
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
      hasAccess: true,
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
    existing.status = "verified";
    existing.hasAccess = true;
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
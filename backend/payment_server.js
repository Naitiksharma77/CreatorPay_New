require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");

const razorpay = require("./payment_config");
const supabase = require("./supabase_config");

const app = express();

const PORT = process.env.PORT || 5000;

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
      razorpay_signature
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

    if (!secret) {
      return sendError(
        res,
        500,
        "Razorpay secret is not configured"
      );
    }

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

    return res.json({
      success: true,
      message:
        "Payment verified successfully"
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

app.listen(PORT, () => {
  console.log(
    `CreatorPay backend running on port ${PORT}`
  );
});
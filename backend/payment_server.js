const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const razorpay = require("./payment_config");
const supabase = require("./supabase_config");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage()
});

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());


// Backend status
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "CreatorPay backend is running!"
  });
});


// Get all creators
app.get("/api/creators", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Supabase fetch error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load creators"
      });
    }

    res.json({
      success: true,
      creators: data
    });

  } catch (error) {
    console.error("Creators GET API error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// Upload creator profile image
app.post(
  "/api/upload-creator-image",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Profile image is required"
        });
      }

      const fileExtension =
        req.file.originalname.split(".").pop();

      const fileName =
        `creator_${Date.now()}.${fileExtension}`;

      const { error } = await supabase.storage
        .from("creator-images")
        .upload(
          fileName,
          req.file.buffer,
          {
            contentType: req.file.mimetype,
            upsert: false
          }
        );

      if (error) {
        console.error(
          "Storage upload error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to upload profile image",
          error: error.message
        });
      }

      const { data: publicUrlData } =
        supabase.storage
          .from("creator-images")
          .getPublicUrl(fileName);

      res.json({
        success: true,
        message: "Profile image uploaded successfully",
        image_url: publicUrlData.publicUrl
      });

    } catch (error) {
      console.error(
        "Image upload API error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
);


// Add creator
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

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required"
      });
    }

    const { data, error } = await supabase
      .from("creators")
      .insert([
        {
          name,
          category,
          bio,
          price,
          instagram_url,
          profile_image
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(
        "Supabase creator error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to add creator",
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    res.json({
      success: true,
      message: "Creator added successfully",
      creator: data
    });

  } catch (error) {
    console.error(
      "Creator API error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// Update creator
app.put("/api/creators/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      category,
      bio,
      price,
      instagram_url,
      profile_image
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required"
      });
    }

    const { data, error } = await supabase
      .from("creators")
      .update({
        name,
        category,
        bio,
        price,
        instagram_url,
        profile_image
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(
        "Supabase creator update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update creator",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Creator updated successfully",
      creator: data
    });

  } catch (error) {
    console.error(
      "Creator update API error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// Delete creator
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
      console.error(
        "Supabase creator delete error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to delete creator",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Creator deleted successfully",
      creator: data
    });

  } catch (error) {
    console.error(
      "Creator delete API error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// Create Razorpay order using Supabase saved price
app.post("/api/create-order", async (req, res) => {
  try {
    const { creatorId } = req.body;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        message: "Creator ID is required"
      });
    }

    // Get creator details from Supabase
    const {
      data: creator,
      error: creatorError
    } = await supabase
      .from("creators")
      .select("id, name, price")
      .eq("id", creatorId)
      .single();

    if (creatorError || !creator) {
      console.error(
        "Creator lookup error:",
        creatorError
      );

      return res.status(404).json({
        success: false,
        message: "Creator not found"
      });
    }

    const numericAmount =
      Number(creator.price);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Creator price is invalid"
      });
    }

    const order =
      await razorpay.orders.create({
        amount: Math.round(
          numericAmount * 100
        ),
        currency: "INR",
        receipt:
          `creatorpay_${Date.now()}`
      });

    res.json({
      success: true,
      order,
      creator: {
        id: creator.id,
        name: creator.name,
        price: creator.price
      }
    });

  } catch (error) {
    console.error(
      "Razorpay order error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order"
    });
  }
});


// Verify Razorpay payment signature
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
      return res.status(400).json({
        success: false,
        message: "Payment details are required"
      });
    }

    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    const isValid =
      generatedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    res.json({
      success: true,
      message: "Payment verified successfully"
    });

  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to verify payment"
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(
    `CreatorPay backend running on http://localhost:${PORT}`
  );
});
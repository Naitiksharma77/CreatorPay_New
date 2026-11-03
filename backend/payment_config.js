require("dotenv").config();

const Razorpay = require("razorpay");

let razorpay = null;

const key_id = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || "rzp_live_TbMnvmib0JVGT3";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "MhPRkHx2ltMPb3lNvrFpJ8qp";

if (key_id && key_secret) {
  try {
    razorpay = new Razorpay({
      key_id,
      key_secret
    });
  } catch (err) {
    console.warn("[Razorpay] Initialization warning:", err.message);
  }
} else {
  console.log("[Razorpay] Running in dev/demo mode (keys not provided)");
  razorpay = {
    orders: {
      create: async (params) => {
        return {
          id: `order_dev_${Date.now()}`,
          entity: "order",
          amount: params.amount || 4900,
          currency: params.currency || "INR",
          receipt: params.receipt || "rcpt_dev",
          status: "created"
        };
      }
    }
  };
}

module.exports = razorpay;
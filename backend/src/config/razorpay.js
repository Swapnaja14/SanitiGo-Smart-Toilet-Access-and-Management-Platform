import Razorpay from "razorpay";
import logger from "./logger.js";

let razorpayInstance = null;

export const getRazorpayInstance = () => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    logger.warn("[Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured.");
    return null;
  }

  razorpayInstance = new Razorpay({
    key_id,
    key_secret,
  });

  return razorpayInstance;
};

export default getRazorpayInstance;

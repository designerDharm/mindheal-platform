import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();

let razorpayInstance = null;

try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    const message = "Razorpay keys missing. Payment gateway will run in mock mode outside production.";
    if (process.env.NODE_ENV === "production") {
      console.error("Razorpay keys missing. Payment gateway is disabled.");
    } else {
      console.warn(message);
    }
  }
} catch (err) {
  console.warn("Failed to initialize Razorpay:", err.message);
}

export const razorpay = razorpayInstance;

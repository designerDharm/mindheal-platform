import { repositories } from "../repositories/index.js";
import { decryptSecret } from "../services/secret.service.js";
import { ok } from "../utils/http.js";

export async function publicConfig() {
  const mapsConfig = await repositories.apiConfigurations.find("google-maps");
  return ok({
    mapsApiKey: mapsConfig && mapsConfig.isActive ? decryptSecret(mapsConfig.apiKeyEncrypted) : null,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || (process.env.NODE_ENV !== "production" ? "rzp_test_mindheal_sandbox" : null),
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || null,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_STORAGE_BUCKET?.split(".")[0] || null,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
      appId: process.env.FIREBASE_APP_ID || null
    }
  });
}

export async function activePromotions() {
  const banners = await repositories.promotionalBanners.getActive();
  return ok(banners);
}

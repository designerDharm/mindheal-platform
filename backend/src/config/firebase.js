import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

const shouldUseApplicationDefault = process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true";
const hasFirebaseCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS);
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

// Initialize Firebase Admin SDK only when credentials are intentionally configured.
// Otherwise local development uses StorageService's mock URL fallback.
if (!admin.apps.length) {
  try {
    if (storageBucket && (hasFirebaseCredentials || shouldUseApplicationDefault)) {
      admin.initializeApp({ storageBucket });
      console.log("Firebase Admin SDK initialized");
    }
  } catch (err) {
    console.warn("Firebase Admin SDK not fully initialized (missing credentials?)", err.message);
  }
}

export const bucket = admin.apps.length ? admin.storage().bucket() : null;

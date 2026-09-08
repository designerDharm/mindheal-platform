import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { appConfig } from './app.js';
dotenv.config();

const shouldUseApplicationDefault = process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true";
const hasFirebaseCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS);
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

// Initialize Firebase Admin SDK only when credentials are intentionally configured.
// Otherwise local development uses StorageService's mock URL fallback.
if (!admin.apps.length) {
  try {
    if (process.env.NODE_ENV !== 'test' && storageBucket && (hasFirebaseCredentials || shouldUseApplicationDefault)) {
      const options = { storageBucket };
      
      if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        let creds;
        try {
          creds = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        } catch (e) {
          try {
            const decoded = Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS, 'base64').toString('utf8');
            creds = JSON.parse(decoded);
          } catch (e2) {
            throw new Error("FIREBASE_ADMIN_CREDENTIALS is not valid JSON or base64 JSON.");
          }
        }
        options.credential = admin.credential.cert(creds);
      }
      
      admin.initializeApp(options);
      console.log("Firebase Admin SDK initialized");
    }
  } catch (err) {
    console.warn("Firebase Admin SDK not fully initialized (missing credentials?)", err.message);
  }
}

export const bucket = admin.apps.length ? admin.storage().bucket() : null;

export const firebaseAuthVerifier = {
  async verifyIdToken(idToken) {
    if (process.env.NODE_ENV === 'test' || appConfig.allowFirebaseAuthMock || process.env.REPOSITORY_DRIVER === 'memory') {
      if (idToken && idToken.startsWith("mock-token-")) {
        const parts = idToken.split("-");
        const email = parts[2] || "mock-user@example.com";
        const uid = parts[3] || "mock-uid";
        const name = parts[4] || "Mock User";
        return {
          email,
          uid,
          name,
          email_verified: true,
          firebase: {
            sign_in_provider: "google.com"
          }
        };
      }
    }
    if (!admin.apps.length) {
      throw new Error("Firebase authentication is not configured.");
    }
    return admin.auth().verifyIdToken(idToken);
  }
};

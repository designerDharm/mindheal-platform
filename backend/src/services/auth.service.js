import admin from "firebase-admin";
import { repositories } from "../repositories/index.js";
import { createId, hashPassword, hashValue, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken } from "../utils/security.js";
import { normalizeEmail } from "../utils/validation.js";
import { randomInt } from "node:crypto";
import { redisClient } from "../config/redis.js";
import { appConfig } from "../config/app.js";

const otpStore = new Map();

export async function createUser({ role = "user", fullName, email, mobile, languageCode = "en", password, firebaseUid }) {
  if (!password && !firebaseUid) {
    throw new Error("Password is required.");
  }

  const user = {
    id: createId("usr"),
    firebase_uid: firebaseUid || null,
    role,
    fullName,
    email: email ? normalizeEmail(email) : null,
    mobile: mobile || null,
    languageCode,
    passwordHash: password ? hashPassword(password) : "",
    isActive: true,
    createdAt: new Date().toISOString()
  };
  await repositories.users.create(user);
  await ensureWallet(user);
  return user;
}

export async function loginUser({ email, mobile, password, role }) {
  let user = null;
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    user = await repositories.users.findByEmailAndRole(normalizedEmail, role);
  } else if (mobile) {
    user = await repositories.users.findByMobileAndRole(mobile, role);
  }
  
  if (!user) {
    throw new Error("Invalid credentials");
  }

  // Support local password check for legacy or custom auth
  if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid credentials");
  }
  
  return createSession(user);
}

export async function loginWithFirebase(idToken, role) {
  if (!admin.apps.length) {
    if (!appConfig.allowFirebaseAuthMock) {
      throw new Error("Firebase authentication is not configured.");
    }
    console.warn("Firebase Admin SDK not initialized. Using explicitly enabled Firebase auth mock.");
    return createSession(await getOrCreateUser("mock-firebase-uid", `mock-${role}@example.com`, role));
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  if (!decodedToken.email) {
    throw new Error("Firebase token does not include a verified email.");
  }
  return createSession(await getOrCreateUser(decodedToken.uid, decodedToken.email, role));
}

async function getOrCreateUser(firebaseUid, email, role) {
  const normalizedEmail = normalizeEmail(email);
  let user = await repositories.users.findByEmailAndRole(normalizedEmail, role);
  if (!user) {
    user = await createUser({ role, fullName: `${role} user`, email: normalizedEmail, firebaseUid });
  }
  return user;
}

export async function createSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await persistRefreshToken(refreshToken, user.id);

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    expiresIn: appConfig.accessTokenTtlSeconds
  };
}

export async function refreshSession(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw new Error("Invalid or expired refresh token");

  await consumeRefreshToken(refreshToken);

  const user = await repositories.users.findById(payload.sub);
  if (!user) throw new Error("User no longer exists");
  if (!user.isActive) throw new Error("User account is disabled");

  return createSession(user);
}

export async function logoutUser(refreshToken) {
  if (redisClient.isOpen && refreshToken) {
    await redisClient.del(`refresh_token:${refreshToken}`);
  } else if (appConfig.env === "production" && refreshToken) {
    throw new Error("Session store is unavailable.");
  }
  return true;
}

async function persistRefreshToken(refreshToken, userId) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("Session store is unavailable.");
    }
    console.warn("Redis not connected. Refresh token not persisted in store.");
    return;
  }

  await redisClient.setEx(`refresh_token:${refreshToken}`, appConfig.refreshTokenTtlSeconds, userId);
}

async function consumeRefreshToken(refreshToken) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("Session store is unavailable.");
    }
    return;
  }

  const exists = await redisClient.get(`refresh_token:${refreshToken}`);
  if (!exists) throw new Error("Refresh token revoked or not found");
  await redisClient.del(`refresh_token:${refreshToken}`);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, totpSecret, ...safeUser } = user;
  return safeUser;
}

const otpTtlSeconds = 5 * 60;
const otpMaxAttempts = 3;

export async function issueOtp(destination) {
  const code = String(randomInt(100000, 999999));
  console.log(`[SMS/EMAIL MOCK] Sending OTP ${code} to ${destination}`);

  await persistOtp(destination, {
    hash: hashValue(code),
    attempts: 0,
    expiresAt: Date.now() + otpTtlSeconds * 1000
  });

  // Do not expose devCode in production, but leaving it for demo purposes
  return { destination, expiresInSeconds: otpTtlSeconds, devCode: appConfig.env === "production" ? undefined : code };
}

export async function verifyOtp(destination, code) {
  const item = await loadOtp(destination);
  if (!item || item.expiresAt < Date.now()) return false;

  item.attempts += 1;
  if (item.attempts > otpMaxAttempts) {
    await deleteOtp(destination);
    return false;
  }

  const verified = item.hash === hashValue(code);
  if (verified) {
    await deleteOtp(destination);
    return true;
  }

  await persistOtp(destination, item);
  return false;
}

export async function createCounsellorApplication(payload) {
  const application = {
    id: createId("app"),
    status: "pending",
    createdAt: new Date().toISOString(),
    ...payload
  };
  await repositories.counsellorApplications.create(application);
  return application;
}

async function ensureWallet(user) {
  if (await repositories.wallets.findByOwner(user.id)) return;
  await repositories.wallets.createForOwner(user.role, user.id);
}

async function persistOtp(destination, item) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    otpStore.set(destination, item);
    return;
  }

  await redisClient.setEx(otpKey(destination), otpTtlSeconds, JSON.stringify(item));
}

async function loadOtp(destination) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    return otpStore.get(destination) || null;
  }

  const value = await redisClient.get(otpKey(destination));
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function deleteOtp(destination) {
  if (!redisClient.isOpen) {
    otpStore.delete(destination);
    return;
  }
  await redisClient.del(otpKey(destination));
}

function otpKey(destination) {
  return `otp:${hashValue(destination)}`;
}

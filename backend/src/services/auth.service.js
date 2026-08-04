import admin from "firebase-admin";
import { repositories } from "../repositories/index.js";
import { createId, hashPassword, hashValue, hmacValue, maskDestination, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken } from "../utils/security.js";
import { normalizeEmail } from "../utils/validation.js";
import { randomInt } from "node:crypto";
import { redisClient } from "../config/redis.js";
import { appConfig } from "../config/app.js";

const otpStore = new Map();

export async function createUser({ role = "user", fullName, email, mobile, languageCode = "en", password, firebaseUid, dateOfBirth, guardianEmail }) {
  if (!password && !firebaseUid) {
    throw new Error("Password is required.");
  }

  const { calculateAgeFromDob } = await import("../utils/validation.js");
  const age = calculateAgeFromDob(dateOfBirth);
  
  if (dateOfBirth && age === null) {
    throw new Error("Invalid dateOfBirth format. Must be YYYY-MM-DD.");
  }

  if (role === "user" && age !== null && age < 15) {
    throw new Error("Minimum user age requirement is 15 years.");
  }

  if (role === "user" && age !== null && age >= 15 && age < 18 && !guardianEmail) {
    throw new Error("Guardian email is required for users under 18 years old.");
  }

  if (role === "counsellor" && age !== null && age < 21) {
    throw new Error("Minimum counsellor age requirement is 21 years.");
  }

  const isMinorUser = role === "user" && age !== null && age >= 15 && age < 18;

  const user = {
    id: createId("usr"),
    firebase_uid: firebaseUid || null,
    role,
    fullName,
    email: email ? normalizeEmail(email) : null,
    mobile: mobile || null,
    languageCode,
    passwordHash: password ? hashPassword(password) : "",
    dateOfBirth: dateOfBirth || null,
    date_of_birth: dateOfBirth || null,
    guardianEmail: isMinorUser ? (guardianEmail || null) : null,
    isGuardianConsentVerified: false,
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
    const normalizedMobile = String(mobile).trim();
    user = await repositories.users.findByMobileAndRole(normalizedMobile, role);
  }
  
  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
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
const otpLockoutSeconds = 30 * 60;
const otpResendCooldownSeconds = 30;
const otpRateLimitWindowSeconds = 10 * 60;
const otpMaxSendsPerWindow = 3;
const verificationProofTtlSeconds = 15 * 60;

const inMemoryStore = new Map();

async function redisGet(key) {
  if (!redisClient.isOpen) return inMemoryStore.get(key) || null;
  return await redisClient.get(key);
}

async function redisSetEx(key, ttlSeconds, value) {
  if (!redisClient.isOpen) {
    inMemoryStore.set(key, value);
    setTimeout(() => inMemoryStore.delete(key), ttlSeconds * 1000);
    return;
  }
  await redisClient.setEx(key, ttlSeconds, value);
}

async function sendEmailOtp(email, code, challengeId) {
  const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
  const maskedEmail = maskDestination(email);

  if (provider === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || "designerdharm@gmail.com";

    if (apiKey) {
      let attempts = 0;
      const maxRetries = 2;
      
      while (attempts <= maxRetries) {
        attempts++;
        try {
          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email }] }],
              from: { email: fromEmail, name: "MindHeal" },
              subject: `Your MindHeal Verification Code`,
              content: [{
                type: "text/html",
                value: `<p>Your verification code is: <strong>${code}</strong></p>`
              }]
            })
          });

          if (response.ok) {
            const messageId = response.headers.get("x-message-id") || `sg_${Date.now()}`;
            console.log(`[PROVIDER SUCCESS] SendGrid accepted email for ${maskedEmail} (MessageId: ${messageId})`);
            
            if (challengeId) {
              await redisSetEx(`otp_msgid:${messageId}`, 86400, JSON.stringify({ challengeId, destination: email, provider: "sendgrid", status: "accepted" }));
            }
            return { provider: "sendgrid", messageId, status: "accepted" };
          }

          const status = response.status;
          const errorText = await response.text();

          // Fatal Auth Errors (401 / 403 / Invalid Credentials) -> DO NOT RETRY
          if (status === 401 || status === 403) {
            console.error(`[OPERATIONAL ALERT] SendGrid Authentication Failed (${status}). Check SENDGRID_API_KEY.`);
            break;
          }

          // Transient Errors (429 Rate Limit / 5xx Server Error) -> Retry with Exponential Backoff
          if ((status === 429 || status >= 500) && attempts <= maxRetries) {
            const delayMs = Math.pow(2, attempts) * 500;
            console.warn(`[PROVIDER RETRY] SendGrid HTTP ${status}. Retrying in ${delayMs}ms (Attempt ${attempts}/${maxRetries})...`);
            await new Promise((res) => setTimeout(res, delayMs));
            continue;
          }

          console.warn(`[PROVIDER WARNING] SendGrid API rejected request (${status}). Falling back to SMTP...`);
          break;
        } catch (err) {
          if (attempts <= maxRetries) {
            const delayMs = Math.pow(2, attempts) * 500;
            console.warn(`[PROVIDER RETRY] SendGrid network error: ${err.message}. Retrying in ${delayMs}ms...`);
            await new Promise((res) => setTimeout(res, delayMs));
            continue;
          }
          break;
        }
      }
    }
  }

  // Fallback / Staging SMTP Driver
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn(`[PROVIDER NOTICE] SMTP credentials not configured. Skipping email dispatch to ${maskedEmail}.`);
    if (appConfig.env === "production") {
      throw new Error("OTP_DELIVERY_UNAVAILABLE: Email delivery credentials not configured.");
    }
    return { provider: "mock", status: "mock_delivered" };
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const requireTLS = process.env.SMTP_REQUIRE_TLS !== "false";
  const fromAddress = process.env.SMTP_FROM || `"MindHeal Verification" <${smtpUser}>`;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `Your MindHeal Verification Code`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    });

    const messageId = info.messageId || `smtp_${Date.now()}`;
    console.log(`[PROVIDER SUCCESS] SMTP dispatched email for ${maskedEmail} (MessageId: ${messageId})`);

    if (challengeId) {
      await redisSetEx(`otp_msgid:${messageId}`, 86400, JSON.stringify({ challengeId, destination: email, provider: "smtp", status: "accepted" }));
    }

    return { provider: "smtp", messageId, status: "accepted" };
  } catch (err) {
    console.error(`[OPERATIONAL ALERT] SMTP Delivery Failure for ${maskedEmail}: ${err.message}`);
    if (appConfig.env === "production") {
      throw new Error(`OTP_DELIVERY_UNAVAILABLE: ${err.message}`);
    }
    return { provider: "smtp", status: "failed" };
  }
}

async function sendSmsOtp(mobile, code, challengeId) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID;
  const entityId = process.env.MSG91_DLT_ENTITY_ID;
  const maskedMobile = maskDestination(mobile);

  if (!authKey || !templateId) {
    console.warn(`[PROVIDER NOTICE] MSG91 credentials not set. Skipping SMS dispatch to ${maskedMobile}.`);
    if (appConfig.env === "production") {
      throw new Error("OTP_DELIVERY_UNAVAILABLE: SMS gateway credentials not configured.");
    }
    return { provider: "mock", status: "mock_delivered" };
  }

  const cleanMobile = mobile.replace(/[^0-9]/g, "");

  let attempts = 0;
  const maxRetries = 2;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const payload = {
        template_id: templateId,
        mobile: cleanMobile,
        authkey: authKey,
        otp: code
      };
      if (senderId) payload.sender = senderId;
      if (entityId) payload.entity_id = entityId;

      const response = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: {
          "authkey": authKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const status = response.status;
      const resJson = await response.json().catch(() => ({}));

      // Fatal Auth Errors (401 / Invalid Key)
      if (status === 401 || resJson.type === "error" && String(resJson.message).toLowerCase().includes("auth")) {
        console.error(`[OPERATIONAL ALERT] MSG91 Authentication Failed (${status}). Check MSG91_AUTH_KEY.`);
        if (appConfig.env === "production") {
          throw new Error("OTP_DELIVERY_UNAVAILABLE: Invalid SMS provider configuration.");
        }
        return { provider: "msg91", status: "failed" };
      }

      if (response.ok && resJson.type !== "error") {
        const messageId = resJson.request_id || `msg91_${Date.now()}`;
        console.log(`[PROVIDER SUCCESS] MSG91 accepted SMS for ${maskedMobile} (MessageId: ${messageId})`);

        if (challengeId) {
          await redisSetEx(`otp_msgid:${messageId}`, 86400, JSON.stringify({ challengeId, destination: mobile, provider: "msg91", status: "accepted" }));
        }
        return { provider: "msg91", messageId, status: "accepted" };
      }

      if ((status === 429 || status >= 500) && attempts <= maxRetries) {
        const delayMs = Math.pow(2, attempts) * 500;
        console.warn(`[PROVIDER RETRY] MSG91 HTTP ${status}. Retrying in ${delayMs}ms...`);
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      throw new Error(`MSG91 Error (${status}): ${resJson.message || response.statusText}`);
    } catch (err) {
      if (attempts <= maxRetries) {
        const delayMs = Math.pow(2, attempts) * 500;
        console.warn(`[PROVIDER RETRY] MSG91 network error: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      console.error(`[OPERATIONAL ALERT] MSG91 Delivery Failed for ${maskedMobile}: ${err.message}`);
      if (appConfig.env === "production") {
        throw new Error(`OTP_DELIVERY_UNAVAILABLE: ${err.message}`);
      }
      return { provider: "msg91", status: "failed" };
    }
  }
}

async function checkOtpSendRateLimits(destination, clientIp) {
  const destClean = String(destination).trim().toLowerCase();

  // Check 30-minute lockout
  const lockoutVal = await redisGet(`otp_lockout:${destClean}`);
  if (lockoutVal) {
    const remainingMs = Number(lockoutVal) - Date.now();
    const remainingMins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    throw new Error(`LOCKOUT: Too many invalid verification attempts. Please try again after ${remainingMins} minutes.`);
  }

  // Check 30-second resend cooldown
  const cooldownVal = await redisGet(`otp_cooldown:${destClean}`);
  if (cooldownVal) {
    const remainingSecs = Math.max(1, Math.ceil((Number(cooldownVal) - Date.now()) / 1000));
    throw new Error(`COOLDOWN: Please wait ${remainingSecs} seconds before requesting another code.`);
  }

  // Check 10-minute send rate limit (destination & IP)
  const sendCountDestKey = `otp_send_count_dest:${destClean}`;
  const countDestRaw = await redisGet(sendCountDestKey);
  const currentCountDest = countDestRaw ? Number(countDestRaw) : 0;
  if (currentCountDest >= otpMaxSendsPerWindow) {
    throw new Error("RATE_LIMIT: Maximum 3 verification codes per 10 minutes. Please try again later.");
  }

  if (clientIp) {
    const sendCountIpKey = `otp_send_count_ip:${clientIp}`;
    const countIpRaw = await redisGet(sendCountIpKey);
    const currentCountIp = countIpRaw ? Number(countIpRaw) : 0;
    if (currentCountIp >= 10) {
      throw new Error("RATE_LIMIT: Device/IP rate limit exceeded. Please try again later.");
    }
  }
}

async function recordOtpSend(destination, clientIp) {
  const destClean = String(destination).trim().toLowerCase();
  
  // Set 30-second cooldown
  await redisSetEx(`otp_cooldown:${destClean}`, otpResendCooldownSeconds, String(Date.now() + otpResendCooldownSeconds * 1000));

  // Increment send count
  const sendCountDestKey = `otp_send_count_dest:${destClean}`;
  const countDestRaw = await redisGet(sendCountDestKey);
  const currentCountDest = countDestRaw ? Number(countDestRaw) : 0;
  await redisSetEx(sendCountDestKey, otpRateLimitWindowSeconds, String(currentCountDest + 1));

  if (clientIp) {
    const sendCountIpKey = `otp_send_count_ip:${clientIp}`;
    const countIpRaw = await redisGet(sendCountIpKey);
    const currentCountIp = countIpRaw ? Number(countIpRaw) : 0;
    await redisSetEx(sendCountIpKey, otpRateLimitWindowSeconds, String(currentCountIp + 1));
  }
}

export async function issueOtp(destination, clientIp) {
  await checkOtpSendRateLimits(destination, clientIp);

  const code = String(randomInt(100000, 999999));
  const challengeId = createId("ch");
  const destClean = String(destination).trim().toLowerCase();

  // Invalidate any old challenge for destination
  const existingChallengeId = await redisGet(`otp_active_challenge:${destClean}`);
  if (existingChallengeId) {
    await redisDel(`otp_challenge:${existingChallengeId}`);
  }

  // Keyed HMAC storage
  const hmacHash = hmacValue(`${challengeId}:${destClean}:${code}`, appConfig.jwtAccessSecret);
  const expiresAt = Date.now() + otpTtlSeconds * 1000;

  const challengeData = {
    challengeId,
    destination: destClean,
    hmacHash,
    attempts: 0,
    expiresAt
  };

  await redisSetEx(`otp_challenge:${challengeId}`, otpTtlSeconds, JSON.stringify(challengeData));
  await redisSetEx(`otp_active_challenge:${destClean}`, otpTtlSeconds, challengeId);

  await recordOtpSend(destination, clientIp);

  if (destClean.includes("@")) {
    await sendEmailOtp(destClean, code, challengeId);
    await recordOtpMetric("issued_email");
  } else {
    await sendSmsOtp(destClean, code, challengeId);
    await recordOtpMetric("issued_sms");
  }

  return {
    challengeId,
    maskedDestination: maskDestination(destClean),
    expiresInSeconds: otpTtlSeconds,
    resendCooldownSeconds: otpResendCooldownSeconds,
    devCode: appConfig.isOtpTestMode ? code : undefined
  };
}

export async function verifyOtp(challengeId, code, destination) {
  const challengeRaw = await redisGet(`otp_challenge:${challengeId}`);
  if (!challengeRaw) {
    throw new Error("Challenge expired or invalid. Please request a new verification code.");
  }

  const challenge = JSON.parse(challengeRaw);
  const isEmail = challenge.destination.includes("@");

  if (challenge.expiresAt < Date.now()) {
    await redisDel(`otp_challenge:${challengeId}`);
    await recordOtpMetric(isEmail ? "failed_email" : "failed_sms");
    throw new Error("Verification code has expired.");
  }

  const destClean = String(destination || challenge.destination).trim().toLowerCase();
  if (challenge.destination !== destClean) {
    throw new Error("Destination mismatch.");
  }

  challenge.attempts += 1;

  if (challenge.attempts > otpMaxAttempts) {
    await redisDel(`otp_challenge:${challengeId}`);
    await redisDel(`otp_active_challenge:${destClean}`);
    await redisSetEx(`otp_lockout:${destClean}`, otpLockoutSeconds, String(Date.now() + otpLockoutSeconds * 1000));
    await recordOtpMetric(isEmail ? "failed_email" : "failed_sms");
    throw new Error("LOCKOUT: Maximum 3 verification attempts exceeded. Account locked for 30 minutes.");
  }

  const expectedHmac = hmacValue(`${challengeId}:${destClean}:${code}`, appConfig.jwtAccessSecret);
  const isMatch = challenge.hmacHash === expectedHmac;

  if (!isMatch) {
    const remainingAttempts = otpMaxAttempts - challenge.attempts;
    await redisSetEx(`otp_challenge:${challengeId}`, Math.ceil((challenge.expiresAt - Date.now()) / 1000), JSON.stringify(challenge));
    await recordOtpMetric(isEmail ? "failed_email" : "failed_sms");
    throw new Error(`Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
  }

  // Single-use verification proof issuance
  await redisDel(`otp_challenge:${challengeId}`);
  await redisDel(`otp_active_challenge:${destClean}`);
  await recordOtpMetric(isEmail ? "verified_email" : "verified_sms");

  const verificationProof = createId("proof");
  const proofData = {
    verificationProof,
    destination: destClean,
    createdAt: Date.now()
  };

  await redisSetEx(`otp_proof:${verificationProof}`, verificationProofTtlSeconds, JSON.stringify(proofData));

  return {
    verified: true,
    verificationProof
  };
}

export async function consumeVerificationProof(verificationProof, destination) {
  if (!verificationProof) return false;
  const proofRaw = await redisGet(`otp_proof:${verificationProof}`);
  if (!proofRaw) return false;

  const proof = JSON.parse(proofRaw);
  const destClean = String(destination).trim().toLowerCase();

  if (proof.destination !== destClean) return false;

  // Single-use atomic consumption
  await redisDel(`otp_proof:${verificationProof}`);
  return true;
}

export async function forgotPassword(email) {
  const normalizedEmail = normalizeEmail(email);
  // Find user across all roles - try user first, then counsellor, then admin
  let user = await repositories.users.findByEmailAndRole(normalizedEmail, "user");
  if (!user) user = await repositories.users.findByEmailAndRole(normalizedEmail, "counsellor");
  if (!user) user = await repositories.users.findByEmailAndRole(normalizedEmail, "admin");

  // Always return success - never reveal if email exists (security)
  if (!user) return { message: "If this email exists, a reset OTP has been sent." };

  // issueOtp generates, stores, and sends the OTP email in one call
  await issueOtp(normalizedEmail);

  return { message: "If this email exists, a reset OTP has been sent." };
}

export async function resetPassword(email, otp, newPassword) {
  const normalizedEmail = normalizeEmail(email);

  const verified = await verifyOtp(normalizedEmail, otp);
  if (!verified) {
    throw new Error("Invalid or expired OTP. Please request a new code.");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  // Find user across all roles
  let user = await repositories.users.findByEmailAndRole(normalizedEmail, "user");
  if (!user) user = await repositories.users.findByEmailAndRole(normalizedEmail, "counsellor");
  if (!user) user = await repositories.users.findByEmailAndRole(normalizedEmail, "admin");

  if (!user) throw new Error("User not found.");

  const newHash = hashPassword(newPassword);
  await repositories.users.updatePasswordHash(user.id, newHash);

  return { message: "Password has been reset successfully. Please log in with your new password." };
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

export async function recordOtpMetric(type) {
  // type can be: 'issued_email', 'issued_sms', 'verified_email', 'verified_sms', 'failed_email', 'failed_sms'
  const key = `otp_metrics:${type}`;
  const raw = await redisGet(key);
  const current = raw ? Number(raw) : 0;
  await redisSetEx(key, 30 * 86400, String(current + 1));
}

export async function getOtpMetrics() {
  const types = ["issued_email", "issued_sms", "verified_email", "verified_sms", "failed_email", "failed_sms"];
  const metrics = {};
  for (const t of types) {
    const raw = await redisGet(`otp_metrics:${t}`);
    metrics[t] = raw ? Number(raw) : 0;
  }
  const totalIssued = metrics.issued_email + metrics.issued_sms;
  const totalVerified = metrics.verified_email + metrics.verified_sms;
  metrics.conversionRatePercent = totalIssued > 0 ? Number(((totalVerified / totalIssued) * 100).toFixed(2)) : 0;
  return metrics;
}

export async function processProviderWebhook(provider, messageId, eventStatus, metadata = {}) {
  const recordRaw = await redisGet(`otp_msgid:${messageId}`);
  if (!recordRaw) return;

  const record = JSON.parse(recordRaw);
  const maskedDest = maskDestination(record.destination);

  console.log(`[WEBHOOK DLR] ${provider.toUpperCase()} reported '${eventStatus}' for ${maskedDest} (MessageId: ${messageId})`);

  if (eventStatus === "bounce" || eventStatus === "dropped" || eventStatus === "failed" || eventStatus === "REJECTED") {
    console.error(`[OPERATIONAL ALERT] OTP Delivery Failed via Webhook. Destination: ${maskedDest}, Reason: ${metadata.reason || eventStatus}`);
    record.status = "bounced_failed";
    await redisSetEx(`otp_msgid:${messageId}`, 86400, JSON.stringify(record));
  }
}

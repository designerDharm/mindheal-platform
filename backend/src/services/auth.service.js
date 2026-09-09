import admin from "firebase-admin";
import { repositories } from "../repositories/index.js";
import { createId, hashPassword, hashValue, hmacValue, maskDestination, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken, signOnboardingToken, verifyOnboardingToken, verifyTotp } from "../utils/security.js";
import { normalizeEmail } from "../utils/validation.js";
import { randomInt } from "node:crypto";
import { redisClient } from "../config/redis.js";
import { appConfig } from "../config/app.js";
import { firebaseAuthVerifier } from "../config/firebase.js";

const otpStore = new Map();

export async function createUser({ role = "user", fullName, email, mobile, languageCode = "en", password, firebaseUid, dateOfBirth, guardianEmail, onboardingStatus = "COMPLETED", profileCompletedAt = null, emailVerifiedAt = null, isGuardianConsentVerified = null, guardianConsentStatus = null }) {
  if (!password && !firebaseUid) {
    throw new Error("Password is required.");
  }

  const age = calculateExactAge(dateOfBirth);
  
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
  const isConsentVerified = isGuardianConsentVerified !== null ? isGuardianConsentVerified : !isMinorUser;
  const consentStatus = guardianConsentStatus !== null ? guardianConsentStatus : (isMinorUser ? "PENDING" : "APPROVED");
  const defaultOnboarding = onboardingStatus !== undefined ? onboardingStatus : (isMinorUser ? "PENDING_GUARDIAN" : "COMPLETED");

  const user = {
    id: createId("usr"),
    firebase_uid: firebaseUid || null,
    firebaseUid: firebaseUid || null,
    role,
    fullName,
    email: email ? normalizeEmail(email) : null,
    mobile: mobile || null,
    languageCode,
    passwordHash: password ? hashPassword(password) : "",
    dateOfBirth: dateOfBirth || null,
    date_of_birth: dateOfBirth || null,
    guardianEmail: isMinorUser ? (guardianEmail || null) : null,
    isGuardianConsentVerified: isConsentVerified,
    isActive: true,
    profileCompletedAt,
    onboardingStatus: defaultOnboarding,
    emailVerifiedAt,
    guardianConsentStatus: consentStatus,
    createdAt: new Date().toISOString()
  };
  await repositories.users.create(user);
  await ensureWallet(user);
  return user;
}

export async function loginUser({ email, mobile, password, role, totp }) {
  let user = null;
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    user = await repositories.users.findByEmailAndRole(normalizedEmail, role);
  } else if (mobile) {
    const normalizedMobile = String(mobile).trim();
    user = await repositories.users.findByMobileAndRole(normalizedMobile, role);
  }
  
  if (!user) {
    throw new Error("Invalid email, password, or role.");
  }

  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid email, password, or role.");
  }

  if (user.isActive === false || user.status === "disabled" || user.status === "suspended") {
    const err = new Error("User account is disabled.");
    err.code = "ACCOUNT_DISABLED";
    throw err;
  }

  if (user.role === "admin") {
    if (!totp || String(totp).trim().length === 0) {
      const err = new Error("Two-factor authentication code is required for administrator login.");
      err.code = "TOTP_REQUIRED";
      throw err;
    }

    const secret = user.totpSecret || user.totp_secret || process.env.ADMIN_TOTP_SECRET || "JBSWY3DPEHPK3PXP";
    const isValid = verifyTotp(totp, secret);
    if (!isValid) {
      const err = new Error("Invalid two-factor authentication code.");
      err.code = "INVALID_TOTP";
      throw err;
    }
  }
  
  return createSession(user);
}

export function calculateExactAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export async function loginWithFirebase(idToken, role, flow = "signin") {
  let decodedToken;
  try {
    decodedToken = await firebaseAuthVerifier.verifyIdToken(idToken);
  } catch (err) {
    throw new Error("Firebase token verification failed: " + err.message);
  }

  if (!decodedToken.email_verified) {
    throw new Error("Google email is not verified.");
  }
  if (decodedToken.firebase?.sign_in_provider !== "google.com") {
    throw new Error("Unsupported authentication provider.");
  }

  const email = decodedToken.email;
  const uid = decodedToken.uid;
  const name = decodedToken.name || "";

  const normalizedEmail = normalizeEmail(email);
  const user = await repositories.users.findByEmailAndRole(normalizedEmail, role);

  if (user) {
    if (!user.isActive) {
      return { status: "ACCOUNT_RESTRICTED" };
    }

    if (!user.firebaseUid) {
      return { status: "ACCOUNT_LINK_REQUIRED", email };
    }

    if (!user.profileCompletedAt || !user.fullName || !user.dateOfBirth) {
      const onboardingToken = signOnboardingToken({ firebaseUid: uid, email, name, role, flow });
      return { status: "PROFILE_REQUIRED", email, name, onboardingToken };
    }

    const age = calculateExactAge(user.dateOfBirth);
    if (age !== null && age >= 15 && age < 18 && !user.isGuardianConsentVerified) {
      return { status: "GUARDIAN_CONSENT_REQUIRED", email };
    }

    const session = await createSession(user);
    return { status: "AUTHENTICATED", session };
  } else {
    if (flow === "signin") {
      return { status: "SIGNUP_REQUIRED", email };
    }

    const safeSignupRole = role === "counsellor" ? "counsellor" : "user";
    const onboardingToken = signOnboardingToken({ firebaseUid: uid, email, name, role: safeSignupRole, flow });
    return { status: "PROFILE_REQUIRED", email, name, onboardingToken };
  }
}

export async function linkGoogleAccount(email, password, idToken, role) {
  let decodedToken;
  try {
    decodedToken = await firebaseAuthVerifier.verifyIdToken(idToken);
  } catch (err) {
    throw new Error("Firebase token verification failed: " + err.message);
  }

  if (!decodedToken.email_verified) {
    throw new Error("Google email is not verified.");
  }
  if (decodedToken.firebase?.sign_in_provider !== "google.com") {
    throw new Error("Unsupported authentication provider.");
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizeEmail(decodedToken.email) !== normalizedEmail) {
    throw new Error("Google email does not match target account.");
  }

  const user = await repositories.users.findByEmailAndRole(normalizedEmail, role);
  if (!user) {
    throw new Error("Target account does not exist.");
  }

  if (!user.isActive) {
    return { status: "ACCOUNT_RESTRICTED" };
  }

  if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid password.");
  }

  // Link the account
  const updatedUser = await repositories.users.update(user.id, { firebaseUid: decodedToken.uid });

  if (!updatedUser.profileCompletedAt || !updatedUser.fullName || !updatedUser.dateOfBirth) {
    const onboardingToken = signOnboardingToken({ firebaseUid: decodedToken.uid, email: decodedToken.email, name: decodedToken.name || "", role, flow: "signin" });
    return { status: "PROFILE_REQUIRED", email: decodedToken.email, name: decodedToken.name || "", onboardingToken };
  }

  const age = calculateExactAge(updatedUser.dateOfBirth);
  if (age !== null && age >= 15 && age < 18 && !updatedUser.isGuardianConsentVerified) {
    return { status: "GUARDIAN_CONSENT_REQUIRED", email: decodedToken.email };
  }

  const session = await createSession(updatedUser);
  return { status: "AUTHENTICATED", session };
}

export async function completeGoogleOnboarding(onboardingToken, profileData) {
  const payload = verifyOnboardingToken(onboardingToken);
  if (!payload) {
    throw new Error("Invalid or expired onboarding session.");
  }

  const { firebaseUid, email, role, flow } = payload;
  const safeRole = role === "counsellor" ? "counsellor" : "user";
  const { fullName, dateOfBirth, guardianEmail, termsConsent } = profileData;

  if (!fullName || !dateOfBirth) {
    throw new Error("Full name and Date of Birth are required.");
  }
  if (!termsConsent) {
    throw new Error("Terms of Service and Privacy Policy consent is required.");
  }

  const age = calculateExactAge(dateOfBirth);
  if (age === null) {
    throw new Error("Invalid Date of Birth format.");
  }

  if (age < 15) {
    return { status: "AGE_NOT_ELIGIBLE" };
  }

  const isMinor = age >= 15 && age < 18;
  if (isMinor && !guardianEmail) {
    throw new Error("Guardian email is required for minor accounts.");
  }

  const normalizedEmail = normalizeEmail(email);
  let user = await repositories.users.findByEmailAndRole(normalizedEmail, safeRole);

  if (user) {
    if (user.isActive === false || user.status === "disabled" || user.status === "suspended") {
      return { status: "ACCOUNT_RESTRICTED" };
    }

    const patch = {
      firebaseUid,
      fullName,
      dateOfBirth,
      profileCompletedAt: new Date().toISOString(),
      onboardingStatus: isMinor ? "PENDING_GUARDIAN" : "COMPLETED",
      emailVerifiedAt: new Date().toISOString(),
      guardianEmail: isMinor ? guardianEmail : null,
      isGuardianConsentVerified: !isMinor,
      guardianConsentStatus: isMinor ? "PENDING" : "APPROVED"
    };
    user = await repositories.users.update(user.id, patch);
  } else {
    user = await createUser({
      role: safeRole,
      fullName,
      email: normalizedEmail,
      firebaseUid,
      dateOfBirth,
      guardianEmail: isMinor ? guardianEmail : null,
      onboardingStatus: isMinor ? "PENDING_GUARDIAN" : "COMPLETED",
      profileCompletedAt: new Date().toISOString(),
      emailVerifiedAt: new Date().toISOString(),
      isGuardianConsentVerified: !isMinor,
      guardianConsentStatus: isMinor ? "PENDING" : "APPROVED"
    });
  }

  if (isMinor) {
    await triggerGuardianConsentEmail(user);
    return { status: "GUARDIAN_CONSENT_REQUIRED", email };
  }

  const session = await createSession(user);
  return { status: "AUTHENTICATED", session };
}

export async function approveGuardianConsent(consentToken) {
  const payload = verifyOnboardingToken(consentToken);
  if (!payload || payload.purpose !== "guardian") {
    throw new Error("Invalid or expired consent token.");
  }

  const userId = payload.sub;
  const user = await repositories.users.findById(userId);
  if (!user) {
    throw new Error("User does not exist.");
  }

  const updatedUser = await repositories.users.update(user.id, {
    onboardingStatus: "COMPLETED",
    isGuardianConsentVerified: true,
    guardianConsentStatus: "APPROVED"
  });

  return { success: true, email: updatedUser.email };
}

async function triggerGuardianConsentEmail(user) {
  const token = signOnboardingToken({ sub: user.id, purpose: "guardian" });
  const link = `http://localhost:4173/#/auth/guardian-approve?token=${token}`;
  
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpUser || !smtpPass) {
    console.warn(`[Onboarding] SMTP credentials not configured. Mock Link: ${link}`);
    return;
  }
  
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const requireTLS = process.env.SMTP_REQUIRE_TLS !== "false";
  const fromAddress = process.env.SMTP_FROM || `"MindHeal Consent" <${smtpUser}>`;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: fromAddress,
      to: user.guardianEmail,
      subject: `MindHeal Guardian Consent Request for ${user.fullName}`,
      html: `<p>Parent/guardian consent is required for ${user.fullName} to use MindHeal.</p>
             <p>Please click this link to approve: <a href="${link}">${link}</a></p>`
    });
  } catch (err) {
    console.error(`Failed to send guardian consent email: ${err.message}`);
  }
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
  if (user.isActive === false || user.status === "disabled" || user.status === "suspended") {
    const err = new Error("User account is disabled");
    err.code = "ACCOUNT_DISABLED";
    throw err;
  }

  return createSession(user);
}

export async function revokeUserSessions(userId) {
  if (redisClient.isOpen && userId) {
    try {
      await redisClient.setEx(`revoked_user:${userId}`, appConfig.refreshTokenTtlSeconds, "disabled");
    } catch (e) {
      console.error("[Session] Failed to record revoked_user in Redis:", e.message);
    }
  }
  return true;
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
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    return inMemoryStore.get(key) || null;
  }
  return await redisClient.get(key);
}

async function redisSetEx(key, ttlSeconds, value) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    inMemoryStore.set(key, value);
    const ms = Math.min(ttlSeconds * 1000, 2147483647);
    setTimeout(() => inMemoryStore.delete(key), ms).unref();
    return;
  }
  await redisClient.setEx(key, ttlSeconds, value);
}

async function redisDel(key) {
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    inMemoryStore.delete(key);
    return;
  }
  await redisClient.del(key);
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

  if (process.env.NODE_ENV === "test" || appConfig.env === "test" || process.env.REPOSITORY_DRIVER === "memory") {
    console.log(`[TEST NOTICE] Mocking email dispatch to ${maskedEmail}.`);
    return { provider: "mock", status: "mock_delivered" };
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
    createdAt: Date.now(),
    expiresAt: Date.now() + verificationProofTtlSeconds * 1000
  };

  await redisSetEx(`otp_proof:${verificationProof}`, verificationProofTtlSeconds, JSON.stringify(proofData));

  return {
    verified: true,
    verificationProof
  };
}

export async function consumeVerificationProof(verificationProof, destination) {
  if (!verificationProof) return null;
  const key = `otp_proof:${verificationProof}`;

  let proofRaw = null;
  if (!redisClient.isOpen) {
    if (appConfig.env === "production") {
      throw new Error("OTP store is unavailable.");
    }
    proofRaw = inMemoryStore.get(key) || null;
    if (proofRaw) {
      // Immediate single-use consumption in memory
      inMemoryStore.delete(key);
    }
  } else {
    // Atomic GET and DEL in Redis using Lua script
    const luaScript = `
      local val = redis.call('GET', KEYS[1])
      if val then
        redis.call('DEL', KEYS[1])
      end
      return val
    `;
    proofRaw = await redisClient.eval(luaScript, { keys: [key] });
  }

  if (!proofRaw) return null;

  let proof;
  try {
    proof = typeof proofRaw === "string" ? JSON.parse(proofRaw) : proofRaw;
  } catch {
    return null;
  }

  // Check TTL/expiration
  if (proof.expiresAt && Date.now() > proof.expiresAt) {
    return null;
  }

  // Bind proof to verified destination
  const candidateDestinations = (Array.isArray(destination) ? destination : [destination])
    .filter(Boolean)
    .map((d) => String(d).trim().toLowerCase());

  const proofDest = String(proof.destination).trim().toLowerCase();
  const matched = candidateDestinations.includes(proofDest);

  if (!matched) {
    return null;
  }

  return {
    verified: true,
    destination: proofDest
  };
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
  const { userId, fullName, email, mobile, licenseNumber, specializations, languagesSpoken, experienceYears, bio } = payload || {};
  const application = {
    id: createId("app"),
    userId,
    fullName,
    email,
    mobile: mobile || null,
    licenseNumber: licenseNumber || null,
    specializations: Array.isArray(specializations) ? specializations : (typeof specializations === "string" ? [specializations] : []),
    languagesSpoken: Array.isArray(languagesSpoken) ? languagesSpoken : (typeof languagesSpoken === "string" ? [languagesSpoken] : []),
    experienceYears: Number(experienceYears || 0),
    bio: bio || "",
    status: "pending",
    createdAt: new Date().toISOString()
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

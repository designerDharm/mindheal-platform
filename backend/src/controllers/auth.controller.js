import * as authService from "../services/auth.service.js";
import { badRequest, created, ok, unauthorized } from "../utils/http.js";
import { requireFields } from "../utils/validation.js";

export async function register({ body, headers = {}, ip }) {
  if (body.role && body.role !== "user") {
    return badRequest("Public registration permits role 'user' only.");
  }
  const forbiddenPrivileges = ["isActive", "is_active", "verificationStatus", "verification_status", "isGuardianConsentVerified", "is_guardian_consent_verified", "totpSecret", "totp_secret"];
  const presentForbidden = forbiddenPrivileges.filter((key) => body[key] !== undefined);
  if (presentForbidden.length > 0) {
    return badRequest(`Modification of privilege or security fields is forbidden during registration: ${presentForbidden.join(", ")}`);
  }

  const missing = requireFields(body, ["fullName", "password"]);
  if (missing) return badRequest("Missing required registration fields.", missing);

  const destination = body.email || body.mobile;
  if (!destination) {
    return badRequest("Either email or mobile number must be provided.", { email: "Required", mobile: "Required" });
  }

  // Atomically verify & consume single-use verificationProof if provided
  if (body.verificationProof) {
    const consumed = await authService.consumeVerificationProof(body.verificationProof, destination);
    if (!consumed) {
      return badRequest("Invalid, expired, or previously consumed verification proof. Please complete verification again.");
    }
  }

  try {
    const user = await authService.createUser({ ...body, role: "user" });
    return created(await authService.createSession(user));
  } catch (err) {
    return badRequest("Registration failed", err.message);
  }
}

export async function login({ body }) {
  if (body.idToken) {
    try {
      const session = await authService.loginWithFirebase(body.idToken, body.role || "user");
      return ok(session);
    } catch (err) {
      return badRequest("Invalid Firebase Token", err.message);
    }
  }

  const missing = requireFields(body, ["password"]);
  if (missing) return badRequest("Password is required.", missing);
  if (!body.email && !body.mobile) {
    return badRequest("Email or mobile is required.", { email: "Required", mobile: "Required" });
  }
  
  try {
    const session = await authService.loginUser({ email: body.email, mobile: body.mobile, password: body.password, role: body.role || "user" });
    return ok(session);
  } catch (err) {
    return unauthorized("Invalid email, password, or role.");
  }
}

export async function sendOtp({ body, ip, headers = {} }) {
  const destination = body.email || body.mobile;
  if (!destination) return badRequest("Email or mobile is required.");
  
  const clientIp = ip || headers["x-forwarded-for"] || "127.0.0.1";

  try {
    const res = await authService.issueOtp(destination, clientIp);
    return ok(res);
  } catch (err) {
    if (err.message && err.message.startsWith("OTP_DELIVERY_UNAVAILABLE")) {
      return badRequest("OTP Delivery Unavailable. Please try again later or contact support.", { code: "OTP_DELIVERY_UNAVAILABLE" });
    }
    if (err.message && (err.message.startsWith("LOCKOUT") || err.message.startsWith("COOLDOWN") || err.message.startsWith("RATE_LIMIT"))) {
      return badRequest(err.message);
    }
    throw err;
  }
}

export async function verifyOtp({ body }) {
  const challengeId = body.challengeId;
  const code = body.code || body.otp;
  const destination = body.email || body.mobile;

  if (!challengeId) {
    return badRequest("challengeId is required for OTP verification.");
  }
  if (!code) {
    return badRequest("Verification code is required.");
  }

  try {
    const result = await authService.verifyOtp(challengeId, code, destination);
    return ok(result);
  } catch (err) {
    return badRequest(err.message || "Invalid or expired verification code.");
  }
}

export async function registerCounsellor({ body }) {
  const missing = requireFields(body, ["fullName", "password", "licenseNumber", "specializations"]);
  if (missing) return badRequest("Missing required counsellor registration fields.", missing);
  if (!body.email && !body.mobile) {
    return badRequest("Either email or mobile number must be provided.", { email: "Required", mobile: "Required" });
  }
  try {
    const user = await authService.createUser({ role: "counsellor", ...body });
    const application = await authService.createCounsellorApplication({ userId: user.id, ...body });
    const session = await authService.createSession(user);
    return created({ session, application, counsellor: { ...application, status: application.status || "pending" } });
  } catch (err) {
    return badRequest("Counsellor registration failed", err.message);
  }
}

export async function refresh({ body }) {
  const missing = requireFields(body, ["refreshToken"]);
  if (missing) return badRequest("Refresh token is required.", missing);
  try {
    const session = await authService.refreshSession(body.refreshToken);
    return ok(session);
  } catch (err) {
    return unauthorized(err.message);
  }
}

export async function logout({ body }) {
  if (body.refreshToken) {
    await authService.logoutUser(body.refreshToken);
  }
  return ok({ success: true, message: "Logged out successfully" });
}

export async function forgotPassword({ body }) {
  const missing = requireFields(body, ["email"]);
  if (missing) return badRequest("Email is required to reset password.", missing);
  try {
    const result = await authService.forgotPassword(body.email);
    return ok(result);
  } catch (err) {
    // Always return 200 to avoid email enumeration attacks
    return ok({ message: "If this email exists, a reset OTP has been sent." });
  }
}

export async function resetPassword({ body }) {
  const missing = requireFields(body, ["email", "otp", "newPassword"]);
  if (missing) return badRequest("Email, OTP, and new password are required.", missing);
  try {
    const result = await authService.resetPassword(body.email, body.otp, body.newPassword);
    return ok(result);
  } catch (err) {
    return badRequest(err.message || "Password reset failed.");
  }
}

export async function handleSendGridWebhook({ body }) {
  const events = Array.isArray(body) ? body : [body];
  for (const event of events) {
    const { sg_message_id, event: eventType, email, reason } = event || {};
    if (sg_message_id) {
      const cleanMsgId = String(sg_message_id).split(".")[0];
      await authService.processProviderWebhook("sendgrid", cleanMsgId, eventType, { email, reason });
    }
  }
  return ok({ received: true });
}

export async function handleMsg91Dlrs({ body }) {
  const { request_id, status, mobile } = body || {};
  if (request_id) {
    await authService.processProviderWebhook("msg91", request_id, status, { mobile });
  }
  return ok({ received: true });
}

export async function getOtpMetrics({ user }) {
  const metrics = await authService.getOtpMetrics();
  return ok(metrics);
}

import * as authService from "../services/auth.service.js";
import { badRequest, created, ok, unauthorized } from "../utils/http.js";
import { requireFields } from "../utils/validation.js";

export async function register({ body }) {
  const missing = requireFields(body, ["fullName", "password"]);
  if (missing) return badRequest("Missing required registration fields.", missing);
  if (!body.email && !body.mobile) {
    return badRequest("Either email or mobile number must be provided.", { email: "Required", mobile: "Required" });
  }
  try {
    const user = await authService.createUser({ role: "user", ...body });
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

export async function sendOtp({ body }) {
  const destination = body.email || body.mobile;
  if (!destination) return badRequest("Email or mobile is required.");
  return ok(await authService.issueOtp(destination));
}

export async function verifyOtp({ body }) {
  const destination = body.email || body.mobile;
  const missing = requireFields({ destination, code: body.code }, ["destination", "code"]);
  if (missing) return badRequest("Destination and code are required.", missing);
  const verified = await authService.verifyOtp(destination, body.code);
  return ok({ verified });
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
    return created({ session: await authService.createSession(user), application });
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

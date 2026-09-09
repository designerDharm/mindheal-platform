import { createHash, createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { appConfig } from "../config/app.js";

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function hmacValue(value, secret = appConfig.jwtAccessSecret) {
  return createHmac("sha256", secret).update(String(value)).digest("hex");
}

export function maskSecret(value = "") {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function maskDestination(destination = "") {
  const str = String(destination).trim();
  if (!str) return "";
  if (str.includes("@")) {
    const [user, domain] = str.split("@");
    const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}***${user.slice(-1)}`;
    return `${maskedUser}@${domain}`;
  }
  const digits = str.replace(/[^0-9+]/g, "");
  if (digits.length <= 5) return "****";
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash = "") {
  const [scheme, iterations, salt, expected] = storedHash.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !expected) return false;
  const actual = pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function signAccessToken(user) {
  return signToken(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      type: "access"
    },
    appConfig.jwtAccessSecret,
    appConfig.accessTokenTtlSeconds
  );
}

export function signRefreshToken(user) {
  return signToken(
    {
      sub: user.id,
      role: user.role,
      type: "refresh"
    },
    appConfig.jwtRefreshSecret,
    appConfig.refreshTokenTtlSeconds
  );
}

export function verifyAccessToken(token) {
  return verifyToken(token, appConfig.jwtAccessSecret, "access");
}

export function verifyRefreshToken(token) {
  return verifyToken(token, appConfig.jwtRefreshSecret, "refresh");
}

function signToken(payload, secret, ttlSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = hmac(`${encodedHeader}.${encodedBody}`, secret);
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function verifyToken(token, secret, expectedType) {
  const [encodedHeader, encodedBody, signature] = String(token || "").split(".");
  if (!encodedHeader || !encodedBody || !signature) return null;
  const expectedSignature = hmac(`${encodedHeader}.${encodedBody}`, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  const header = parseBase64Json(encodedHeader);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;

  const payload = parseBase64Json(encodedBody);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (expectedType && payload.type !== expectedType) return null;
  return payload;
}

function parseBase64Json(value) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hmac(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signOnboardingToken(payload) {
  return signToken(
    {
      ...payload,
      type: "onboarding"
    },
    appConfig.jwtAccessSecret,
    600 // 10 minutes TTL
  );
}

export function verifyOnboardingToken(token) {
  return verifyToken(token, appConfig.jwtAccessSecret, "onboarding");
}

export function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(base32 || "").toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotp(secret, timeMs = Date.now(), stepSeconds = 30, digits = 6) {
  let key;
  const secretStr = String(secret || "").trim();
  if (/^[A-Z2-7]+=*$/i.test(secretStr)) {
    key = base32Decode(secretStr);
  } else {
    key = Buffer.from(secretStr, "utf-8");
  }
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);
  const hmacDigest = createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmacDigest[hmacDigest.length - 1] & 0x0f;
  const code = ((hmacDigest[offset] & 0x7f) << 24) |
               ((hmacDigest[offset + 1] & 0xff) << 16) |
               ((hmacDigest[offset + 2] & 0xff) << 8) |
               (hmacDigest[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, "0");
}

export function verifyTotp(token, secret, window = 1, timeMs = Date.now(), stepSeconds = 30) {
  if (!token || !secret) return false;
  const cleanedToken = String(token).trim();
  if (!/^\d{6}$/.test(cleanedToken)) return false;

  // In non-production test mode, allow test token if configured
  if (appConfig.env !== "production" && appConfig.isOtpTestMode && cleanedToken === "123456") {
    return true;
  }

  for (let delta = -window; delta <= window; delta++) {
    const generated = generateTotp(secret, timeMs + delta * stepSeconds * 1000, stepSeconds, 6);
    if (safeEqual(cleanedToken, generated)) {
      return true;
    }
  }
  return false;
}

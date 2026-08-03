import test from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { createSession, issueOtp, loginWithFirebase, logoutUser, refreshSession, sanitizeUser, verifyOtp } from "../src/services/auth.service.js";
import { appConfig } from "../src/config/app.js";
import { redisClient } from "../src/config/redis.js";
import { repositories } from "../src/repositories/index.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../src/utils/security.js";

test("auth flow", async (t) => {
  await t.test("signAccessToken and verifyAccessToken should work together", () => {
    const payload = { id: "usr_123", role: "user", email: "test@test.com" };
    const token = signAccessToken(payload);
    assert.ok(typeof token === "string");
    
    const decoded = verifyAccessToken(token);
    assert.strictEqual(decoded.sub, "usr_123");
    assert.strictEqual(decoded.role, "user");
    assert.strictEqual(decoded.email, "test@test.com");
    assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
  });

  await t.test("verifyAccessToken should return null for invalid token", () => {
    const result = verifyAccessToken("invalid.token.here");
    assert.strictEqual(result, null);
  });

  await t.test("verifyAccessToken should return null for signed malformed token payloads", () => {
    assert.strictEqual(verifyAccessToken(signRawToken("{not-json")), null);
    assert.strictEqual(verifyAccessToken(signRawToken(JSON.stringify(["not", "an", "object"]))), null);
    assert.strictEqual(verifyAccessToken(signRawToken(JSON.stringify({ type: "access", sub: "usr_123" }))), null);
  });

  await t.test("verifyRefreshToken should reject access tokens", () => {
    const token = signAccessToken({ id: "usr_123", role: "user", email: "test@test.com" });
    assert.strictEqual(verifyRefreshToken(token), null);
  });

  await t.test("loginWithFirebase should fail closed when Firebase Admin is not configured", async () => {
    const previousMockSetting = appConfig.allowFirebaseAuthMock;
    appConfig.allowFirebaseAuthMock = false;
    try {
      await assert.rejects(
        () => loginWithFirebase("unverified-id-token", "user"),
        /Firebase authentication is not configured/
      );
    } finally {
      appConfig.allowFirebaseAuthMock = previousMockSetting;
    }
  });

  await t.test("sanitizeUser should strip sensitive fields", () => {
    const user = {
      id: "usr_456",
      name: "Test User",
      email: "test@example.com",
      passwordHash: "hashed123",
      totpSecret: "secret456",
      role: "admin"
    };

    const safeUser = sanitizeUser(user);
    assert.strictEqual(safeUser.id, "usr_456");
    assert.strictEqual(safeUser.name, "Test User");
    assert.strictEqual(safeUser.email, "test@example.com");
    assert.strictEqual(safeUser.passwordHash, undefined);
    assert.strictEqual(safeUser.totpSecret, undefined);
  });

  await t.test("createSession should fail closed in production when Redis is unavailable", async () => {
    await withProductionRedisUnavailable(async () => {
      await assert.rejects(
        () => createSession({ id: "usr_redis", role: "user", email: "redis@example.com" }),
        /Session store is unavailable/
      );
    });
  });

  await t.test("refreshSession should fail closed in production when Redis is unavailable", async () => {
    await withProductionRedisUnavailable(async () => {
      const token = signRefreshToken({ id: "usr_redis", role: "user", email: "redis@example.com" });
      await assert.rejects(
        () => refreshSession(token),
        /Session store is unavailable/
      );
    });
  });

  await t.test("logoutUser should fail closed in production when Redis is unavailable", async () => {
    await withProductionRedisUnavailable(async () => {
      await assert.rejects(
        () => logoutUser("refresh-token"),
        /Session store is unavailable/
      );
    });
  });

  await t.test("OTP should work locally with in-memory development fallback", async () => {
    const issued = await issueOtp("otp-local@example.com");

    assert.strictEqual(issued.destination, "otp-local@example.com");
    assert.ok(issued.devCode);
    assert.strictEqual(await verifyOtp("otp-local@example.com", issued.devCode), true);
    assert.strictEqual(await verifyOtp("otp-local@example.com", issued.devCode), false);
  });

  await t.test("OTP should use Redis when available", async () => {
    await withFakeRedis(async (store) => {
      const issued = await issueOtp("otp-redis@example.com");

      assert.strictEqual(store.size, 1);
      assert.strictEqual(await verifyOtp("otp-redis@example.com", "000000"), false);
      assert.strictEqual(store.size, 1);
      assert.strictEqual(await verifyOtp("otp-redis@example.com", issued.devCode), true);
      assert.strictEqual(store.size, 0);
    });
  });

  await t.test("OTP issue should fail closed in production when Redis is unavailable", async () => {
    await withProductionRedisUnavailable(async () => {
      await assert.rejects(
        () => issueOtp("otp-prod@example.com"),
        /OTP store is unavailable/
      );
    });
  });

  await t.test("OTP verify should fail closed in production when Redis is unavailable", async () => {
    await withProductionRedisUnavailable(async () => {
      await assert.rejects(
        () => verifyOtp("otp-prod@example.com", "123456"),
        /OTP store is unavailable/
      );
    });
  });
});

function signRawToken(rawBody, header = { alg: "HS256", typ: "JWT" }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedBody = Buffer.from(rawBody).toString("base64url");
  const signature = createHmac("sha256", appConfig.jwtAccessSecret).update(`${encodedHeader}.${encodedBody}`).digest("base64url");
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

async function withProductionRedisUnavailable(callback) {
  const previousEnv = appConfig.env;
  const previousRedisIsOpen = redisClient.isOpen;
  const previousUsers = repositories.users;
  appConfig.env = "production";
  redisClient.isOpen = false;
  repositories.users = {
    ...previousUsers,
    findById: async () => ({ id: "usr_redis", role: "user", email: "redis@example.com", isActive: true })
  };

  try {
    await callback();
  } finally {
    appConfig.env = previousEnv;
    redisClient.isOpen = previousRedisIsOpen;
    repositories.users = previousUsers;
  }
}

async function withFakeRedis(callback) {
  const previousIsOpen = redisClient.isOpen;
  const previousSetEx = redisClient.setEx;
  const previousGet = redisClient.get;
  const previousDel = redisClient.del;
  const store = new Map();

  redisClient.isOpen = true;
  redisClient.setEx = async (key, ttl, value) => {
    store.set(key, { ttl, value });
  };
  redisClient.get = async (key) => store.get(key)?.value || null;
  redisClient.del = async (key) => {
    store.delete(key);
  };

  try {
    await callback(store);
  } finally {
    redisClient.isOpen = previousIsOpen;
    redisClient.setEx = previousSetEx;
    redisClient.get = previousGet;
    redisClient.del = previousDel;
  }
}

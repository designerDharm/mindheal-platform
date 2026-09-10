import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import { createApp, resetMemoryRateLimits } from "../backend/src/app.js";
import { appConfig } from "../backend/src/config/app.js";
import { redisClient, checkRedisHealth } from "../backend/src/config/redis.js";
import { repositories } from "../backend/src/repositories/index.js";
import { pool } from "../backend/src/data/db.js";

async function executeRequest(method, path, { body, headers = {}, ip } = {}) {
  const reqBody = body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    "content-type": "application/json",
    ...headers
  };
  req.socket = { remoteAddress: ip || `10.200.${Math.floor(Math.random() * 200) + 1}.1` };

  const res = {
    statusCode: 0,
    headers: {},
    payload: "",
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headersToSet = {}) {
      this.statusCode = status;
      Object.entries(headersToSet).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.payload = payload;
      this.writableEnded = true;
    }
  };

  await createApp().handle(req, res);

  return {
    status: res.statusCode,
    headers: res.headers,
    body: res.payload ? JSON.parse(res.payload) : null
  };
}

test("MH-05: Restore API dependency health, Redis connectivity, readiness checks, and rate-limit store", async (t) => {
  // Save global state
  const prevEnv = appConfig.env;
  const prevMax = appConfig.rateLimitMaxRequests;
  const prevWindow = appConfig.rateLimitWindowMs;
  const prevRedisIsOpen = redisClient.isOpen;
  const prevIncr = redisClient.incr;
  const prevExpire = redisClient.expire;
  const prevPing = redisClient.ping;
  const prevPoolQuery = pool.query;

  t.afterEach(() => {
    appConfig.env = prevEnv;
    appConfig.rateLimitMaxRequests = prevMax;
    appConfig.rateLimitWindowMs = prevWindow;
    redisClient.isOpen = prevRedisIsOpen;
    redisClient.incr = prevIncr;
    redisClient.expire = prevExpire;
    redisClient.ping = prevPing;
    pool.query = prevPoolQuery;
    resetMemoryRateLimits();
  });

  await t.test("1. Public counsellor listing returns JSON 200 during Redis outage in production", async () => {
    appConfig.env = "production";
    redisClient.isOpen = false;
    resetMemoryRateLimits();

    const clientIp = "192.168.10.1";
    const res = await executeRequest("GET", "/api/v1/counsellors", { ip: clientIp });

    assert.strictEqual(res.status, 200, "Should return 200 OK, not 503");
    assert.strictEqual(res.headers["content-type"], "application/json", "Should return application/json");
    assert.strictEqual(res.body.success, true, "Response payload should indicate success");
    assert.ok(Array.isArray(res.body.data), "Should return array of counsellors");
  });

  await t.test("2. Unauthenticated profile access returns 401 UNAUTHORIZED (not 503) during Redis outage in production", async () => {
    appConfig.env = "production";
    redisClient.isOpen = false;
    resetMemoryRateLimits();

    const clientIp = "192.168.10.2";
    const res = await executeRequest("GET", "/api/v1/user/me", { ip: clientIp });

    assert.strictEqual(res.status, 401, "Should return 401 UNAUTHORIZED, not 503");
    assert.strictEqual(res.headers["content-type"], "application/json");
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "UNAUTHORIZED", "Error code should be UNAUTHORIZED");
  });

  await t.test("3. Production rate-limit protection remains active during Redis outage (blocks at limit with 429)", async () => {
    appConfig.env = "production";
    appConfig.rateLimitMaxRequests = 3;
    redisClient.isOpen = false;
    resetMemoryRateLimits();

    const clientIp = "192.168.10.3";

    // First 3 requests succeed
    for (let i = 1; i <= 3; i++) {
      const res = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
      assert.strictEqual(res.status, 200, `Request #${i} should be allowed`);
    }

    // 4th request must be blocked
    const blockedRes = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
    assert.strictEqual(blockedRes.status, 429, "4th request must receive 429 Too Many Requests");
    assert.strictEqual(blockedRes.body.error.code, "TOO_MANY_REQUESTS");
  });

  await t.test("4. Redis failure/recovery lifecycle: transition between Redis and memory store is seamless and predictable", async () => {
    appConfig.env = "production";
    appConfig.rateLimitMaxRequests = 10;
    resetMemoryRateLimits();

    const redisCounts = new Map();
    redisClient.isOpen = true;
    redisClient.incr = async (key) => {
      const count = (redisCounts.get(key) || 0) + 1;
      redisCounts.set(key, count);
      return count;
    };
    redisClient.expire = async () => {};

    const clientIp = "192.168.10.4";

    // Phase A: Redis is online -> uses Redis
    const resA = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
    assert.strictEqual(resA.status, 200);
    assert.strictEqual(redisCounts.size, 1, "Redis store must have tracked request");

    // Phase B: Redis fails / drops -> seamlessly falls back to memory without crash
    redisClient.isOpen = false;
    const resB = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
    assert.strictEqual(resB.status, 200, "Fallback to memory must succeed with 200");

    // Phase C: Redis socket errors mid-flight -> caught and falls back to memory
    redisClient.isOpen = true;
    redisClient.incr = async () => {
      throw new Error("ETIMEDOUT: Redis connection timed out");
    };
    const resC = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
    assert.strictEqual(resC.status, 200, "Error during Redis incr must degrade to memory store");

    // Phase D: Redis recovers -> resumes using Redis
    redisCounts.clear();
    redisClient.incr = async (key) => {
      const count = (redisCounts.get(key) || 0) + 1;
      redisCounts.set(key, count);
      return count;
    };
    const resD = await executeRequest("GET", "/api/v1/health", { ip: clientIp });
    assert.strictEqual(resD.status, 200);
    assert.strictEqual(redisCounts.size, 1, "Must resume tracking in Redis upon recovery");
  });

  await t.test("5. Readiness check endpoints accurately reflect subsystem health and fallback mode", async () => {
    const prevDriver = process.env.REPOSITORY_DRIVER;
    process.env.REPOSITORY_DRIVER = "postgres";

    try {
      // Stub healthy database query
      pool.query = async () => ({ rows: [{ "?column?": 1 }] });

      // Both `/readiness` and `/api/v1/readiness` exist
      const resRoot = await executeRequest("GET", "/readiness");
      const resPrefix = await executeRequest("GET", "/api/v1/readiness");

      assert.strictEqual(resRoot.status, resPrefix.status, "Both endpoints must have matching status");
      assert.strictEqual(typeof resRoot.body.data.ready, "boolean");
      assert.strictEqual(resRoot.body.data.database, "healthy");
      assert.ok(resRoot.body.data.redis, "Must report redis status");
      assert.ok(resRoot.body.data.rateLimiter, "Must report rateLimiter status");

      // Case A: When Redis is healthy
      redisClient.isOpen = true;
      redisClient.ping = async () => "PONG";
      const resHealthy = await executeRequest("GET", "/api/v1/readiness");
      assert.strictEqual(resHealthy.status, 200);
      assert.strictEqual(resHealthy.body.data.ready, true);
      assert.strictEqual(resHealthy.body.data.redis, "healthy");
      assert.strictEqual(resHealthy.body.data.rateLimiter, "redis");

      // Case B: When Redis is down (memory rate limiter active)
      redisClient.isOpen = false;
      const resDegraded = await executeRequest("GET", "/api/v1/readiness");
      assert.strictEqual(resDegraded.status, 200, "Readiness is 200 with degraded Redis since memory fallback is active");
      assert.strictEqual(resDegraded.body.data.ready, true);
      assert.strictEqual(resDegraded.body.data.rateLimiter, "memory_fallback");

      // Case C: When database is down -> readiness returns 503
      pool.query = async () => {
        throw new Error("PostgreSQL connection error: connection refused");
      };
      const resDbDown = await executeRequest("GET", "/api/v1/readiness");
      assert.strictEqual(resDbDown.status, 503, "Readiness must be 503 when primary database is down");
      assert.strictEqual(resDbDown.body.data.ready, false);
      assert.strictEqual(resDbDown.body.data.database, "unhealthy");
    } finally {
      process.env.REPOSITORY_DRIVER = prevDriver;
    }
  });

  await t.test("6. checkRedisHealth helper reports truthful connectivity status", async () => {
    // When open and ping succeeds
    redisClient.isOpen = true;
    redisClient.ping = async () => "PONG";
    const healthOpen = await checkRedisHealth();
    assert.strictEqual(healthOpen.status, "healthy");
    assert.strictEqual(healthOpen.connected, true);

    // When ping throws error
    redisClient.ping = async () => {
      throw new Error("Redis cluster failover in progress");
    };
    const healthError = await checkRedisHealth();
    assert.strictEqual(healthError.status, "unhealthy");
    assert.strictEqual(healthError.connected, false);
    assert.ok(healthError.error.includes("failover"));

    // When client is closed / disconnected
    redisClient.isOpen = false;
    const healthClosed = await checkRedisHealth();
    assert.strictEqual(healthClosed.connected, false);
  });
});

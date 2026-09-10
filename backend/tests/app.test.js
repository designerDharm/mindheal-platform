import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import { createApp } from "../src/app.js";
import { routes } from "../src/routes/index.js";
import { appConfig } from "../src/config/app.js";
import { redisClient } from "../src/config/redis.js";
import { signAccessToken } from "../src/utils/security.js";
import { repositories } from "../src/repositories/index.js";

test("app request handling", async (t) => {
  await t.test("returns structured 500 responses for unhandled route errors", async () => {
    const route = {
      method: "GET",
      path: "/api/v1/__test/error",
      pattern: /^\/api\/v1\/__test\/error$/,
      roles: [],
      handler() {
        throw new Error("boom");
      }
    };

    const originalConsoleError = console.error;
    console.error = () => {};
    routes.unshift(route);
    try {
      const response = await request("GET", "/api/v1/__test/error");
      assert.strictEqual(response.status, 500);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error.code, "INTERNAL_SERVER_ERROR");
      assert.strictEqual(response.body.error.message, "Something went wrong.");
      assert.ok(!JSON.stringify(response.body).includes("boom"));
    } finally {
      const index = routes.indexOf(route);
      if (index >= 0) routes.splice(index, 1);
      console.error = originalConsoleError;
    }
  });

  await t.test("rejects malformed bearer tokens without throwing", async () => {
    const response = await request("GET", "/api/v1/admin/users", {
      headers: { authorization: "Bearer invalid.token.here" }
    });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error.code, "UNAUTHORIZED");
  });

  await t.test("applies in-memory rate limits outside production", async () => {
    const previousMax = appConfig.rateLimitMaxRequests;
    const previousEnv = appConfig.env;
    const previousRedisIsOpen = redisClient.isOpen;
    appConfig.rateLimitMaxRequests = 1;
    appConfig.env = "development";
    redisClient.isOpen = false;

    try {
      const ip = "10.0.0.101";
      const first = await request("GET", "/api/v1/health", { ip });
      const second = await request("GET", "/api/v1/health", { ip });

      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 429);
      assert.strictEqual(second.body.error.code, "TOO_MANY_REQUESTS");
    } finally {
      appConfig.rateLimitMaxRequests = previousMax;
      appConfig.env = previousEnv;
      redisClient.isOpen = previousRedisIsOpen;
    }
  });

  await t.test("fails closed when production rate limit store is unavailable", async () => {
    const previousEnv = appConfig.env;
    const previousRedisIsOpen = redisClient.isOpen;
    appConfig.env = "production";
    redisClient.isOpen = false;

    try {
      const response = await request("GET", "/api/v1/health", { ip: "10.0.0.102" });

      assert.strictEqual(response.status, 503);
      assert.strictEqual(response.body.error.code, "RATE_LIMIT_UNAVAILABLE");
    } finally {
      appConfig.env = previousEnv;
      redisClient.isOpen = previousRedisIsOpen;
    }
  });

  await t.test("uses Redis-backed rate limits when available", async () => {
    const previousMax = appConfig.rateLimitMaxRequests;
    const previousEnv = appConfig.env;
    const previousRedisIsOpen = redisClient.isOpen;
    const previousIncr = redisClient.incr;
    const previousExpire = redisClient.expire;
    const counts = new Map();
    const expirations = [];

    appConfig.rateLimitMaxRequests = 1;
    appConfig.env = "production";
    redisClient.isOpen = true;
    redisClient.incr = async (key) => {
      const count = (counts.get(key) || 0) + 1;
      counts.set(key, count);
      return count;
    };
    redisClient.expire = async (key, ttl) => {
      expirations.push({ key, ttl });
    };

    try {
      const ip = "10.0.0.103";
      const first = await request("GET", "/api/v1/health", { ip });
      const second = await request("GET", "/api/v1/health", { ip });

      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 429);
      assert.strictEqual(second.body.error.code, "TOO_MANY_REQUESTS");
      assert.strictEqual(expirations.length, 1);
      assert.ok(expirations[0].ttl > 0);
    } finally {
      appConfig.rateLimitMaxRequests = previousMax;
      appConfig.env = previousEnv;
      redisClient.isOpen = previousRedisIsOpen;
      redisClient.incr = previousIncr;
      redisClient.expire = previousExpire;
    }
  });

  await t.test("MH-23: Dispatcher context standardizes query, params, body, user and eliminates status mismatch", async () => {
    let capturedContext = null;
    let capturedReq = null;

    const testRoute = {
      method: "POST",
      path: "/api/v1/__test/standardized-contract/:entityId",
      pattern: /^\/api\/v1\/__test\/standardized-contract\/(?<entityId>[^/]+)$/,
      roles: [],
      handler(context) {
        capturedContext = context;
        capturedReq = context.req;
        return {
          status: 202,
          headers: { "x-test-header": "standardized" },
          body: { success: true, received: true }
        };
      }
    };

    routes.unshift(testRoute);

    try {
      const response = await request(
        "POST",
        "/api/v1/__test/standardized-contract/ent_123?serviceId=ai_chat&sort=desc&tag=a&tag=b",
        {
          body: { key: "value", num: 42 },
          headers: { "x-custom-client": "test-suite" },
          ip: "10.0.0.99"
        }
      );

      // Verify response status and custom headers
      assert.strictEqual(response.status, 202);
      assert.strictEqual(response.headers["x-test-header"], "standardized");
      assert.strictEqual(response.body.success, true);

      // Verify route parameters
      assert.strictEqual(capturedContext.params.entityId, "ent_123");
      assert.strictEqual(capturedReq.params.entityId, "ent_123");

      // Verify query parameters
      assert.strictEqual(capturedContext.query.serviceId, "ai_chat");
      assert.strictEqual(capturedContext.query.sort, "desc");
      assert.deepStrictEqual(capturedContext.query.tag, ["a", "b"]);
      assert.strictEqual(capturedReq.query.serviceId, "ai_chat");

      // Verify body
      assert.deepStrictEqual(capturedContext.body, { key: "value", num: 42 });
      assert.deepStrictEqual(capturedReq.body, { key: "value", num: 42 });

      // Verify client IP and headers
      assert.strictEqual(capturedContext.ip, "10.0.0.99");
      assert.strictEqual(capturedContext.headers["x-custom-client"], "test-suite");
    } finally {
      const idx = routes.indexOf(testRoute);
      if (idx >= 0) routes.splice(idx, 1);
    }
  });

  await t.test("MH-23: Admin instruction listing works with actual dispatcher without undefined-property errors", async () => {
    // Seed an instruction bundle in repositories
    const existing = await repositories.aiInstructionBundles.list();
    if (!existing.some(b => b.serviceId === "ai_chat")) {
      await repositories.aiInstructionBundles.create({
        id: "bdl_test_chat",
        serviceId: "ai_chat",
        name: "Chat Test Bundle",
        status: "active",
        createdBy: "usr_admin"
      });
    }
    if (!existing.some(b => b.serviceId === "ai_dream")) {
      await repositories.aiInstructionBundles.create({
        id: "bdl_test_dream",
        serviceId: "ai_dream",
        name: "Dream Test Bundle",
        status: "active",
        createdBy: "usr_admin"
      });
    }

    const adminToken = signAccessToken({ id: "usr_admin", role: "admin" });

    // 1. With query parameter filter: ?serviceId=ai_chat
    const filteredRes = await request(
      "GET",
      "/api/v1/admin/ai/instruction-bundles?serviceId=ai_chat",
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(filteredRes.status, 200);
    assert.strictEqual(filteredRes.body.success, true);
    assert.ok(Array.isArray(filteredRes.body.data));
    assert.ok(filteredRes.body.data.length > 0);
    assert.ok(filteredRes.body.data.every(b => b.serviceId === "ai_chat"));

    // 2. Without query parameter: all instruction bundles
    const allRes = await request(
      "GET",
      "/api/v1/admin/ai/instruction-bundles",
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(allRes.status, 200);
    assert.strictEqual(allRes.body.success, true);
    assert.ok(Array.isArray(allRes.body.data));
    assert.ok(allRes.body.data.length >= filteredRes.body.data.length);
  });

  await t.test("MH-23: Handler statusCode vs status mapping resolves correctly (no status mismatch)", async () => {
    // Test custom statusCode handler
    const statusRoute = {
      method: "GET",
      path: "/api/v1/__test/status-code-mapping",
      pattern: /^\/api\/v1\/__test\/status-code-mapping$/,
      roles: [],
      handler() {
        return {
          statusCode: 503,
          body: { success: false, error: { code: "SERVICE_UNAVAILABLE" } }
        };
      }
    };
    routes.unshift(statusRoute);

    try {
      const response = await request("GET", "/api/v1/__test/status-code-mapping");
      assert.strictEqual(response.status, 503, "statusCode 503 must not fall back to 200");
      assert.strictEqual(response.body.error.code, "SERVICE_UNAVAILABLE");
    } finally {
      const idx = routes.indexOf(statusRoute);
      if (idx >= 0) routes.splice(idx, 1);
    }
  });
});

async function request(method, path, { body, headers = {}, ip } = {}) {
  const reqBody = body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    "content-type": "application/json",
    ...headers
  };
  req.socket = { remoteAddress: ip || `127.0.0.${Math.floor(Math.random() * 200) + 1}` };

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

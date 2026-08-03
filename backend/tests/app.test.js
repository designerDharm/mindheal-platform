import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import { createApp } from "../src/app.js";
import { routes } from "../src/routes/index.js";
import { appConfig } from "../src/config/app.js";
import { redisClient } from "../src/config/redis.js";

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
    body: res.payload ? JSON.parse(res.payload) : null
  };
}

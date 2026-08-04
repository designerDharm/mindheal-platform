import { routes } from "./routes/index.js";
import { forbidden, internalServerError, json, notFound, parseBody, send, unauthorized } from "./utils/http.js";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";
import { appConfig } from "./config/app.js";
import { redisClient } from "./config/redis.js";
import { hashValue } from "./utils/security.js";

const rateLimitStore = new Map();

async function applyRateLimit(ip) {
  if (redisClient.isOpen) {
    try {
      return await applyRedisRateLimit(ip);
    } catch {
      return { status: "unavailable" };
    }
  }

  if (appConfig.env === "production") {
    return { status: "unavailable" };
  }

  return applyMemoryRateLimit(ip);
}

function applyMemoryRateLimit(ip) {
  const now = Date.now();
  let record = rateLimitStore.get(ip);
  if (!record || record.resetTime < now) {
    record = { count: 1, resetTime: now + appConfig.rateLimitWindowMs };
  } else {
    record.count++;
  }
  rateLimitStore.set(ip, record);

  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetTime < now) rateLimitStore.delete(key);
    }
  }

  return { status: record.count <= appConfig.rateLimitMaxRequests ? "allowed" : "blocked" };
}

async function applyRedisRateLimit(ip) {
  const bucket = Math.floor(Date.now() / appConfig.rateLimitWindowMs);
  const key = `rate_limit:${hashValue(`${ip}:${bucket}`)}`;
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, Math.ceil(appConfig.rateLimitWindowMs / 1000));
  }
  return { status: count <= appConfig.rateLimitMaxRequests ? "allowed" : "blocked" };
}

export function createApp() {
  return {
    async handle(req, res) {
      try {
        applyHeaders(req, res);
        
        if (req.method === "OPTIONS") {
          return send(res, 204, null);
        }

        const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
        const rateLimit = await applyRateLimit(clientIp);
        if (rateLimit.status === "unavailable") {
          return json(res, 503, { success: false, error: { code: "RATE_LIMIT_UNAVAILABLE", message: "Rate limit store is unavailable." } });
        }
        if (rateLimit.status === "blocked") {
          return json(res, 429, { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." } });
        }

        const url = new URL(req.url, "http://localhost");
        const route = routes.find((item) => item.method === req.method && item.pattern.test(url.pathname));

        if (!route) {
          return notFound(res);
        }

        const match = url.pathname.match(route.pattern);
        const params = match?.groups || {};
        let body = {};
        const contentType = req.headers["content-type"] || "";
        if (!contentType.includes("multipart/form-data")) {
          try {
            body = await parseBody(req);
          } catch (e) {
            if (e.message === "PAYLOAD_TOO_LARGE") {
              return json(res, 413, { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." } });
            }
            return json(res, 400, { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } });
          }
        }

        const authResult = await authenticate(req, route);
        if (authResult.error) {
          return json(res, authResult.error.status, authResult.error.body);
        }

        const context = { req, res, url, params, body, user: authResult.user };
        const result = await route.handler(context);
        return json(res, result.status || 200, result.body ?? result);
      } catch (error) {
        console.error("[App] Unhandled request error", error);
        if (res.writableEnded) return;
        const response = internalServerError();
        return json(res, response.status, response.body);
      }
    }
  };
}

async function authenticate(req, route) {
  if (!route.roles?.length) return { user: null };

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const payload = verifyAccessToken(token);

  if (!payload) return { error: unauthorized() };

  const user = await repositories.users.findById(payload.sub);
  if (!user) return { error: unauthorized("User session is no longer active.") };
  if (!route.roles.includes(user.role)) return { error: forbidden() };

  // Non-negotiable product rule: Block guardian accounts from accessing AI features or private user content
  if (user.role === "guardian" && (req.url.includes("/ai/") || req.url.includes("/analysis/"))) {
    return { error: forbidden("Guardian accounts are prohibited from accessing private AI or assessment data.") };
  }

  // Non-negotiable product rule: Server-side age enforcement for adult generative AI endpoints
  if (route.requireAdult) {
    const isAdult = calculateAge(user.dateOfBirth) >= 18;
    if (!isAdult) {
      return { error: forbidden("Generative AI services are restricted to verified adult users aged 18 or above.") };
    }
  }

  return { user };
}

function calculateAge(dobString) {
  if (!dobString) return 20; // Default adult fallback if DOB not populated in legacy seed
  const dob = new Date(dobString);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function applyHeaders(req, res) {
  const origin = req.headers.origin;
  if (appConfig.allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
  } else if (appConfig.allowedOrigins.includes("*")) {
    res.setHeader("access-control-allow-origin", "*");
  }
  
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-idempotency-key");
  res.setHeader("access-control-max-age", "86400"); // 24 hours preflight cache
  
  // Security Headers
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("x-xss-protection", "1; mode=block");
  res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
}

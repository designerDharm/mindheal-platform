import { routes } from "./routes/index.js";
import { forbidden, internalServerError, json, notFound, parseBody, send, unauthorized } from "./utils/http.js";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";
import { appConfig } from "./config/app.js";
import { redisClient } from "./config/redis.js";
import { hashValue } from "./utils/security.js";
import { calculateAgeFromDob } from "./utils/validation.js";

const rateLimitStore = new Map();

export function resetMemoryRateLimits() {
  rateLimitStore.clear();
}

async function applyRateLimit(ip) {
  // Bypass rate limiting for localhost in non-production environments
  if (appConfig.env !== "production") {
    const isLocalhost = ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || (ip || "").startsWith("::ffff:127.");
    if (isLocalhost) return { status: "allowed" };
  }

  if (redisClient.isOpen) {
    try {
      return await applyRedisRateLimit(ip);
    } catch (err) {
      console.warn("[RateLimit] Redis rate limit check failed, falling back to memory store:", err.message);
    }
  }

  // Graceful degradation: Fall back to memory bucket rate limiter with active protection
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

        // HTTPS verification & safe redirection in production
        if (appConfig.env === "production" && appConfig.enforceHttps) {
          const proto = req.headers["x-forwarded-proto"];
          const isHttp = proto === "http";
          if (isHttp) {
            // Exempt ACME challenge verification and load-balancer health checks from redirect
            const isExempt = req.url.startsWith("/.well-known/acme-challenge/") ||
              req.url === "/health" || req.url.startsWith("/health?") ||
              req.url === "/readiness" || req.url.startsWith("/readiness?") ||
              req.url === "/api/v1/health" || req.url.startsWith("/api/v1/health?") ||
              req.url === "/api/v1/readiness" || req.url.startsWith("/api/v1/readiness?");
            
            if (!isExempt) {
              const host = req.headers.host || appConfig.canonicalHostname;
              const target = `https://${host}${req.url}`;
              res.writeHead(301, {
                Location: target,
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload"
              });
              res.end();
              return;
            }
          }
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

        const query = {};
        for (const [key, value] of url.searchParams.entries()) {
          if (query[key] !== undefined) {
            if (Array.isArray(query[key])) {
              query[key].push(value);
            } else {
              query[key] = [query[key], value];
            }
          } else {
            query[key] = value;
          }
        }

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

        req.query = query;
        req.params = params;
        req.body = body;
        req.user = authResult.user;

        const context = {
          req,
          res,
          url,
          params,
          query,
          body,
          user: authResult.user,
          ip: clientIp,
          headers: req.headers
        };
        const result = await route.handler(context);
        if (res.writableEnded) return;

        if (result?.headers && typeof result.headers === "object") {
          for (const [headerName, headerValue] of Object.entries(result.headers)) {
            res.setHeader(headerName, headerValue);
          }
        }

        const statusCode = result?.status ?? result?.statusCode ?? 200;
        const responseBody = result?.body !== undefined ? result.body : result;
        return json(res, statusCode, responseBody);
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

  if (user.isActive === false || user.status === "disabled" || user.status === "suspended") {
    return { error: forbidden("User account is disabled.", { code: "ACCOUNT_DISABLED" }) };
  }

  if (redisClient.isOpen) {
    try {
      const isRevoked = await redisClient.get(`revoked_user:${payload.sub}`);
      if (isRevoked) {
        return { error: forbidden("User account is disabled.", { code: "ACCOUNT_DISABLED" }) };
      }
    } catch {
      // Continue if Redis query fails
    }
  }
  
  const userAge = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
  const isMinorUser = user.role === "user" && userAge !== null && userAge >= 15 && userAge < 18;
  if (isMinorUser && (!user.isGuardianConsentVerified || user.guardianConsentStatus !== "APPROVED" || user.onboardingStatus === "PENDING_GUARDIAN")) {
    if (!req.url.includes("/user/me") && !req.url.includes("/auth/logout") && !req.url.includes("/auth/refresh")) {
      return { error: forbidden("Parent/guardian approval is required before your account can access MindHeal services.", { code: "GUARDIAN_CONSENT_REQUIRED" }) };
    }
  }

  if (user.onboardingStatus !== "COMPLETED" && !req.url.includes("/user/me") && !req.url.includes("/auth/logout") && !req.url.includes("/auth/refresh")) {
    return { error: forbidden("Your profile onboarding is incomplete. Please complete your profile to access this resource.") };
  }

  if (!route.roles.includes(user.role)) return { error: forbidden() };

  // Non-negotiable product rule: Block guardian accounts from accessing AI features or private user content
  if (user.role === "guardian" && (req.url.includes("/ai/") || req.url.includes("/analysis/"))) {
    return { error: forbidden("Guardian accounts are prohibited from accessing private AI or assessment data.") };
  }

  // Non-negotiable product rule: Server-side age enforcement for adult generative AI endpoints
  if (route.requireAdult) {
    const age = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
    if (age === null || age < 18) {
      return { error: forbidden("Generative AI services are restricted to verified adult users aged 18 or above.") };
    }
  }

  return { user };
}

function applyHeaders(req, res) {
  const origin = req.headers.origin;
  const isAllowed = origin && (appConfig.allowedOrigins.includes(origin) || appConfig.allowedOrigins.includes("*"));
  if (isAllowed) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
  } else {
    const defaultOrigin = appConfig.allowedOrigins.find(o => o !== "*") || "http://localhost:4173";
    res.setHeader("access-control-allow-origin", defaultOrigin);
    res.setHeader("access-control-allow-credentials", "true");
  }
  
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-idempotency-key,x-mock-test");
  res.setHeader("access-control-max-age", "86400"); // 24 hours preflight cache
  
  // Security Headers
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("x-xss-protection", "1; mode=block");
  res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("content-security-policy", "default-src 'self' https:; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; upgrade-insecure-requests;");
}

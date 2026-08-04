const env = process.env.NODE_ENV || "development";
const jwtAccessSecret = resolveJwtSecret("JWT_ACCESS_SECRET", "development-access-secret-change-me", env);
const jwtRefreshSecret = resolveJwtSecret("JWT_REFRESH_SECRET", "development-refresh-secret-change-me", env);
const allowedOrigins = resolveAllowedOrigins(env);

export const appConfig = {
  env,
  port: Number(process.env.PORT || 4000),
  apiPrefix: "/api/v1",
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  reportUnlockPriceInr: 49,
  platformCommissionPercent: 10,
  defaultLanguage: "en",
  supportedRoles: ["user", "counsellor", "admin"],
  allowFirebaseAuthMock: process.env.FIREBASE_AUTH_MOCK_ENABLED === "true" && process.env.NODE_ENV !== "production",
  allowedOrigins,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMaxRequests: 1000
};

function resolveJwtSecret(envName, developmentFallback, currentEnv) {
  const value = process.env[envName] || "";
  if (currentEnv !== "production") {
    return value || developmentFallback;
  }

  if (!value) {
    throw new Error(`${envName} must be configured in production.`);
  }
  if (isWeakJwtSecret(value, developmentFallback)) {
    throw new Error(`${envName} is too weak for production.`);
  }
  return value;
}

function isWeakJwtSecret(value, developmentFallback) {
  const normalized = String(value).trim();
  const lower = normalized.toLowerCase();
  return normalized.length < 32 ||
    normalized === developmentFallback ||
    lower.includes("change-me") ||
    lower.includes("your_super_secret") ||
    lower.includes("secret_key") ||
    lower.includes("example");
}

function resolveAllowedOrigins(currentEnv) {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (currentEnv !== "production") {
    return configured.length ? configured : ["http://localhost:4000", "http://127.0.0.1:4000", "*"];
  }

  if (!configured.length) {
    throw new Error("ALLOWED_ORIGINS must be configured in production.");
  }
  if (configured.includes("*")) {
    throw new Error("ALLOWED_ORIGINS cannot include '*' in production.");
  }

  const invalid = configured.find((origin) => !/^https?:\/\/[^,\s]+$/i.test(origin));
  if (invalid) {
    throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${invalid}`);
  }

  return configured;
}

import dotenv from 'dotenv';
dotenv.config();

const env = process.env.NODE_ENV || "development";
const jwtAccessSecret = resolveJwtSecret("JWT_ACCESS_SECRET", "development-access-secret-change-me", env);
const jwtRefreshSecret = resolveJwtSecret("JWT_REFRESH_SECRET", "development-refresh-secret-change-me", env);
const allowedOrigins = resolveAllowedOrigins(env);

const isOtpTestMode = process.env.OTP_TEST_MODE === "true";
if (env === "production" && isOtpTestMode) {
  throw new Error("SECURITY_FATAL: OTP_TEST_MODE=true is strictly forbidden in production environment.");
}

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
  commissionRateBps: 1000, // Exactly 10% (1000 basis points)
  directGatewayEnabled: true, // Default production direct gateway payment mode
  walletInrEnabled: process.env.WALLET_INR_ENABLED === "true", // Disabled by default for legal compliance
  defaultLanguage: "en",
  supportedRoles: ["user", "counsellor", "admin"],
  allowFirebaseAuthMock: process.env.FIREBASE_AUTH_MOCK_ENABLED === "true" && process.env.NODE_ENV !== "production",
  isOtpTestMode: env === "test" || (env !== "production" && isOtpTestMode),
  allowedOrigins,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMaxRequests: 1000,
  peerTalk: {
    enabled: process.env.PEER_TALK_ENABLED === "true" || env !== "production",
    payAndTalkEnabled: process.env.PEER_PAY_AND_TALK_ENABLED === "true" || env !== "production",
    talkAndEarnEnabled: process.env.PEER_TALK_AND_EARN_ENABLED === "true" || env !== "production",
    voiceEnabled: process.env.PEER_VOICE_ENABLED === "true" || env !== "production",
    videoEnabled: process.env.PEER_VIDEO_ENABLED === "true" || env !== "production",
    fileSharingEnabled: process.env.PEER_FILE_SHARING_ENABLED === "true" || env !== "production",
    newListenerApplicationsEnabled: process.env.PEER_NEW_LISTENER_APPLICATIONS_ENABLED === "true" || env !== "production",
    directPaymentEnabled: process.env.PEER_DIRECT_PAYMENT_ENABLED !== "false",
    walletPaymentEnabled: process.env.PEER_WALLET_PAYMENT_ENABLED === "true" || env !== "production",
    autoPayoutEnabled: process.env.PEER_AUTO_PAYOUT_ENABLED === "true"
  }
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

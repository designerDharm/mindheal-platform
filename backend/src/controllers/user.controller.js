import { repositories } from "../repositories/index.js";
import { sanitizeUser } from "../services/auth.service.js";
import { badRequest, created, ok } from "../utils/http.js";
import { createId } from "../utils/security.js";

export async function getMe({ user }) {
  return ok(sanitizeUser(await repositories.users.findById(user.id)));
}

export async function updateMe({ body, user }) {
  const forbiddenKeys = ["role", "passwordHash", "password_hash", "is_active", "isActive", "isGuardianConsentVerified", "is_guardian_consent_verified", "totp_secret", "totpSecret", "verificationStatus", "verification_status"];
  const presentForbidden = forbiddenKeys.filter((key) => body[key] !== undefined);
  if (presentForbidden.length > 0) {
    return badRequest(`Modification of privilege or security fields is forbidden: ${presentForbidden.join(", ")}`);
  }

  const allowedKeys = ["fullName", "languageCode", "avatarUrl", "mobile"];
  const patch = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const record = await repositories.users.update(user.id, patch);
  return ok(sanitizeUser(record));
}

export async function logMood({ body, user }) {
  const mood = { id: createId("mood"), userId: user.id, createdAt: new Date().toISOString(), ...body };
  return created(await repositories.moodLogs.create(mood));
}

export async function getMoodHistory({ user }) {
  return ok(await repositories.moodLogs.listByUser(user.id));
}

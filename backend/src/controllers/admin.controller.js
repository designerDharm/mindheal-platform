import { repositories } from "../repositories/index.js";
import { sanitizeUser } from "../services/auth.service.js";
import { decryptSecret, encryptSecret } from "../services/secret.service.js";
import { badRequest, ok } from "../utils/http.js";
import { maskSecret } from "../utils/security.js";

export async function users() {
  return ok((await repositories.users.list()).map(sanitizeUser));
}

export async function counsellors() {
  return ok({ approved: await repositories.counsellors.listAll(), applications: await repositories.counsellorApplications.list() });
}

export async function verifyCounsellor({ params, body, user }) {
  const result = await repositories.counsellorApplications.updateVerification(params.id, body.action, body.reason || "");
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "VERIFY_COUNSELLOR",
    entityType: "CounsellorApplication",
    entityId: params.id,
    newValue: { action: body.action, reason: body.reason || "" }
  });

  return ok(result);
}

export async function apiConfig() {
  return ok((await repositories.apiConfigurations.list()).map(sanitizeApiConfig));
}

export async function updateApiConfig({ params, body, user }) {
  const serviceName = decodeURIComponent(params.service);
  const patch = {
    ...body,
    provider: body.provider ? String(body.provider).toLowerCase() : undefined,
    isActive: body.isActive ?? body.isEnabled ?? false
  };
  delete patch.isEnabled;
  if (!patch.provider) delete patch.provider;
  if (patch.apiKeyEncrypted) {
    patch.apiKeyEncrypted = encryptSecret(patch.apiKeyEncrypted);
  } else {
    delete patch.apiKeyEncrypted;
  }
  const config = await repositories.apiConfigurations.upsert(serviceName, patch);
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_API_CONFIG",
    entityType: "ApiConfiguration",
    entityId: serviceName,
    newValue: {
      provider: patch.provider,
      modelName: patch.modelName,
      isActive: patch.isActive,
      hasApiKey: Boolean(patch.apiKeyEncrypted)
    }
  });

  return ok(sanitizeApiConfig(config));
}

export async function aiServices() {
  return ok(await repositories.aiServices.list());
}

export async function updateAiService({ params, body, user }) {
  const serviceKey = decodeURIComponent(params.id);
  const result = await repositories.aiServices.upsert(serviceKey, body);

  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_AI_SERVICE",
    entityType: "AiService",
    entityId: serviceKey,
    newValue: body
  });

  return ok(result);
}

export async function listInstructionBundles({ query }) {
  return ok(await repositories.aiInstructionBundles.list(query.serviceId));
}

export async function createInstructionBundle({ body, user }) {
  const bundle = {
    id: `bdl_${Date.now()}`,
    ...body,
    status: body.status || "draft",
    createdBy: user.id,
    createdAt: new Date().toISOString()
  };
  const result = await repositories.aiInstructionBundles.create(bundle);

  await repositories.auditLogs.create({
    userId: user.id,
    action: "CREATE_INSTRUCTION_BUNDLE",
    entityType: "AiInstructionBundle",
    entityId: bundle.id,
    newValue: { serviceId: bundle.serviceId, version: bundle.version }
  });

  return ok(result);
}

export async function activateInstructionBundle({ params, user }) {
  const result = await repositories.aiInstructionBundles.activate(params.id);
  if (!result) return badRequest("Instruction bundle not found.");

  await repositories.auditLogs.create({
    userId: user.id,
    action: "ACTIVATE_INSTRUCTION_BUNDLE",
    entityType: "AiInstructionBundle",
    entityId: params.id,
    newValue: { activatedAt: result.activatedAt }
  });

  return ok(result);
}

function sanitizeApiConfig(config) {
  const keyForDisplay = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : "";
  return { ...config, apiKeyEncrypted: maskSecret(keyForDisplay) };
}

export async function services() {
  return ok(await repositories.servicesCatalog.list());
}

export async function updateService({ params, body, user }) {
  const result = await repositories.servicesCatalog.update(params.id, body);
  if (!result) return badRequest("Service not found.");
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_SERVICE_CATALOG",
    entityType: "ServiceCatalog",
    entityId: params.id,
    newValue: body
  });

  return ok(result);
}

export async function transactions() {
  return ok(await repositories.wallets.allLedgerEntries());
}

export async function contacts({ query = {} }) {
  return ok(await repositories.contacts.list({ status: query.status }));
}

export async function updateContactStatus({ params, body, user }) {
  const status = body.status || "handled";
  if (!["new", "in_review", "handled", "archived"].includes(status)) {
    return badRequest("Invalid contact status.");
  }
  const result = await repositories.contacts.updateStatus(params.id, status);
  if (!result) return badRequest("Contact lead not found.");

  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_CONTACT_STATUS",
    entityType: "Contact",
    entityId: params.id,
    newValue: { status }
  });

  return ok(result);
}

export async function analyticsSummary() {
  return ok(await repositories.analytics.summary());
}

export async function auditLogs({ query = {} }) {
  const limit = parseInt(query.limit) || 50;
  const offset = parseInt(query.offset) || 0;
  const logs = await repositories.auditLogs.list(limit, offset);
  return ok(logs);
}

export async function crisisEvents({ query = {} }) {
  const limit = parseInt(query.limit) || 50;
  const offset = parseInt(query.offset) || 0;
  return ok(await repositories.crisisEvents.list(limit, offset));
}

export async function peerListeners() {
  const list = await repositories.peerListenerProfiles.list();
  const detailed = [];
  for (const item of list) {
    const verification = await repositories.peerListenerVerifications.findByProfileId(item.id);
    const presence = await repositories.peerListenerPresence.findByProfileId(item.id);
    detailed.push({ ...item, verification, presence });
  }
  return ok(detailed);
}

export async function peerListenerApplications() {
  const list = await repositories.peerListenerProfiles.list({ verificationStatus: "pending" });
  const detailed = [];
  for (const item of list) {
    const verification = await repositories.peerListenerVerifications.findByProfileId(item.id);
    detailed.push({ ...item, verification });
  }
  return ok(detailed);
}

export async function approvePeerListener({ params, user }) {
  const profile = await repositories.peerListenerProfiles.findById(params.id);
  if (!profile) return badRequest("Peer listener profile not found.");

  const updatedProfile = await repositories.peerListenerProfiles.update(params.id, {
    verificationStatus: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: user.id
  });

  const verification = await repositories.peerListenerVerifications.findByProfileId(params.id);
  if (verification) {
    await repositories.peerListenerVerifications.update(verification.id, {
      identityVerificationStatus: "approved",
      selfieLivenessStatus: "approved",
      panVerificationStatus: "approved",
      payoutAccountStatus: "approved",
      trainingAcknowledgementStatus: "approved",
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString()
    });
  }

  await repositories.auditLogs.create({
    userId: user.id,
    action: "APPROVE_PEER_LISTENER",
    entityType: "PeerListenerProfile",
    entityId: params.id,
    newValue: { status: "approved" }
  });

  return ok(updatedProfile);
}

export async function rejectPeerListener({ params, body, user }) {
  const profile = await repositories.peerListenerProfiles.findById(params.id);
  if (!profile) return badRequest("Peer listener profile not found.");

  const updatedProfile = await repositories.peerListenerProfiles.update(params.id, {
    verificationStatus: "rejected"
  });

  const verification = await repositories.peerListenerVerifications.findByProfileId(params.id);
  if (verification) {
    await repositories.peerListenerVerifications.update(verification.id, {
      identityVerificationStatus: "rejected",
      selfieLivenessStatus: "rejected",
      panVerificationStatus: "rejected",
      payoutAccountStatus: "rejected",
      trainingAcknowledgementStatus: "rejected",
      rejectionReason: body.reason || "Does not meet community standards",
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString()
    });
  }

  await repositories.auditLogs.create({
    userId: user.id,
    action: "REJECT_PEER_LISTENER",
    entityType: "PeerListenerProfile",
    entityId: params.id,
    newValue: { status: "rejected", reason: body.reason }
  });

  return ok(updatedProfile);
}

export async function suspendPeerListener({ params, body, user }) {
  const profile = await repositories.peerListenerProfiles.findById(params.id);
  if (!profile) return badRequest("Peer listener profile not found.");

  const updatedProfile = await repositories.peerListenerProfiles.update(params.id, {
    verificationStatus: "suspended",
    suspendedAt: new Date().toISOString(),
    suspensionReason: body.reason || "Policy violations"
  });

  await repositories.auditLogs.create({
    userId: user.id,
    action: "SUSPEND_PEER_LISTENER",
    entityType: "PeerListenerProfile",
    entityId: params.id,
    newValue: { status: "suspended", reason: body.reason }
  });

  return ok(updatedProfile);
}

export async function getPromotionalBanners() {
  return ok(await repositories.promotionalBanners.listAll());
}

export async function createPromotionalBanner({ body, user }) {
  if (!body.message) return badRequest("Message is required");
  const banner = await repositories.promotionalBanners.create({
    message: body.message,
    isActive: body.isActive || false
  });
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "CREATE_PROMO_BANNER",
    entityType: "PromotionalBanner",
    entityId: banner.id,
    newValue: banner
  });
  
  return ok(banner);
}

export async function updatePromotionalBanner({ params, body, user }) {
  const banner = await repositories.promotionalBanners.update(params.id, body);
  if (!banner) return badRequest("Banner not found");
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_PROMO_BANNER",
    entityType: "PromotionalBanner",
    entityId: params.id,
    newValue: body
  });
  
  return ok(banner);
}

export async function deletePromotionalBanner({ params, user }) {
  const success = await repositories.promotionalBanners.delete(params.id);
  if (!success) return badRequest("Banner not found");
  
  await repositories.auditLogs.create({
    userId: user.id,
    action: "DELETE_PROMO_BANNER",
    entityType: "PromotionalBanner",
    entityId: params.id,
    newValue: null
  });
  
  return ok({ success: true });
}

import { executeWeeklyPayoutBatch } from "../services/payout.service.js";
import { revokeUserSessions } from "../services/auth.service.js";
import { disconnectUserSockets } from "../socket.js";

export async function runPayoutBatch({ user }) {
  const result = await executeWeeklyPayoutBatch(user.id);
  return ok(result);
}

export async function updateUserStatus({ params, body, user }) {
  const targetUserId = params.id;
  const targetUser = await repositories.users.findById(targetUserId);
  if (!targetUser) return badRequest("User not found");

  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : (body.status === "disabled" || body.status === "suspended" ? false : undefined);
  const patch = {};
  if (isActive !== undefined) patch.isActive = isActive;
  if (body.status !== undefined) patch.status = body.status;

  const updated = await repositories.users.update(targetUserId, patch);

  if (isActive === false || body.status === "disabled" || body.status === "suspended") {
    await revokeUserSessions(targetUserId);
    disconnectUserSockets(targetUserId);
  }

  await repositories.auditLogs.create({
    userId: user.id,
    action: "UPDATE_USER_STATUS",
    entityType: "User",
    entityId: targetUserId,
    newValue: patch
  });

  return ok(sanitizeUser(updated));
}

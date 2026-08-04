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

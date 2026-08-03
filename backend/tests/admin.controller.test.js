import test from "node:test";
import assert from "node:assert";
import { crisisEvents, updateApiConfig, updateContactStatus, updateService, verifyCounsellor } from "../src/controllers/admin.controller.js";
import { repositories } from "../src/repositories/index.js";
import { decryptSecret, isEncryptedSecret } from "../src/services/secret.service.js";

test("admin controller", async (t) => {
  await t.test("encrypts API keys before storing admin API config", async () => {
    const previousKey = process.env.API_CONFIG_ENCRYPTION_KEY;
    const originalRepo = repositories.apiConfigurations;
    const originalAudit = repositories.auditLogs;
    process.env.API_CONFIG_ENCRYPTION_KEY = "test_api_config_encryption_key_32_chars";

    let storedPatch = null;
    let auditEntry = null;
    repositories.apiConfigurations = {
      upsert: async (serviceName, patch) => {
        storedPatch = patch;
        return { id: "cfg_test", serviceName, ...patch };
      }
    };
    repositories.auditLogs = {
      create: async (entry) => {
        auditEntry = entry;
        return entry;
      }
    };

    try {
      const response = await updateApiConfig({
        params: { service: "OpenAI" },
        body: {
          provider: "OpenAI",
          modelName: "gpt-test",
          apiKeyEncrypted: "sk-live-secret",
          isActive: true
        },
        user: { id: "usr_admin" }
      });

      assert.strictEqual(response.status, 200);
      assert.ok(isEncryptedSecret(storedPatch.apiKeyEncrypted));
      assert.strictEqual(decryptSecret(storedPatch.apiKeyEncrypted), "sk-live-secret");
      assert.strictEqual(response.body.data.apiKeyEncrypted, "sk-l••••cret");
      assert.strictEqual(auditEntry.entityType, "ApiConfiguration");
      assert.strictEqual(auditEntry.entityId, "OpenAI");
      assert.deepStrictEqual(auditEntry.newValue, {
        provider: "openai",
        modelName: "gpt-test",
        isActive: true,
        hasApiKey: true
      });
      assert.strictEqual(auditEntry.details, undefined);
    } finally {
      repositories.apiConfigurations = originalRepo;
      repositories.auditLogs = originalAudit;
      restoreEnv("API_CONFIG_ENCRYPTION_KEY", previousKey);
    }
  });

  await t.test("writes normalized audit events for counsellor verification", async () => {
    const originalApplications = repositories.counsellorApplications;
    const originalAudit = repositories.auditLogs;
    let auditEntry = null;

    repositories.counsellorApplications = {
      updateVerification: async (id, action, reason) => ({ id, status: action, reviewReason: reason })
    };
    repositories.auditLogs = {
      create: async (entry) => {
        auditEntry = entry;
        return entry;
      }
    };

    try {
      const response = await verifyCounsellor({
        params: { id: "app_test" },
        body: { action: "approve", reason: "Credentials verified" },
        user: { id: "usr_admin" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(auditEntry.action, "VERIFY_COUNSELLOR");
      assert.strictEqual(auditEntry.entityType, "CounsellorApplication");
      assert.strictEqual(auditEntry.entityId, "app_test");
      assert.deepStrictEqual(auditEntry.newValue, {
        action: "approve",
        reason: "Credentials verified"
      });
      assert.strictEqual(auditEntry.details, undefined);
    } finally {
      repositories.counsellorApplications = originalApplications;
      repositories.auditLogs = originalAudit;
    }
  });

  await t.test("audits service catalog updates with normalized payloads", async () => {
    const originalServices = repositories.servicesCatalog;
    const originalAudit = repositories.auditLogs;
    let auditEntry = null;

    repositories.servicesCatalog = {
      update: async (id, patch) => ({ id, ...patch })
    };
    repositories.auditLogs = {
      create: async (entry) => {
        auditEntry = entry;
        return entry;
      }
    };

    try {
      const response = await updateService({
        params: { id: "svc_dream" },
        body: { isActive: false, priceInr: 79 },
        user: { id: "usr_admin" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(auditEntry.action, "UPDATE_SERVICE_CATALOG");
      assert.strictEqual(auditEntry.entityType, "ServiceCatalog");
      assert.strictEqual(auditEntry.entityId, "svc_dream");
      assert.deepStrictEqual(auditEntry.newValue, { isActive: false, priceInr: 79 });
    } finally {
      repositories.servicesCatalog = originalServices;
      repositories.auditLogs = originalAudit;
    }
  });

  await t.test("does not audit missing service catalog updates", async () => {
    const originalServices = repositories.servicesCatalog;
    const originalAudit = repositories.auditLogs;
    let auditWritten = false;

    repositories.servicesCatalog = {
      update: async () => null
    };
    repositories.auditLogs = {
      create: async () => {
        auditWritten = true;
      }
    };

    try {
      const response = await updateService({
        params: { id: "missing_service" },
        body: { isActive: false },
        user: { id: "usr_admin" }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Service not found.");
      assert.strictEqual(auditWritten, false);
    } finally {
      repositories.servicesCatalog = originalServices;
      repositories.auditLogs = originalAudit;
    }
  });

  await t.test("audits contact status updates with normalized payloads", async () => {
    const originalContacts = repositories.contacts;
    const originalAudit = repositories.auditLogs;
    let auditEntry = null;

    repositories.contacts = {
      updateStatus: async (id, status) => ({ id, status })
    };
    repositories.auditLogs = {
      create: async (entry) => {
        auditEntry = entry;
        return entry;
      }
    };

    try {
      const response = await updateContactStatus({
        params: { id: "cnt_test" },
        body: { status: "handled" },
        user: { id: "usr_admin" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(auditEntry.action, "UPDATE_CONTACT_STATUS");
      assert.strictEqual(auditEntry.entityType, "Contact");
      assert.strictEqual(auditEntry.entityId, "cnt_test");
      assert.deepStrictEqual(auditEntry.newValue, { status: "handled" });
    } finally {
      repositories.contacts = originalContacts;
      repositories.auditLogs = originalAudit;
    }
  });

  await t.test("lists crisis events for admins without raw detected text", async () => {
    const originalCrisisEvents = repositories.crisisEvents;
    let receivedLimit = null;
    let receivedOffset = null;

    repositories.crisisEvents = {
      list: async (limit, offset) => {
        receivedLimit = limit;
        receivedOffset = offset;
        return [{
          id: "cri_test",
          userId: "usr_safety",
          source: "ai_chat",
          riskLevel: "high",
          detectedTextHash: "hashed_message_value",
          actionTaken: "show_crisis_resources",
          createdAt: new Date().toISOString()
        }];
      }
    };

    try {
      const response = await crisisEvents({ query: { limit: "10", offset: "5" } });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(receivedLimit, 10);
      assert.strictEqual(receivedOffset, 5);
      assert.strictEqual(response.body.data.length, 1);
      assert.strictEqual(response.body.data[0].detectedTextHash, "hashed_message_value");
      assert.ok(!JSON.stringify(response.body.data).includes("I want to kill myself"));
    } finally {
      repositories.crisisEvents = originalCrisisEvents;
    }
  });
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

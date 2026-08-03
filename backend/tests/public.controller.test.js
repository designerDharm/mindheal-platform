import test from "node:test";
import assert from "node:assert";
import { publicConfig } from "../src/controllers/public.controller.js";
import { repositories } from "../src/repositories/index.js";
import { encryptSecret } from "../src/services/secret.service.js";

test("public controller", async (t) => {
  await t.test("api config repository should resolve aliases", () => {
    const chatConfig = repositories.apiConfigurations.find("chat");
    const dreamConfig = repositories.apiConfigurations.find("report_dream");

    assert.strictEqual(chatConfig.serviceName, "AI Counselling Chat");
    assert.strictEqual(dreamConfig.serviceName, "Dream Analysis PDF Report");
  });

  await t.test("publicConfig should return google-maps api key when enabled", async () => {
    // Mock the repository
    const originalRepo = repositories.apiConfigurations;
    repositories.apiConfigurations = {
      find: (service) => {
        if (service === "google-maps") {
          return { serviceName: "google-maps", isActive: true, apiKeyEncrypted: "mock_key" };
        }
        return null;
      }
    };

    const res = await publicConfig();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.mapsApiKey, "mock_key");

    // Restore
    repositories.apiConfigurations = originalRepo;
  });

  await t.test("publicConfig should accept display-name config labels", async () => {
    const originalRepo = repositories.apiConfigurations;
    repositories.apiConfigurations = {
      find: (service) => {
        if (service === "google-maps") {
          return { serviceName: "Google Maps", isActive: true, apiKeyEncrypted: "display_label_key" };
        }
        return null;
      }
    };

    const res = await publicConfig();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.mapsApiKey, "display_label_key");

    repositories.apiConfigurations = originalRepo;
  });

  await t.test("publicConfig should not return key if disabled", async () => {
    const originalRepo = repositories.apiConfigurations;
    repositories.apiConfigurations = {
      find: (service) => {
        if (service === "google-maps") {
          return { serviceName: "google-maps", isActive: false, apiKeyEncrypted: "mock_key" };
        }
        return null;
      }
    };

    const res = await publicConfig();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.mapsApiKey, null);

    repositories.apiConfigurations = originalRepo;
  });

  await t.test("publicConfig should decrypt encrypted google maps api keys", async () => {
    const previousKey = process.env.API_CONFIG_ENCRYPTION_KEY;
    process.env.API_CONFIG_ENCRYPTION_KEY = "test_api_config_encryption_key_32_chars";
    const encryptedKey = encryptSecret("google-maps-live-key");
    const originalRepo = repositories.apiConfigurations;
    repositories.apiConfigurations = {
      find: (service) => {
        if (service === "google-maps") {
          return { serviceName: "google-maps", isActive: true, apiKeyEncrypted: encryptedKey };
        }
        return null;
      }
    };

    try {
      const res = await publicConfig();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.mapsApiKey, "google-maps-live-key");
    } finally {
      repositories.apiConfigurations = originalRepo;
      if (previousKey === undefined) delete process.env.API_CONFIG_ENCRYPTION_KEY;
      else process.env.API_CONFIG_ENCRYPTION_KEY = previousKey;
    }
  });
});

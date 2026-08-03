import test from "node:test";
import assert from "node:assert";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../src/services/secret.service.js";

test("secret service", async (t) => {
  await t.test("encrypts and decrypts API config secrets", () => {
    const previousKey = process.env.API_CONFIG_ENCRYPTION_KEY;
    process.env.API_CONFIG_ENCRYPTION_KEY = "test_api_config_encryption_key_32_chars";

    try {
      const encrypted = encryptSecret("sk-live-secret");

      assert.ok(isEncryptedSecret(encrypted));
      assert.notStrictEqual(encrypted, "sk-live-secret");
      assert.strictEqual(decryptSecret(encrypted), "sk-live-secret");
    } finally {
      restoreEnv("API_CONFIG_ENCRYPTION_KEY", previousKey);
    }
  });

  await t.test("returns plaintext local development secrets for backwards compatibility", () => {
    assert.strictEqual(decryptSecret("legacy-key"), "legacy-key");
  });
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

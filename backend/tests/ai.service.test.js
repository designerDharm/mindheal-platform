import test from "node:test";
import assert from "node:assert";
import { generateAiResponse } from "../src/services/ai.service.js";
import { repositories } from "../src/repositories/index.js";

test("ai service OpenAI provider", async (t) => {
  const originalRepo = repositories.apiConfigurations;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    repositories.apiConfigurations = originalRepo;
    globalThis.fetch = originalFetch;
  });

  await t.test("calls OpenAI Responses API when configured with a real key", async () => {
    let request = null;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "OpenAI",
        modelName: "gpt-test-model",
        apiKeyEncrypted: "sk-test-key",
        systemPrompt: "MindHeal assistant",
        isActive: true
      })
    };
    globalThis.fetch = async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ output_text: "OpenAI live response" })
      };
    };

    const result = await generateAiResponse("chat", "Hello");

    assert.strictEqual(result, "OpenAI live response");
    assert.strictEqual(request.url, "https://api.openai.com/v1/responses");
    assert.strictEqual(request.options.method, "POST");
    assert.strictEqual(request.options.headers.authorization, "Bearer sk-test-key");
    assert.strictEqual(request.body.model, "gpt-test-model");
    assert.strictEqual(request.body.instructions, "MindHeal assistant");
    assert.strictEqual(request.body.input, "Hello");
  });

  await t.test("does not call network for local mock keys", async () => {
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-test-model",
        apiKeyEncrypted: "mock_openai_key",
        systemPrompt: "MindHeal assistant",
        isActive: true
      })
    };
    globalThis.fetch = async () => {
      throw new Error("fetch should not be called for mock keys");
    };

    const result = await generateAiResponse("chat", "Hello");

    assert.match(result, /MOCK OPENAI/);
  });
});

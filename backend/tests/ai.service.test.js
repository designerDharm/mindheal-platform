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

test("ai service failure handling and truthful errors", async (t) => {
  const originalRepo = repositories.apiConfigurations;
  const originalFetch = globalThis.fetch;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  const prevOpenAiKey = process.env.OPENAI_API_KEY;

  t.after(() => {
    repositories.apiConfigurations = originalRepo;
    globalThis.fetch = originalFetch;
    if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (prevOpenAiKey !== undefined) process.env.OPENAI_API_KEY = prevOpenAiKey;
    else delete process.env.OPENAI_API_KEY;
  });

  await t.test("throws AI_CONFIG_MISSING when Gemini key is missing and unconfigured", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => null
    };

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_CONFIG_MISSING");
        assert.match(err.message, /API key missing/i);
        return true;
      }
    );
  });

  await t.test("throws AI_CONFIG_MISSING when OpenAI key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-4o",
        apiKeyEncrypted: "",
        systemPrompt: "Helper",
        isActive: true
      })
    };

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_CONFIG_MISSING");
        assert.match(err.message, /OpenAI API key missing/i);
        return true;
      }
    );
  });

  await t.test("throws AI_UNSUPPORTED_PROVIDER for unknown AI provider", async () => {
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "unknown_ai",
        modelName: "model-x",
        apiKeyEncrypted: "some_key",
        systemPrompt: "Helper",
        isActive: true
      })
    };

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_UNSUPPORTED_PROVIDER");
        assert.match(err.message, /Unsupported AI provider/i);
        return true;
      }
    );
  });

  await t.test("throws AI_TIMEOUT when provider times out or aborts", async () => {
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-4o",
        apiKeyEncrypted: "sk-real-key-for-test",
        systemPrompt: "Helper",
        isActive: true
      })
    };

    globalThis.fetch = async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      throw abortError;
    };

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_TIMEOUT");
        assert.match(err.message, /timed out/i);
        return true;
      }
    );
  });

  await t.test("throws AI_MALFORMED_OUTPUT when provider returns empty response", async () => {
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-4o",
        apiKeyEncrypted: "sk-real-key-for-test",
        systemPrompt: "Helper",
        isActive: true
      })
    };

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ output_text: "" })
    });

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_MALFORMED_OUTPUT");
        assert.match(err.message, /empty or malformed/i);
        return true;
      }
    );
  });

  await t.test("throws AI_PROVIDER_ERROR when provider returns HTTP error", async () => {
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-4o",
        apiKeyEncrypted: "sk-real-key-for-test",
        systemPrompt: "Helper",
        isActive: true
      })
    };

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limit exceeded" } })
    });

    await assert.rejects(
      async () => {
        await generateAiResponse("chat", "Hello");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_PROVIDER_ERROR");
        assert.match(err.message, /Rate limit exceeded/i);
        return true;
      }
    );
  });
});

test("ai service media processing and multimodal", async (t) => {
  const { processMediaInput, createAnalysisReport } = await import("../src/services/ai.service.js");
  const originalFetch = globalThis.fetch;
  const originalRepo = repositories.apiConfigurations;
  const originalReportsCreate = repositories.reports.create;

  t.after(() => {
    globalThis.fetch = originalFetch;
    repositories.apiConfigurations = originalRepo;
    repositories.reports.create = originalReportsCreate;
  });

  await t.test("processMediaInput handles valid data URI", async () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const media = await processMediaInput(dataUri);

    assert.strictEqual(media.mimeType, "image/png");
    assert.ok(media.buffer instanceof Buffer);
    assert.ok(media.buffer.length > 0);
    assert.strictEqual(media.url, dataUri);
  });

  await t.test("processMediaInput rejects unsupported media types", async () => {
    const invalidDataUri = "data:video/mp4;base64,AAAA";
    await assert.rejects(
      async () => {
        await processMediaInput(invalidDataUri);
      },
      (err) => {
        assert.strictEqual(err.code, "AI_INVALID_MEDIA");
        assert.match(err.message, /Unsupported media type/i);
        return true;
      }
    );
  });

  await t.test("processMediaInput rejects malformed data URI or empty buffer", async () => {
    await assert.rejects(
      async () => {
        await processMediaInput("data:image/png;notbase64");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_INVALID_MEDIA");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await processMediaInput("data:image/png;base64,");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_INVALID_MEDIA");
        assert.match(err.message, /empty/i);
        return true;
      }
    );
  });

  await t.test("processMediaInput fetches valid HTTP media", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => Buffer.from("fake-jpg-content")
    });

    const media = await processMediaInput("https://example.com/sample.jpg");
    assert.strictEqual(media.mimeType, "image/jpeg");
    assert.ok(media.base64Data);
    assert.strictEqual(media.buffer.toString(), "fake-jpg-content");
  });

  await t.test("processMediaInput throws AI_MEDIA_FETCH_FAILED on HTTP error or timeout", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404
    });

    await assert.rejects(
      async () => {
        await processMediaInput("https://example.com/missing.jpg");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_MEDIA_FETCH_FAILED");
        assert.match(err.message, /Failed to fetch/i);
        return true;
      }
    );

    globalThis.fetch = async () => {
      const abortError = new Error("Abort");
      abortError.name = "AbortError";
      throw abortError;
    };

    await assert.rejects(
      async () => {
        await processMediaInput("https://example.com/timeout.jpg");
      },
      (err) => {
        assert.strictEqual(err.code, "AI_MEDIA_FETCH_FAILED");
        assert.match(err.message, /timed out/i);
        return true;
      }
    );
  });

  await t.test("multimodal OpenAI call sends image_url part", async () => {
    let capturedBody = null;
    repositories.apiConfigurations = {
      find: () => ({
        provider: "openai",
        modelName: "gpt-4o",
        apiKeyEncrypted: "sk-real-key-test",
        systemPrompt: "Multimodal expert",
        isActive: true
      })
    };

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ output_text: "Analysis with media" })
      };
    };

    const media = {
      mimeType: "image/png",
      base64Data: "iVBORw0KGgoAAAA=",
      url: "data:image/png;base64,iVBORw0KGgoAAAA="
    };

    const result = await generateAiResponse("report_dream", "Dream prompt", media);
    assert.strictEqual(result, "Analysis with media");
    assert.ok(Array.isArray(capturedBody.input));
    const imagePart = capturedBody.input.find((p) => p.type === "image_url");
    assert.ok(imagePart);
    assert.strictEqual(imagePart.image_url.url, "data:image/png;base64,iVBORw0KGgoAAAA=");
  });

  await t.test("createAnalysisReport does not persist report when AI analysis fails", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    repositories.apiConfigurations = {
      find: () => null
    };

    let reportCreated = false;
    repositories.reports.create = async () => {
      reportCreated = true;
    };

    await assert.rejects(
      async () => {
        await createAnalysisReport({
          userId: "usr_fail_test",
          reportType: "dream",
          inputText: "Failed dream test"
        });
      },
      (err) => {
        assert.strictEqual(err.code, "AI_CONFIG_MISSING");
        return true;
      }
    );

    assert.strictEqual(reportCreated, false, "Report must NOT be persisted to database on AI failure");
  });
});

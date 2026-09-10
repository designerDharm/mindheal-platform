import { GoogleGenAI } from "@google/genai";
import { appConfig } from "../config/app.js";
import { repositories } from "../repositories/index.js";
import { createId } from "../utils/security.js";
import { PdfService } from "./pdf.service.js";
import { StorageService } from "./storage.service.js";
import { decryptSecret } from "./secret.service.js";
import { validateAndSanitizeAiOutput } from "./safety.service.js";
import { retrieveRelevantKnowledge } from "./knowledge.service.js";
import { checkDeterministicCrisis } from "./crisis.service.js";
import dotenv from "dotenv";
dotenv.config();

// Helper to get configuration per feature
async function getAiConfig(feature) {
  let config = await repositories.apiConfigurations.find(feature);
  if (!config || !config.isActive) {
    const provider = "gemini";
    const apiKey = process.env.GEMINI_API_KEY || "";
    return {
      provider,
      modelName: "gemini-2.5-flash",
      apiKey,
      systemPrompt: "You are a helpful psychology and analysis assistant. Keep your answers focused on mental wellness."
    };
  }
  
  // Dynamic API Key routing based on Provider
  const provider = String(config.provider || "gemini").toLowerCase();
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] || (config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : "");
  return {
    provider,
    modelName: config.modelName,
    apiKey,
    systemPrompt: config.systemPrompt || "You are a helpful psychology assistant."
  };
}

function isMockApiKey(apiKey = "") {
  const normalized = String(apiKey).toLowerCase();
  return normalized.startsWith("mock_") || normalized.startsWith("test_") || normalized.includes("smoke");
}

async function callGemini(config, prompt, media = null, options = {}) {
  if (!config.apiKey) {
    const err = new Error("Gemini API key missing. Please set GEMINI_API_KEY.");
    err.code = "AI_CONFIG_MISSING";
    throw err;
  }
  if (isMockApiKey(config.apiKey)) {
    return "[MOCK GEMINI] Mock Gemini response for local development.";
  }

  const timeoutMs = options.timeoutMs || 30000;
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("Gemini request timed out.");
      err.code = "AI_TIMEOUT";
      reject(err);
    }, timeoutMs);
    if (timer.unref) timer.unref();
  });

  const generatePromise = (async () => {
    let contents;
    if (media?.base64Data) {
      contents = [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: media.mimeType,
                data: media.base64Data
              }
            }
          ]
        }
      ];
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: config.modelName || "gemini-2.5-flash",
      contents,
      config: { systemInstruction: config.systemPrompt }
    });
    return response?.text;
  })();

  try {
    const rawText = await Promise.race([generatePromise, timeoutPromise]);
    if (!rawText || !rawText.trim()) {
      const err = new Error("Gemini returned empty or malformed output.");
      err.code = "AI_MALFORMED_OUTPUT";
      throw err;
    }
    return rawText.trim();
  } catch (err) {
    if (err.code === "AI_TIMEOUT" || err.code === "AI_MALFORMED_OUTPUT") {
      throw err;
    }
    const providerErr = new Error(`Gemini API error: ${err.message}`);
    providerErr.code = "AI_PROVIDER_ERROR";
    throw providerErr;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callOpenAi(config, prompt, media = null, options = {}) {
  if (!config.apiKey) {
    const err = new Error("OpenAI API key missing.");
    err.code = "AI_CONFIG_MISSING";
    throw err;
  }
  if (isMockApiKey(config.apiKey)) {
    return "[MOCK OPENAI] Mock OpenAI response for local development.";
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (timeout.unref) timeout.unref();

  try {
    let input;
    if (media?.base64Data) {
      input = [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${media.mimeType};base64,${media.base64Data}`
          }
        }
      ];
    } else if (media?.url) {
      input = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: media.url } }
      ];
    } else {
      input = prompt;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName || "gpt-4.1-mini",
        instructions: config.systemPrompt,
        input
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error?.message || `OpenAI request failed with status ${response.status}`;
      const err = new Error(message);
      err.code = "AI_PROVIDER_ERROR";
      throw err;
    }

    const text = extractOpenAiText(payload);
    if (!text || !text.trim()) {
      const err = new Error("OpenAI returned empty or malformed output.");
      err.code = "AI_MALFORMED_OUTPUT";
      throw err;
    }
    return text.trim();
  } catch (err) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr = new Error("OpenAI request timed out.");
      timeoutErr.code = "AI_TIMEOUT";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function extractOpenAiText(payload = {}) {
  if (payload.output_text) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .map((content) => content.text || content.output_text || "")
    .filter(Boolean)
    .join("\n");
}

export async function processMediaInput(mediaUrl, options = {}) {
  if (!mediaUrl) return null;
  if (typeof mediaUrl !== "string") {
    const err = new Error("Invalid media URL format.");
    err.code = "AI_INVALID_MEDIA";
    throw err;
  }

  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  // Handle data URIs
  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([a-zA-Z0-9/+-]+);base64,(.*)$/);
    if (!match) {
      const err = new Error("Malformed data URI for uploaded media.");
      err.code = "AI_INVALID_MEDIA";
      throw err;
    }
    const mimeType = match[1].toLowerCase();
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedMimeTypes.includes(mimeType)) {
      const err = new Error(`Unsupported media type: ${mimeType}. Supported types: JPG, PNG, WEBP, PDF.`);
      err.code = "AI_INVALID_MEDIA";
      throw err;
    }
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length === 0) {
      const err = new Error("Uploaded media buffer is empty.");
      err.code = "AI_INVALID_MEDIA";
      throw err;
    }
    return { mimeType, base64Data, buffer, url: trimmed };
  }

  // Handle HTTP/HTTPS URLs
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    const err = new Error("Invalid media URL format.");
    err.code = "AI_INVALID_MEDIA";
    throw err;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const err = new Error(`Unsupported protocol ${parsedUrl.protocol}. Only http: and https: are supported.`);
    err.code = "AI_INVALID_MEDIA";
    throw err;
  }

  if (parsedUrl.hostname === "mock-storage.local") {
    const extension = parsedUrl.pathname.split(".").pop().toLowerCase();
    const mimeMap = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp"
    };
    const mimeType = mimeMap[extension] || "image/jpeg";
    const sampleBuffer = extension === "pdf"
      ? Buffer.from("%PDF-1.4 mock content\n%%EOF", "utf8")
      : Buffer.from("mock-image-binary-data", "utf8");
    return {
      mimeType,
      base64Data: sampleBuffer.toString("base64"),
      buffer: sampleBuffer,
      url: trimmed
    };
  }

  if (options.fetchMedia !== false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
    if (timeout.unref) timeout.unref();

    try {
      const res = await fetch(trimmed, { signal: controller.signal });
      if (!res.ok) {
        const err = new Error(`Failed to fetch uploaded media from URL (status ${res.status}).`);
        err.code = "AI_MEDIA_FETCH_FAILED";
        throw err;
      }
      const rawContentType = res.headers?.get ? res.headers.get("content-type") : "";
      const contentType = (rawContentType || "").split(";")[0].trim().toLowerCase();
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
      if (contentType && !allowedMimeTypes.includes(contentType)) {
        const err = new Error(`Unsupported media type fetched from URL: ${contentType}. Supported: JPG, PNG, WEBP, PDF.`);
        err.code = "AI_INVALID_MEDIA";
        throw err;
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        const err = new Error("Fetched media is empty.");
        err.code = "AI_INVALID_MEDIA";
        throw err;
      }
      return {
        mimeType: contentType || "image/jpeg",
        base64Data: buffer.toString("base64"),
        buffer,
        url: trimmed
      };
    } catch (fetchErr) {
      if (fetchErr.code === "AI_INVALID_MEDIA" || fetchErr.code === "AI_MEDIA_FETCH_FAILED") {
        throw fetchErr;
      }
      if (fetchErr.name === "AbortError" || controller.signal.aborted) {
        const err = new Error("Fetching media from URL timed out.");
        err.code = "AI_MEDIA_FETCH_FAILED";
        throw err;
      }
      const err = new Error(`Could not access uploaded media: ${fetchErr.message}`);
      err.code = "AI_MEDIA_FETCH_FAILED";
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { url: trimmed, mimeType: "image/jpeg" };
}

export async function generateAiResponse(feature, prompt, media = null) {
  const config = await getAiConfig(feature);
  
  // Priority 3: RAG Knowledge Base Retrieval
  const knowledge = await retrieveRelevantKnowledge(prompt, feature);
  const augmentedPrompt = knowledge.retrieved
    ? `${knowledge.contextText}\n\nUser Query: ${prompt}`
    : prompt;

  let rawResponse = "";

  try {
    if (config.provider === "gemini") {
      rawResponse = await callGemini(config, augmentedPrompt, media);
    } else if (config.provider === "openai") {
      rawResponse = await callOpenAi(config, augmentedPrompt, media);
    } else {
      const err = new Error(`Unsupported AI provider: ${config.provider}`);
      err.code = "AI_UNSUPPORTED_PROVIDER";
      throw err;
    }
  } catch (primaryError) {
    const fallbackApiKey = process.env.OPENAI_API_KEY;
    if (config.provider !== "openai" && fallbackApiKey && !isMockApiKey(fallbackApiKey)) {
      console.warn(`[AiRouter] Primary provider (${config.provider}) failed for ${feature}. Attempting Fallback to OpenAI...`, primaryError.message);
      try {
        const fallbackConfig = {
          ...config,
          provider: "openai",
          modelName: "gpt-4o-mini",
          apiKey: fallbackApiKey
        };
        rawResponse = await callOpenAi(fallbackConfig, augmentedPrompt, media);
      } catch (fallbackError) {
        console.error(`[AiRouter] Both primary and fallback AI providers failed for ${feature}:`, fallbackError.message);
        throw fallbackError;
      }
    } else {
      throw primaryError;
    }
  }

  // Priority 2: Sanitize output for diagnostic/prescriptive claims
  const sanitized = validateAndSanitizeAiOutput(rawResponse);
  if (!sanitized?.text || !sanitized.text.trim()) {
    const err = new Error("AI output validation produced empty result.");
    err.code = "AI_MALFORMED_OUTPUT";
    throw err;
  }
  return sanitized.text;
}

export function safetyClassify(text = "") {
  // Simple heuristic for speed, but could be routed to an AI model too
  const normalized = text.toLowerCase();
  const riskWords = ["suicide", "self harm", "kill myself", "end my life", "die"];
  const isCrisis = riskWords.some((word) => normalized.includes(word));
  return {
    riskLevel: isCrisis ? "high" : "low",
    action: isCrisis ? "show_crisis_support_and_human_handoff" : "continue"
  };
}

export async function chatResponse({ message, userId = null, languageCode = "en" }) {
  const crisisResult = await checkDeterministicCrisis(message, userId);
  if (crisisResult?.isCrisis) {
    return {
      safety: { riskLevel: "CRITICAL", action: "show_crisis_support_and_human_handoff" },
      response: crisisResult.message,
      helplines: crisisResult.helplines,
      languageCode
    };
  }

  const safety = safetyClassify(message);
  const aiText = await generateAiResponse("chat", `User says: ${message}\nLanguage: ${languageCode}`);
  
  return {
    safety,
    response: aiText,
    languageCode
  };
}

export async function createAnalysisReport({ userId = "usr_demo_user", reportType, inputText, inputMediaUrl }) {
  let media = null;
  if (inputMediaUrl) {
    media = await processMediaInput(inputMediaUrl);
  }

  const inputForPrompt = [
    inputText,
    media ? `Attached sample: [${media.mimeType || "image"} media processed]` : ""
  ].filter(Boolean).join("\n");

  const prompt = `Analyze the following ${reportType} sample and provide insights:\n${inputForPrompt}`;
  const aiSummary = await generateAiResponse(`report_${reportType}`, prompt, media);
  const aiConfig = await getAiConfig(`report_${reportType}`);

  const report = {
    id: createId("rep"),
    userId,
    reportType,
    inputText,
    inputMediaUrl,
    aiSummary,
    aiFullReport: null,
    pdfUrl: null,
    isPdfUnlocked: false,
    pdfUnlockFeeInr: appConfig.reportUnlockPriceInr,
    aiModelUsed: `${aiConfig.provider}/${aiConfig.modelName}`,
    createdAt: new Date().toISOString()
  };
  return await repositories.reports.create(report);
}

export async function unlockReport(id) {
  const report = await repositories.reports.findById(id);
  if (!report) {
    const err = new Error("Report not found.");
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  
  // 1. Generate full AI report if not already generated
  let aiFullReport = report.aiFullReport;
  if (!aiFullReport) {
    let media = null;
    if (report.inputMediaUrl) {
      media = await processMediaInput(report.inputMediaUrl);
    }
    const inputForPrompt = [
      report.inputText,
      media ? `Attached sample: [${media.mimeType || "image"} media processed]` : ""
    ].filter(Boolean).join("\n");

    const prompt = `Generate a detailed, multi-paragraph ${report.reportType} analysis for the following input. Include sections for observations, deep analysis, and actionable advice.\n\nInput: ${inputForPrompt}`;
    aiFullReport = await generateAiResponse(`report_${report.reportType}`, prompt, media);
  }

  // 2. Generate PDF Buffer
  const pdfBuffer = await PdfService.generateReportPdf(report.id, report.reportType, aiFullReport);

  // 3. Upload to Firebase Storage
  const pdfUpload = await StorageService.uploadFile(
    pdfBuffer,
    `${report.id}.pdf`,
    "application/pdf",
    `reports/${report.userId}`
  );

  // 4. Update Database
  return await repositories.reports.update(id, {
    isPdfUnlocked: true,
    aiFullReport,
    pdfUrl: pdfUpload.url
  });
}

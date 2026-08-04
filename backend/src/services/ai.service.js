import { GoogleGenAI } from "@google/genai";
import { appConfig } from "../config/app.js";
import { repositories } from "../repositories/index.js";
import { createId } from "../utils/security.js";
import { PdfService } from "./pdf.service.js";
import { StorageService } from "./storage.service.js";
import { decryptSecret } from "./secret.service.js";
import dotenv from "dotenv";
dotenv.config();

// Helper to get configuration per feature
async function getAiConfig(feature) {
  let config = await repositories.apiConfigurations.find(feature);
  if (!config || !config.isActive) {
    // Fallbacks if not set in DB
    return {
      provider: "gemini",
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY || "",
      systemPrompt: "You are a helpful psychology and analysis assistant. Keep your answers focused on mental wellness."
    };
  }
  
  // Dynamic API Key routing based on Provider
  const provider = String(config.provider || "gemini").toLowerCase();
  return {
    provider,
    modelName: config.modelName,
    apiKey: process.env[`${provider.toUpperCase()}_API_KEY`] || decryptSecret(config.apiKeyEncrypted) || "",
    systemPrompt: config.systemPrompt || "You are a helpful psychology assistant."
  };
}

async function callGemini(config, prompt) {
  if (!config.apiKey) return "[MOCK GEMINI] Gemini API key missing. Please set GEMINI_API_KEY.";
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: prompt,
    config: { systemInstruction: config.systemPrompt }
  });
  return response.text;
}

async function callOpenAi(config, prompt) {
  if (!config.apiKey) return "[MOCK OPENAI] OpenAI API key missing.";
  if (isMockApiKey(config.apiKey)) return "[MOCK OPENAI] Mock OpenAI response for local development.";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName || "gpt-4.1-mini",
        instructions: config.systemPrompt,
        input: prompt
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error?.message || `OpenAI request failed with status ${response.status}`;
      throw new Error(message);
    }

    return extractOpenAiText(payload) || "OpenAI returned an empty response.";
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

function isMockApiKey(apiKey = "") {
  const normalized = String(apiKey).toLowerCase();
  return normalized.startsWith("mock_") || normalized.startsWith("test_") || normalized.includes("smoke");
}

import { validateAndSanitizeAiOutput } from "./safety.service.js";
import { retrieveRelevantKnowledge } from "./knowledge.service.js";

export async function generateAiResponse(feature, prompt) {
  const config = await getAiConfig(feature);
  
  // Priority 3: RAG Knowledge Base Retrieval
  const knowledge = await retrieveRelevantKnowledge(prompt, feature);
  const augmentedPrompt = knowledge.retrieved
    ? `${knowledge.contextText}\n\nUser Query: ${prompt}`
    : prompt;

  let rawResponse = "";

  try {
    if (config.provider === "gemini") {
      rawResponse = await callGemini(config, augmentedPrompt);
    } else if (config.provider === "openai") {
      rawResponse = await callOpenAi(config, augmentedPrompt);
    } else {
      rawResponse = `[MOCK AI] Unsupported provider ${config.provider}`;
    }
  } catch (primaryError) {
    console.warn(`[AiRouter] Primary provider (${config.provider}) failed for ${feature}. Attempting Fallback to OpenAI...`, primaryError);
    try {
      const fallbackConfig = {
        ...config,
        provider: "openai",
        modelName: "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY || config.apiKey
      };
      rawResponse = await callOpenAi(fallbackConfig, augmentedPrompt);
    } catch (fallbackError) {
      console.error(`[AiRouter] Both primary and fallback AI providers failed for ${feature}:`, fallbackError);
      return "I am currently experiencing technical difficulties processing this request. Please try again shortly.";
    }
  }

  // Priority 2: Sanitize output for diagnostic/prescriptive claims
  const sanitized = validateAndSanitizeAiOutput(rawResponse);
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

import { checkDeterministicCrisis } from "./crisis.service.js";

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
  const inputForPrompt = [inputText, inputMediaUrl ? `Attached sample URL: ${inputMediaUrl}` : ""].filter(Boolean).join("\n");
  const prompt = `Analyze the following ${reportType} sample and provide insights:\n${inputForPrompt}`;
  const aiSummary = await generateAiResponse(`report_${reportType}`, prompt);
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
  if (!report) return null;
  
  // 1. Generate full AI report if not already generated
  let aiFullReport = report.aiFullReport;
  if (!aiFullReport) {
    const inputForPrompt = [report.inputText, report.inputMediaUrl ? `Attached sample URL: ${report.inputMediaUrl}` : ""].filter(Boolean).join("\n");
    const prompt = `Generate a detailed, multi-paragraph ${report.reportType} analysis for the following input. Include sections for observations, deep analysis, and actionable advice.\n\nInput: ${inputForPrompt}`;
    aiFullReport = await generateAiResponse(`report_${report.reportType}`, prompt);
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

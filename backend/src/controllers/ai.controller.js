import { repositories } from "../repositories/index.js";
import * as aiService from "../services/ai.service.js";
import { credit, debit } from "../services/wallet.service.js";
import { badRequest, created, ok } from "../utils/http.js";
import { createId, hashValue } from "../utils/security.js";
import { requireFields } from "../utils/validation.js";

export async function chat({ body, user }) {
  const missing = requireFields(body, ["message"]);
  if (missing) return badRequest("Message is required.", missing);
  const result = await aiService.chatResponse({ message: body.message, languageCode: body.languageCode || "en" });
  if (result.safety?.riskLevel === "high") {
    await repositories.crisisEvents.create({
      id: createId("cri"),
      userId: user?.id || null,
      source: "ai_chat",
      riskLevel: result.safety.riskLevel,
      detectedTextHash: hashValue(body.message),
      actionTaken: result.safety.action,
      createdAt: new Date().toISOString()
    });
  }
  return ok(result);
}

export async function createDreamReport({ body, user }) {
  return await createReport("dream", body, user.id);
}

export async function createHandwritingReport({ body, user }) {
  return await createReport("handwriting", body, user.id);
}

export async function createSignatureReport({ body, user }) {
  return await createReport("signature", body, user.id);
}

export async function listReports({ user }) {
  return ok(await repositories.reports.listForUser(user));
}

export async function unlockReport({ params, user }) {
  const report = await repositories.reports.findById(params.id);
  if (!report) return badRequest("Report not found.");
  if (report.isPdfUnlocked) return ok(report);

  const reportReference = { referenceType: "analysis_report", referenceId: report.id };
  let walletDebited = false;

  try {
    await debit(user.id, report.pdfUnlockFeeInr, "pdf_unlock", reportReference);
    walletDebited = true;
    const unlockedReport = await aiService.unlockReport(params.id);
    return ok(unlockedReport);
  } catch (error) {
    if (walletDebited) {
      try {
        await credit(user.id, report.pdfUnlockFeeInr, "pdf_unlock_refund", {
          ...reportReference,
          notes: `Automatic refund after report unlock failure: ${error.message}`
        });
      } catch (refundError) {
        return badRequest(`Report unlock failed after wallet debit, and automatic refund failed: ${refundError.message}`);
      }
    }
    return badRequest(error.message);
  }
}

async function createReport(reportType, body, userId = "usr_demo_user") {
  const inputText = body.inputText || body.description;
  if (!inputText && !body.inputMediaUrl) return badRequest("Text or media input is required.");
  return created(await aiService.createAnalysisReport({ userId, reportType, inputText, inputMediaUrl: body.inputMediaUrl }));
}

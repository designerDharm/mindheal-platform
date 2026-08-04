import { repositories } from "../repositories/index.js";
import * as aiService from "../services/ai.service.js";
import { credit, debit } from "../services/wallet.service.js";
import { badRequest, created, ok } from "../utils/http.js";
import { createId, hashValue } from "../utils/security.js";
import { calculateAgeFromDob, requireFields } from "../utils/validation.js";

export async function chat({ body, user }) {
  const age = calculateAgeFromDob(user?.dateOfBirth || user?.date_of_birth);
  if (user && (user.dateOfBirth || user.date_of_birth) && age < 18) {
    return badRequest("AI features fail closed for minor accounts. Users must be at least 18 years old.");
  }
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
  return await createReport("dream", body, user);
}

export async function createHandwritingReport({ body, user }) {
  return await createReport("handwriting", body, user);
}

export async function createSignatureReport({ body, user }) {
  return await createReport("signature", body, user);
}

export async function listReports({ user }) {
  return ok(await repositories.reports.listForUser(user));
}

import { credit, debit, reserveCredits, releaseCredits } from "../services/wallet.service.js";

export async function unlockReport({ params, user }) {
  const report = await repositories.reports.findById(params.id);
  if (!report) return badRequest("Report not found.");
  if (report.isPdfUnlocked) return ok(report);

  let reservation = { reservationId: null, isFree: true };

  try {
    // Priority 2: Reserve credits before PDF report unlock processing
    reservation = await reserveCredits(user.id, report.pdfUnlockFeeInr, `pdf_unlock_${params.id}`);
    const unlockedReport = await aiService.unlockReport(params.id);
    return ok(unlockedReport);
  } catch (error) {
    // Priority 2: Auto-release reserved credits if report generation or unlock fails
    if (reservation.reservationId) {
      await releaseCredits(user.id, report.pdfUnlockFeeInr, reservation.reservationId, error.message);
    }
    return badRequest(`Report unlock failed: ${error.message}`);
  }
}

async function createReport(reportType, body, user) {
  const age = typeof user === "object" ? calculateAgeFromDob(user?.dateOfBirth || user?.date_of_birth) : null;
  if (user && (user.dateOfBirth || user.date_of_birth) && age < 18) {
    return badRequest("AI self-reflection reports require verified age of 18 or above.");
  }
  const userId = typeof user === "object" ? user.id : user;
  const inputText = body.inputText || body.description;
  if (!inputText && !body.inputMediaUrl) return badRequest("Text or media input is required.");
  return created(await aiService.createAnalysisReport({ userId, reportType, inputText, inputMediaUrl: body.inputMediaUrl }));
}

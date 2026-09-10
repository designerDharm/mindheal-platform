import busboy from "busboy";
import { repositories } from "../repositories/index.js";
import * as aiService from "../services/ai.service.js";
import { credit, debit, reserveCredits, releaseCredits } from "../services/wallet.service.js";
import { badRequest, created, forbidden, ok, unauthorized, payloadTooLarge } from "../utils/http.js";
import { createId, hashValue } from "../utils/security.js";
import { calculateAgeFromDob, requireFields } from "../utils/validation.js";

export async function chat({ body, user }) {
  const age = calculateAgeFromDob(user?.dateOfBirth || user?.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("AI features fail closed for minor accounts. Users must be at least 18 years old.");
  }
  const missing = requireFields(body, ["message"]);
  if (missing) return badRequest("Message is required.", missing);
  try {
    const result = await aiService.chatResponse({ message: body.message, userId: user?.id, languageCode: body.languageCode || "en" });
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
  } catch (error) {
    return badRequest(error.message || "AI chat processing failed.", { code: error.code || "AI_PROCESSING_FAILED" });
  }
}

export async function createDreamReport({ body, user }) {
  return await createReport("dream", body, user);
}

export async function organiseDream({ body, user, headers, req }) {
  const currentUser = user || req?.user;
  if (!currentUser) {
    return unauthorized("Authentication required to organise dream notes.");
  }

  const age = calculateAgeFromDob(currentUser?.dateOfBirth || currentUser?.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("AI features fail closed for minor accounts. Users must be at least 18 years old.");
  }

  const text = body?.text || body?.description;
  if (!text || typeof text !== "string" || !text.trim()) {
    return badRequest("Dream text is required for organisation.", { code: "INVALID_INPUT" });
  }

  const mockTestHeader = headers?.["x-mock-test"] || req?.headers?.["x-mock-test"];
  try {
    const result = await aiService.organiseDreamText({
      text,
      sourceType: body?.sourceType || "type",
      userId: currentUser.id,
      mockTest: mockTestHeader
    });

    return ok(result);
  } catch (error) {
    return badRequest(error.message || "Dream organisation failed.", { code: error.code || "AI_ORGANISATION_FAILED" });
  }
}

export function transcribeDreamAudio(context) {
  const user = context.user || context.req?.user;
  if (!user) {
    return unauthorized("Authentication required to transcribe dream audio.");
  }

  const age = calculateAgeFromDob(user?.dateOfBirth || user?.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("AI features fail closed for minor accounts. Users must be at least 18 years old.");
  }

  if (!context.req) {
    return badRequest("Invalid request stream.");
  }

  return new Promise((resolve) => {
    const maxUploadBytes = 15 * 1024 * 1024;
    let bb;
    try {
      bb = busboy({
        headers: context.req.headers || context.headers || {},
        limits: { fileSize: maxUploadBytes, files: 1 }
      });
    } catch (e) {
      return resolve(badRequest("Invalid multipart headers.", { code: "INVALID_MULTIPART" }));
    }

    let fileBuffer = null;
    let filename = "";
    let mimeType = "";
    let uploadError = null;
    const fields = {};

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("file", (name, file, info) => {
      filename = info.filename;
      mimeType = info.mimeType;
      const chunks = [];
      file.on("data", (data) => chunks.push(data));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
      file.on("limit", () => {
        uploadError = payloadTooLarge("Audio recording exceeds 15MB maximum size limit.");
      });
    });

    bb.on("close", async () => {
      try {
        if (uploadError) return resolve(uploadError);
        if (!fileBuffer || !fileBuffer.length) {
          return resolve(badRequest("Audio recording is empty or not provided."));
        }

        const validation = aiService.validateAudioBuffer(fileBuffer, mimeType);
        if (!validation.valid) {
          return resolve(badRequest(validation.message || "Invalid audio recording format.", { code: "INVALID_AUDIO_FORMAT" }));
        }

        const mockTestHeader = context.req?.headers?.["x-mock-test"] || context.headers?.["x-mock-test"];
        const result = await aiService.transcribeAudio({
          buffer: fileBuffer,
          mimeType,
          duration: fields.duration,
          mockTest: mockTestHeader
        });

        // Security / Rule 18: Never log dream transcripts to server console or logs
        return resolve(ok(result));
      } catch (err) {
        return resolve(badRequest(err.message || "Failed to transcribe dream audio.", { code: err.code || "TRANSCRIPTION_FAILED" }));
      }
    });

    bb.on("error", (err) => {
      resolve(badRequest("Failed to process audio stream.", { code: "AUDIO_PARSE_FAILED" }));
    });

    context.req.pipe(bb);
  });
}

export function extractDreamNotes(context) {
  const user = context.user || context.req?.user;
  if (!user) {
    return unauthorized("Authentication required to extract dream notes.");
  }

  const age = calculateAgeFromDob(user?.dateOfBirth || user?.date_of_birth);
  if (age === null || age < 18) {
    return forbidden("AI features fail closed for minor accounts. Users must be at least 18 years old.");
  }

  if (!context.req) {
    return badRequest("Invalid request stream.");
  }

  return new Promise((resolve) => {
    const maxUploadBytes = 10 * 1024 * 1024;
    let bb;
    try {
      bb = busboy({
        headers: context.req.headers || context.headers || {},
        limits: { fileSize: maxUploadBytes, files: 1 }
      });
    } catch {
      return resolve(badRequest("Invalid multipart headers.", { code: "INVALID_MULTIPART" }));
    }

    let fileBuffer = null;
    let filename = "";
    let mimeType = "";
    let uploadError = null;

    bb.on("file", (name, file, info) => {
      filename = info.filename;
      mimeType = info.mimeType;
      const chunks = [];
      file.on("data", (data) => chunks.push(data));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
      file.on("limit", () => {
        uploadError = payloadTooLarge("Image upload exceeds 10MB maximum size limit.");
      });
    });

    bb.on("close", async () => {
      try {
        if (uploadError) return resolve(uploadError);
        if (!fileBuffer || !fileBuffer.length) {
          return resolve(badRequest("Image file is empty or not provided."));
        }

        const validation = aiService.validateNotesImageBuffer(fileBuffer, mimeType);
        if (!validation.valid) {
          return resolve(badRequest(validation.message || "Invalid notes image format.", { code: "INVALID_IMAGE_FORMAT" }));
        }

        const mockTestHeader = context.req?.headers?.["x-mock-test"] || context.headers?.["x-mock-test"];
        const result = await aiService.extractTextFromNotesImage({
          buffer: fileBuffer,
          mimeType,
          mockTest: mockTestHeader
        });

        // Security / Rule 18: Never log raw dream notes content to server console or logs
        return resolve(ok(result));
      } catch (err) {
        return resolve(badRequest(err.message || "Failed to extract dream notes text.", { code: err.code || "EXTRACTION_FAILED" }));
      }
    });

    bb.on("error", () => {
      resolve(badRequest("Failed to process image upload stream.", { code: "IMAGE_PARSE_FAILED" }));
    });

    context.req.pipe(bb);
  });
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

export async function getReport({ params, user }) {
  const report = await repositories.reports.findById(params.id);
  if (!report) return badRequest("Report not found.");
  if (report.userId !== user?.id && user?.role !== "admin") {
    return forbidden("You do not have permission to access this report.");
  }
  return ok(report);
}

export async function unlockReport({ params, user }) {
  const report = await repositories.reports.findById(params.id);
  if (!report) return badRequest("Report not found.");
  if (report.userId !== user?.id && user?.role !== "admin") {
    return forbidden("You do not have permission to access or unlock this report.");
  }
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
  if (age === null || age < 18) {
    return forbidden("AI self-reflection reports require verified age of 18 or above.");
  }
  const userId = typeof user === "object" ? user.id : user;
  const inputText = body.inputText || body.description;
  if (!inputText && !body.inputMediaUrl) return badRequest("Text or media input is required.");
  try {
    const report = await aiService.createAnalysisReport({
      userId,
      reportType,
      inputText,
      inputMediaUrl: body.inputMediaUrl,
      metadata: body.metadata || null
    });
    return created(report);
  } catch (error) {
    return badRequest(error.message || "AI analysis failed.", { code: error.code || "AI_ANALYSIS_FAILED" });
  }
}

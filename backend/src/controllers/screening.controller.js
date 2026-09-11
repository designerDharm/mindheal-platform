import { repositories } from "../repositories/index.js";
import { getBalance, debit, credit } from "../services/wallet.service.js";
import { postJournalTransaction } from "../services/double_entry.service.js";
import { badRequest, created, forbidden, ok } from "../utils/http.js";
import { createId } from "../utils/security.js";
import { QUESTIONNAIRES, validateAndEvaluateScreening, calculateAge } from "../services/questionnaire.service.js";

function notFound(message = "Not found") {
  return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message } } };
}

const BASIC_SCREENING_TYPES = Object.keys(QUESTIONNAIRES);

export const screeningInterpretationHooks = {
  afterReservation: null,
  generateClinicalNarrative: null
};

export async function withScreeningTransaction(callback) {
  if (repositories.transactions?.withTransaction) {
    return await repositories.transactions.withTransaction(callback);
  }
  return await callback();
}

export async function listQuestionnaires() {
  return ok(QUESTIONNAIRES);
}

export function evaluateScreening(type, responses, clientScore = null) {
  const result = validateAndEvaluateScreening(type, { responses, score: clientScore });
  return result;
}

export function sanitizeUntrustedContext(context = {}) {
  if (!context || typeof context !== "object") return {};
  const sanitized = {};

  const sanitizeString = (val) => {
    if (typeof val !== "string") return "";
    return val
      .replace(/[\r\n]+/g, " ")
      .replace(/[<>]/g, "")
      .replace(/ignore\s+(?:all\s+)?(?:previous\s+)?instructions/gi, "[REDACTED_PROMPT_ATTEMPT]")
      .replace(/system\s*:\s*/gi, "[REDACTED]")
      .replace(/(?:prescribe|administer|take\s+mg|dosage|mg\s+of)\s+[a-z0-9\s]+/gi, "[REDACTED_MEDICAL_CLAIM]")
      .slice(0, 500)
      .trim();
  };

  if (context.onsetDuration && typeof context.onsetDuration === "string") {
    sanitized.onsetDuration = sanitizeString(context.onsetDuration);
  }
  if (Array.isArray(context.dailyDifficulties)) {
    sanitized.dailyDifficulties = context.dailyDifficulties
      .filter(item => typeof item === "string")
      .map(sanitizeString)
      .slice(0, 10);
  }
  if (context.previousSupport && typeof context.previousSupport === "string") {
    sanitized.previousSupport = sanitizeString(context.previousSupport);
  }
  if (context.healthChanges && typeof context.healthChanges === "string") {
    sanitized.healthChanges = sanitizeString(context.healthChanges);
  }
  if (context.personalGoals && typeof context.personalGoals === "string") {
    sanitized.personalGoals = sanitizeString(context.personalGoals);
  }

  return sanitized;
}

export function validateAiClinicalContract(narrative, { score, band, screeningType } = {}) {
  if (typeof narrative !== "string" || !narrative.trim()) {
    return { isValid: false, reason: "Output is empty or not a string." };
  }

  // Reject output attempting to establish formal medical/psychiatric diagnosis
  if (/\b(?:you have been diagnosed with|formal diagnosis:|psychiatric diagnosis:|clinical diagnosis:)\b/i.test(narrative)) {
    return { isValid: false, reason: "Output contract violation: prohibited formal diagnosis claim." };
  }

  // Reject output recommending or prescribing prescription medication
  const rxProhibited = /\b(?:xanax|alprazolam|lexapro|escitalopram|prozac|fluoxetine|sertraline|zoloft|klonopin|clonazepam|valium|diazepam|ssri|benzodiazepine|antidepressant|mg\s+daily|prescription)\b/i;
  if (rxProhibited.test(narrative)) {
    return { isValid: false, reason: "Output contract violation: prohibited medication recommendation." };
  }

  // Reject output attempting to alter the authoritative score
  const scoreMatch = narrative.match(/Score:\s*(\d+)/i);
  if (scoreMatch && score !== undefined && score !== null) {
    const reportedScore = parseInt(scoreMatch[1], 10);
    if (reportedScore !== score) {
      return { isValid: false, reason: `Output contract violation: altered score ${reportedScore} does not match verified score ${score}.` };
    }
  }

  // Reject aggressive/coercive booking pressure
  if (/\b(?:you must book now|immediate payment required|mandatory session|urgently buy)\b/i.test(narrative)) {
    return { isValid: false, reason: "Output contract violation: coercive booking pressure detected." };
  }

  return { isValid: true };
}

export function generateClinicalNarrative(type, score, responses = {}, intakeContext = {}) {
  const count = Object.keys(responses || {}).length;
  const safeContext = sanitizeUntrustedContext(intakeContext);
  let contextSnippet = "";
  if (safeContext.onsetDuration) {
    contextSnippet += ` Reported onset/duration: ${safeContext.onsetDuration}.`;
  }
  if (safeContext.personalGoals) {
    contextSnippet += ` Stated goals: ${safeContext.personalGoals}.`;
  }

  if (type === "low_mood" || type === "phq9") {
    return `Comprehensive Clinical Narrative: Based on your PHQ-pattern responses across ${count} items (Score: ${score}/27), mood rhythms indicate cognitive fatigue and reduced emotional reward processing.${contextSnippet} Recommended interventions include Behavioral Activation, micro-pacing daily commitments, and collaborative clinical guidance.`;
  }
  if (type === "anxiety" || type === "gad7") {
    return `Comprehensive Clinical Narrative: Based on your GAD-pattern responses across ${count} items (Score: ${score}/21), cognitive worry loops and somatic tension show elevated vigilance.${contextSnippet} Recommended strategies include stimulus control, diaphragmatic pacing, and structured CBT worry-time scheduling.`;
  }
  if (type === "burnout") {
    return `Comprehensive Clinical Narrative: Based on burnout reflection across ${count} items (Score: ${score}/12), emotional exhaustion indicates significant depletion of recovery reserves.${contextSnippet} Recommended restorative actions include digital detaching, boundary agreements, and intentional downtime.`;
  }
  return `Comprehensive Clinical Narrative: Your self-assessment (Score: ${score}) has been synthesized into a structured clinical profile for care navigation.${contextSnippet}`;
}

export async function createScreening({ body, user }) {
  const { screeningType } = body || {};
  if (!screeningType || !BASIC_SCREENING_TYPES.includes(screeningType)) {
    return badRequest(`Invalid or missing screeningType. Must be one of: ${BASIC_SCREENING_TYPES.join(", ")}.`);
  }

  const questionnaire = QUESTIONNAIRES[screeningType];

  // Gate 3: Tool release / clinical availability status check
  if (questionnaire.status && questionnaire.status !== "available") {
    return forbidden("This assessment is not currently available for self-administration.", {
      code: "ASSESSMENT_UNAVAILABLE",
      status: questionnaire.status
    });
  }

  // Gate 2: Age eligibility check if tool specifies minimumAge
  if (typeof questionnaire.minimumAge === "number") {
    // Resolve user profile for verified date of birth
    const userRecord = user?.id ? await repositories.users.findById(user.id) : null;
    const dob = userRecord?.dateOfBirth || user?.dateOfBirth || null;

    if (!dob) {
      return badRequest("Please complete your profile with your date of birth before accessing this assessment.", {
        code: "PROFILE_INCOMPLETE"
      });
    }

    const age = calculateAge(dob);
    if (age === null || age < questionnaire.minimumAge) {
      return forbidden("This assessment is not available for your age group.", {
        code: "AGE_RESTRICTED",
        minimumAge: questionnaire.minimumAge,
        calculatedAge: age
      });
    }
  }

  const screeningId = createId("scr");

  // Basic screenings are 100% free (₹0) — no wallet balance required, zero debit
  const screening = await repositories.screenings.create({
    id: screeningId,
    userId: user.id,
    screeningType,
    status: "started",
    score: null,
    responsesJson: {
      questionnaireVersion: questionnaire.version,
      responses: {},
      isFree: true,
      hasPaidInterpretation: false
    }
  });

  return created(screening);
}

export async function completeScreening({ params, body, headers = {}, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  const idempotencyKey = headers["x-idempotency-key"] || body?.idempotencyKey || null;
  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};

  // Idempotent retry: if already completed, return existing result safely
  if (screening.status === "completed") {
    if (idempotencyKey && existingJson.idempotencyKey === idempotencyKey) {
      return ok({
        ...screening,
        score: screening.score,
        band: existingJson.band,
        severity: existingJson.severity,
        title: existingJson.title,
        description: existingJson.description,
        safetyGuidance: existingJson.safetyGuidance,
        functionalImpact: existingJson.functionalImpact,
        intakeContext: existingJson.intakeContext,
        hasPaidInterpretation: Boolean(existingJson.hasPaidInterpretation),
        interpretation: existingJson.interpretation || null,
        isIdempotentReplay: true
      });
    }
    // Return the completed result directly
    return ok({
      ...screening,
      score: screening.score,
      band: existingJson.band,
      severity: existingJson.severity,
      title: existingJson.title,
      description: existingJson.description,
      safetyGuidance: existingJson.safetyGuidance,
      functionalImpact: existingJson.functionalImpact,
      intakeContext: existingJson.intakeContext,
      hasPaidInterpretation: Boolean(existingJson.hasPaidInterpretation),
      interpretation: existingJson.interpretation || null
    });
  }

  // Calculate screening results strictly on the backend (MH-36)
  // Rejects empty answers, invalid values, and fabricated scores (e.g. -999)
  const evaluation = validateAndEvaluateScreening(screening.screeningType, body || {});
  if (!evaluation.isValid) {
    return badRequest(evaluation.error);
  }

  const responsesJson = {
    ...existingJson,
    idempotencyKey,
    questionnaireVersion: evaluation.questionnaireVersion,
    policyVersion: evaluation.policyVersion,
    resultPolicyVersion: evaluation.resultPolicyVersion,
    language: evaluation.language,
    responses: evaluation.validatedAnswers,
    score: evaluation.score,
    band: evaluation.band,
    severity: evaluation.severity,
    title: evaluation.title,
    description: evaluation.description,
    safetyGuidance: evaluation.safetyGuidance,
    functionalImpact: evaluation.functionalImpact,
    intakeContext: evaluation.intakeContext,
    hasPaidInterpretation: false,
    interpretation: null
  };

  const updated = await repositories.screenings.update(params.id, {
    status: "completed",
    score: evaluation.score,
    responsesJson,
    completedAt: new Date().toISOString()
  });

  return ok({
    ...updated,
    score: evaluation.score,
    band: evaluation.band,
    severity: evaluation.severity,
    title: evaluation.title,
    description: evaluation.description,
    safetyGuidance: evaluation.safetyGuidance,
    functionalImpact: evaluation.functionalImpact,
    intakeContext: evaluation.intakeContext,
    hasPaidInterpretation: false,
    interpretation: null
  });
}


export async function requestInterpretation({ params, body = {}, user, _hooks = {} }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  if (screening.status !== "completed") {
    return badRequest("Screening must be completed before requesting interpretation.");
  }

  // Explicit opt-in verification (Prompt 9: Provide AI explanation only after explicit opt-in)
  const hasOptedIn = body?.consentToAiInterpretation === true || body?.optInConsent === true;
  if (!hasOptedIn) {
    return badRequest("Explicit opt-in consent is required to generate an AI clinical interpretation.", {
      code: "OPT_IN_REQUIRED"
    });
  }

  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  if (existingJson.hasPaidInterpretation && existingJson.interpretation) {
    return ok({
      screening,
      alreadyPurchased: true,
      interpretation: existingJson.interpretation
    });
  }

  // Optional paid interpretation purchase (₹49)
  const priceInr = 49;
  const pricePaise = priceInr * 100;
  const balancePaise = await getBalance(user.id);
  if (balancePaise < pricePaise) {
    return badRequest("Insufficient wallet balance for clinical interpretation report.", { code: "INSUFFICIENT_BALANCE" });
  }

  const holdId = createId("hld");
  let holdPlaced = false;

  try {
    return await withScreeningTransaction(async () => {
      // Step 1: Reservation (hold funds in wallet)
      await debit(user.id, priceInr, "screening_interpretation_hold", {
        referenceType: "Screening",
        referenceId: screening.id,
        holdId,
        idempotencyKey: `interp_hold_${screening.id}_${holdId}`
      });
      holdPlaced = true;

      // Failure injection hook: after reservation
      if (screeningInterpretationHooks.afterReservation) {
        await screeningInterpretationHooks.afterReservation({ screening, user, holdId });
      }
      if (_hooks.afterReservation) {
        await _hooks.afterReservation({ screening, user, holdId });
      }

      // Step 2: Result Creation (generate clinical narrative with sanitized untrusted context)
      const narrativeGenerator =
        screeningInterpretationHooks.generateClinicalNarrative ||
        _hooks.generateClinicalNarrative ||
        generateClinicalNarrative;
      const interpretation = await narrativeGenerator(
        screening.screeningType,
        screening.score,
        existingJson.responses,
        existingJson.intakeContext
      );

      // Contract enforcement on AI output (Prompt 9)
      const contractCheck = validateAiClinicalContract(interpretation, {
        score: screening.score,
        band: existingJson.band,
        screeningType: screening.screeningType
      });
      if (!contractCheck.isValid) {
        throw new Error(`AI clinical contract check failed: ${contractCheck.reason}`);
      }

      // Step 3: Persistence (update screening record with interpretation)
      const updatedJson = {
        ...existingJson,
        hasPaidInterpretation: true,
        interpretation,
        interpretationConsentGranted: true,
        interpretationPurchasedAt: new Date().toISOString()
      };

      const updated = await repositories.screenings.update(screening.id, {
        responsesJson: updatedJson
      });

      // Step 4: Settlement (Double-entry journal posting)
      try {
        const journal = await postJournalTransaction({
          journalType: "SCREENING_INTERPRETATION_PURCHASE",
          businessReferenceType: "Screening",
          businessReferenceId: screening.id,
          idempotencyKey: `interp_journal_${screening.id}_${holdId}`,
          description: `Purchase clinical interpretation for ${screening.screeningType} screening`,
          entries: [
            { accountKey: `USER_AVAILABLE_${user.id}`, entrySide: "debit", amountPaise: pricePaise },
            { accountKey: "PLATFORM_REVENUE", entrySide: "credit", amountPaise: pricePaise }
          ]
        });
        await repositories.journalTransactions.create(journal);
      } catch (journalErr) {
        // Rollback persistence if settlement journal posting fails
        await repositories.screenings.update(screening.id, {
          responsesJson: existingJson
        });
        throw journalErr;
      }

      return ok({
        screening: updated,
        hasPaidInterpretation: true,
        interpretation
      });
    });
  } catch (err) {
    // Compensation: If hold was placed, compensate by refunding the hold
    if (holdPlaced) {
      try {
        await credit(user.id, priceInr, "screening_interpretation_hold_refund", {
          referenceType: "Screening",
          referenceId: screening.id,
          holdId,
          idempotencyKey: `interp_refund_${screening.id}_${holdId}`,
          notes: `Automatic refund after interpretation processing failure: ${err.message}`
        });
      } catch (refundErr) {
        console.error("Failed to compensate screening interpretation hold:", refundErr);
      }
    }

    return badRequest(`Failed to complete clinical interpretation: ${err.message}`, {
      code: "INTERPRETATION_FAILED",
      compensated: holdPlaced
    });
  }
}

export async function listMyScreenings({ user }) {
  const list = await repositories.screenings.listForUser(user.id);
  return ok(list);
}

export async function getScreening({ params, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  const responsesJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  const evaluation = evaluateScreening(screening.screeningType, responsesJson.responses || {}, screening.score);

  return ok({
    ...screening,
    band: responsesJson.band || evaluation.band,
    severity: responsesJson.severity || evaluation.severity,
    title: evaluation.title,
    description: evaluation.description,
    safetyGuidance: responsesJson.safetyGuidance || evaluation.safetyGuidance,
    functionalImpact: responsesJson.functionalImpact ?? null,
    intakeContext: responsesJson.intakeContext || null,
    shareToken: responsesJson.shareToken || null,
    hasPaidInterpretation: Boolean(responsesJson.hasPaidInterpretation),
    interpretation: responsesJson.interpretation || null
  });
}

export async function deleteScreening({ params, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized to delete this screening session.");
  }

  await repositories.screenings.delete(params.id);
  return ok({ id: params.id, deleted: true, message: "Screening record purged securely." });
}

export async function shareScreening({ params, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized to share this screening session.");
  }

  if (screening.status !== "completed") {
    return badRequest("Only completed screenings can be shared.");
  }

  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  const shareToken = createId("sh_scr");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days expiry

  const updatedJson = {
    ...existingJson,
    shareToken,
    shareExpiresAt: expiresAt,
    sharedAt: new Date().toISOString()
  };

  await repositories.screenings.update(params.id, { responsesJson: updatedJson });

  return ok({
    screeningId: screening.id,
    shareToken,
    shareExpiresAt: expiresAt,
    shareUrl: `/screenings/shared/${shareToken}`
  });
}

export async function revokeShareScreening({ params, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized to revoke share for this screening session.");
  }

  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  const updatedJson = {
    ...existingJson,
    shareToken: null,
    shareExpiresAt: null,
    shareRevokedAt: new Date().toISOString()
  };

  await repositories.screenings.update(params.id, { responsesJson: updatedJson });
  return ok({ screeningId: screening.id, revoked: true, message: "Share link revoked successfully." });
}

export async function getSharedScreening({ params }) {
  const { shareToken } = params || {};
  if (!shareToken) return badRequest("Share token is required.");

  const screening = await repositories.screenings.findByShareToken(shareToken);
  if (!screening) return notFound("Shared screening not found or access expired.");

  const responsesJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  if (responsesJson.shareExpiresAt && new Date(responsesJson.shareExpiresAt) < new Date()) {
    return notFound("This shared screening link has expired.");
  }

  // Return sanitized, non-diagnostic clinical summary without private user identifiers
  return ok({
    screeningType: screening.screeningType,
    score: screening.score,
    band: responsesJson.band || null,
    severity: responsesJson.severity || null,
    title: responsesJson.title || null,
    description: responsesJson.description || null,
    questionnaireVersion: responsesJson.questionnaireVersion || "2026.1.0",
    policyVersion: responsesJson.policyVersion || "2026.1",
    resultPolicyVersion: responsesJson.resultPolicyVersion || "2026.1",
    safetyGuidance: responsesJson.safetyGuidance || null,
    functionalImpact: responsesJson.functionalImpact ?? null,
    completedAt: screening.completedAt,
    isAuthoritative: true,
    isSharedReport: true
  });
}

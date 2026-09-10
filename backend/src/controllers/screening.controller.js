import { repositories } from "../repositories/index.js";
import { getBalance, debit, credit } from "../services/wallet.service.js";
import { postJournalTransaction } from "../services/double_entry.service.js";
import { badRequest, created, forbidden, ok, notFound } from "../utils/http.js";
import { createId } from "../utils/security.js";
import { QUESTIONNAIRES, validateAndEvaluateScreening } from "../services/questionnaire.service.js";

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

export function generateClinicalNarrative(type, score, responses = {}) {
  const count = Object.keys(responses || {}).length;
  if (type === "low_mood") {
    return `Comprehensive Clinical Narrative: Based on your PHQ-pattern responses across ${count} items (Score: ${score}/18), mood rhythms indicate cognitive fatigue and reduced emotional reward processing. Recommended interventions include Behavioral Activation, micro-pacing daily commitments, and collaborative clinical guidance.`;
  }
  if (type === "anxiety") {
    return `Comprehensive Clinical Narrative: Based on your GAD-pattern responses across ${count} items (Score: ${score}/18), cognitive worry loops and somatic tension show elevated vigilance. Recommended strategies include stimulus control, diaphragmatic pacing, and structured CBT worry-time scheduling.`;
  }
  if (type === "burnout") {
    return `Comprehensive Clinical Narrative: Based on burnout reflection across ${count} items (Score: ${score}/12), emotional exhaustion indicates significant depletion of recovery reserves. Recommended restorative actions include digital detaching, boundary agreements, and intentional downtime.`;
  }
  return `Comprehensive Clinical Narrative: Your self-assessment (Score: ${score}) has been synthesized into a structured clinical profile for care navigation.`;
}

export async function createScreening({ body, user }) {
  const { screeningType } = body || {};
  if (!screeningType || !BASIC_SCREENING_TYPES.includes(screeningType)) {
    return badRequest(`Invalid or missing screeningType. Must be one of: ${BASIC_SCREENING_TYPES.join(", ")}.`);
  }

  const questionnaire = QUESTIONNAIRES[screeningType];
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

export async function completeScreening({ params, body, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  if (screening.status === "completed") {
    return badRequest("This screening session has already been completed.");
  }

  // Calculate screening results strictly on the backend (MH-36)
  // Rejects empty answers, invalid values, and fabricated scores (e.g. -999)
  const evaluation = validateAndEvaluateScreening(screening.screeningType, body || {});
  if (!evaluation.isValid) {
    return badRequest(evaluation.error);
  }

  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  const responsesJson = {
    ...existingJson,
    questionnaireVersion: evaluation.questionnaireVersion,
    responses: evaluation.validatedAnswers,
    score: evaluation.score,
    band: evaluation.band,
    severity: evaluation.severity,
    safetyGuidance: evaluation.safetyGuidance,
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
    hasPaidInterpretation: false,
    interpretation: null
  });
}


export async function requestInterpretation({ params, user, _hooks = {} }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return notFound("Screening session not found.");

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  if (screening.status !== "completed") {
    return badRequest("Screening must be completed before requesting interpretation.");
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

      // Step 2: Result Creation (generate clinical narrative)
      const narrativeGenerator =
        screeningInterpretationHooks.generateClinicalNarrative ||
        _hooks.generateClinicalNarrative ||
        generateClinicalNarrative;
      const interpretation = await narrativeGenerator(
        screening.screeningType,
        screening.score,
        existingJson.responses
      );

      // Step 3: Persistence (update screening record with interpretation)
      const updatedJson = {
        ...existingJson,
        hasPaidInterpretation: true,
        interpretation,
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
    hasPaidInterpretation: Boolean(responsesJson.hasPaidInterpretation),
    interpretation: responsesJson.interpretation || null
  });
}

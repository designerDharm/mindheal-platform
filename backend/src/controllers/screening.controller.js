import { repositories } from "../repositories/index.js";
import { getBalance, debit } from "../services/wallet.service.js";
import { postJournalTransaction } from "../services/double_entry.service.js";
import { badRequest, created, forbidden, ok, notFound } from "../utils/http.js";
import { createId } from "../utils/security.js";

const BASIC_SCREENING_TYPES = ["low_mood", "anxiety", "burnout", "counsellor_match"];

/**
 * Evaluates screening responses deterministically, calculating score,
 * risk banding, and crisis safety guidance.
 */
export function evaluateScreening(type, responses, clientScore = null) {
  let computedScore = 0;
  let hasValidAnswers = false;

  if (responses && typeof responses === "object") {
    for (const [, val] of Object.entries(responses)) {
      const num = Number(val);
      if (!isNaN(num) && Number.isFinite(num)) {
        computedScore += num;
        hasValidAnswers = true;
      }
    }
  }

  // Use computed score if responses were provided; fallback to clientScore only if valid number
  const score = hasValidAnswers ? computedScore : (clientScore !== null && !isNaN(Number(clientScore)) ? Number(clientScore) : 0);

  let band = "Minimal";
  let title = "Screening Result";
  let description = "";
  let severity = "low";

  if (type === "low_mood") {
    title = "Low-Mood & Energy Result (PHQ)";
    if (score < 5) {
      band = "Minimal / Mild";
      severity = "low";
      description = `Your self-reflection score is ${score} out of 18. This indicates minimal to mild depressive patterns.`;
    } else if (score < 10) {
      band = "Mild";
      severity = "low";
      description = `Your self-reflection score is ${score} out of 18. This indicates mild low-mood patterns.`;
    } else if (score < 15) {
      band = "Moderate";
      severity = "moderate";
      description = `Your self-reflection score is ${score} out of 18. This indicates a moderate low-mood pattern. Consider establishing structured daily micro-routines.`;
    } else {
      band = "Severe";
      severity = "severe";
      description = `Your self-reflection score is ${score} out of 18. This indicates a significant low-mood pattern. Speaking with a verified mental health professional is strongly encouraged.`;
    }
  } else if (type === "anxiety") {
    title = "Anxiety & Overthinking Result (GAD)";
    if (score < 5) {
      band = "Minimal / Mild";
      severity = "low";
      description = `Your self-reflection score is ${score} out of 18. This indicates a manageable anxiety level.`;
    } else if (score < 10) {
      band = "Mild";
      severity = "low";
      description = `Your self-reflection score is ${score} out of 18. This indicates mild worrying tendencies.`;
    } else if (score < 15) {
      band = "Moderate";
      severity = "moderate";
      description = `Your self-reflection score is ${score} out of 18. This indicates moderate worrying loops. Grounding exercises and somatic breathing can help interrupt these loops.`;
    } else {
      band = "Severe";
      severity = "severe";
      description = `Your self-reflection score is ${score} out of 18. This indicates severe restlessness and overthinking loops. Clinical guidance is strongly recommended.`;
    }
  } else if (type === "burnout") {
    title = "Burnout & Exhaustion Result";
    if (score < 4) {
      band = "Healthy / Low Risk";
      severity = "low";
      description = `Your self-reflection score is ${score} out of 12. You maintain healthy work-life boundaries and recovery reserves.`;
    } else if (score < 8) {
      band = "Moderate Burnout";
      severity = "moderate";
      description = `Your self-reflection score is ${score} out of 12. Early signs of emotional detachment and energy depletion are present. Protect non-working hours.`;
    } else {
      band = "Severe Exhaustion";
      severity = "severe";
      description = `Your self-reflection score is ${score} out of 12. Significant cognitive exhaustion and detachment detected. Restorative breaks and professional support are advised.`;
    }
  } else {
    title = "Counsellor Match Screening";
    band = "Ready to Connect";
    severity = "low";
    description = "Your preferences and therapeutic goals have been registered to connect you with verified clinical experts.";
  }

  const safetyGuidance = {
    disclaimer: "This self-assessment is an educational screening tool for self-awareness and care navigation. It does not constitute a formal psychiatric or medical diagnosis.",
    helplines: [
      { name: "Tele-MANAS (Govt of India)", number: "14416 / 1800-891-4416", available: "24/7 Free & Confidential" },
      { name: "KIRAN Mental Health Helpline", number: "1800-599-0019", available: "24/7 Toll-Free" }
    ],
    recommendedAction: severity === "severe"
      ? "Given your elevated score, we strongly encourage reaching out to a licensed psychologist or crisis helpline."
      : "You can track your mood changes over time or discuss these reflections with a verified counsellor."
  };

  return { score, band, title, severity, description, safetyGuidance };
}

function generateClinicalNarrative(type, score, responses = {}) {
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
    return badRequest("Invalid or missing screeningType. Must be 'low_mood', 'anxiety', 'burnout', or 'counsellor_match'.");
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

  const responses = body.responses || {};
  const evaluation = evaluateScreening(screening.screeningType, responses, body.score);

  const existingJson = typeof screening.responsesJson === "object" && screening.responsesJson ? screening.responsesJson : {};
  const responsesJson = {
    ...existingJson,
    responses,
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

export async function requestInterpretation({ params, user }) {
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

  await debit(user.id, priceInr, "screening_interpretation_purchase", {
    referenceType: "Screening",
    referenceId: screening.id,
    idempotencyKey: `interp_${screening.id}`
  });

  const journal = await postJournalTransaction({
    journalType: "SCREENING_INTERPRETATION_PURCHASE",
    businessReferenceType: "Screening",
    businessReferenceId: screening.id,
    idempotencyKey: `interp_journal_${screening.id}`,
    description: `Purchase clinical interpretation for ${screening.screeningType} screening`,
    entries: [
      { accountKey: `USER_AVAILABLE_${user.id}`, entrySide: "debit", amountPaise: pricePaise },
      { accountKey: "PLATFORM_REVENUE", entrySide: "credit", amountPaise: pricePaise }
    ]
  });
  await repositories.journalTransactions.create(journal);

  const interpretation = generateClinicalNarrative(screening.screeningType, screening.score, existingJson.responses);

  const updatedJson = {
    ...existingJson,
    hasPaidInterpretation: true,
    interpretation,
    interpretationPurchasedAt: new Date().toISOString()
  };

  try {
    const updated = await repositories.screenings.update(screening.id, {
      responsesJson: updatedJson
    });

    return ok({
      screening: updated,
      hasPaidInterpretation: true,
      interpretation
    });
  } catch (err) {
    try {
      await credit(user.id, priceInr, "screening_interpretation_purchase_refund", {
        referenceType: "Screening",
        referenceId: screening.id,
        idempotencyKey: `interp_refund_${screening.id}`
      });
    } catch (refundErr) {
      console.error("Failed to refund interpretation purchase:", refundErr);
    }
    throw err;
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

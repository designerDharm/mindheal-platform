/**
 * Versioned Questionnaire Definitions & Scoring Service (SSoT)
 * Governs self-assessment definitions, completeness checks, value validation,
 * and deterministic scoring logic.
 */

export const QUESTIONNAIRES = {
  phq9: {
    version: "2026.1.0",
    policyVersion: "2026.1",
    type: "phq9",
    title: "Patient Health Questionnaire (PHQ-9)",
    shortName: "PHQ-9",
    status: "available",
    minimumAge: 18,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    maxScore: 27,
    questions: [
      { id: "q1", text: "Little interest or pleasure in doing things?", category: "Interest" },
      { id: "q2", text: "Feeling down, depressed, or hopeless?", category: "Mood" },
      { id: "q3", text: "Trouble falling or staying asleep, or sleeping too much?", category: "Sleep" },
      { id: "q4", text: "Feeling tired or having little energy?", category: "Energy" },
      { id: "q5", text: "Poor appetite or overeating?", category: "Appetite" },
      { id: "q6", text: "Feeling bad about yourself - or that you are a failure or have let yourself or your family down?", category: "Self-worth" },
      { id: "q7", text: "Trouble concentrating on things, such as reading the newspaper or watching television?", category: "Concentration" },
      { id: "q8", text: "Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual?", category: "Psychomotor" },
      { id: "q9", text: "Thoughts that you would be better off dead, or of hurting yourself in some way?", category: "Self-harm", isSafetyCritical: true }
    ],
    bands: [
      { min: 0, max: 4, band: "Minimal Depression", severity: "low", description: "Your self-reflection score is {score} out of 27. This indicates minimal depressive symptoms." },
      { min: 5, max: 9, band: "Mild Depression", severity: "low", description: "Your self-reflection score is {score} out of 27. This indicates mild depressive symptoms." },
      { min: 10, max: 14, band: "Moderate Depression", severity: "moderate", description: "Your self-reflection score is {score} out of 27. This indicates moderate depressive symptoms. Professional consultation is advised." },
      { min: 15, max: 19, band: "Moderately Severe Depression", severity: "moderate", description: "Your self-reflection score is {score} out of 27. This indicates moderately severe depressive symptoms. Active clinical support is recommended." },
      { min: 20, max: 27, band: "Severe Depression", severity: "severe", description: "Your self-reflection score is {score} out of 27. This indicates severe depressive symptoms. Prompt consultation with a mental health professional is strongly urged." }
    ]
  },
  gad7: {
    version: "2026.1.0",
    policyVersion: "2026.1",
    type: "gad7",
    title: "Generalized Anxiety Disorder Assessment (GAD-7)",
    shortName: "GAD-7",
    status: "available",
    minimumAge: 18,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    maxScore: 21,
    questions: [
      { id: "q1", text: "Feeling nervous, anxious, or on edge?", category: "Nervousness" },
      { id: "q2", text: "Not being able to stop or control worrying?", category: "Uncontrolled worry" },
      { id: "q3", text: "Worrying too much about different things?", category: "Excessive worry" },
      { id: "q4", text: "Trouble relaxing?", category: "Restlessness" },
      { id: "q5", text: "Being so restless that it is hard to sit still?", category: "Motor agitation" },
      { id: "q6", text: "Becoming easily annoyed or irritable?", category: "Irritability" },
      { id: "q7", text: "Feeling afraid as if something awful might happen?", category: "Anticipatory dread" }
    ],
    bands: [
      { min: 0, max: 4, band: "Minimal Anxiety", severity: "low", description: "Your self-reflection score is {score} out of 21. This indicates minimal anxiety symptoms." },
      { min: 5, max: 9, band: "Mild Anxiety", severity: "low", description: "Your self-reflection score is {score} out of 21. This indicates mild anxiety symptoms." },
      { min: 10, max: 14, band: "Moderate Anxiety", severity: "moderate", description: "Your self-reflection score is {score} out of 21. This indicates moderate anxiety symptoms. Professional consultation is advised." },
      { min: 15, max: 21, band: "Severe Anxiety", severity: "severe", description: "Your self-reflection score is {score} out of 21. This indicates severe anxiety symptoms. Active clinical support is recommended." }
    ]
  },
  who5: {
    version: "2026.1.0",
    policyVersion: "2026.1",
    type: "who5",
    title: "WHO-5 Well-Being Index (1998 version)",
    shortName: "WHO-5",
    category: "Well-Being Indicator",
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4, 5],
    minScore: 0,
    maxScore: 25,
    percentageMultiplier: 4,
    status: "rights_restricted", // Gated pending clinical rights clearance
    minimumAge: 12,
    isAvailable: false,
    owner: "Psychiatric Research Unit, Mental Health Centre North Zealand, Hillerød, Denmark / World Health Organization",
    recallPeriod: "Over the last 2 weeks",
    administrationInstructions: "Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks.",
    copyrightNotice: "The WHO-5 is free to use for non-commercial clinical practice and academic research. Commercial-use rights & platform syndication clearance are currently under clinical and licensing review.",
    questions: [
      { id: "q1", text: "I have felt cheerful and in good spirits", category: "Positive mood" },
      { id: "q2", text: "I have felt calm and relaxed", category: "Vitality & Calm" },
      { id: "q3", text: "I have felt active and vigorous", category: "Vitality" },
      { id: "q4", text: "I woke up feeling fresh and rested", category: "Restorative sleep" },
      { id: "q5", text: "My daily life has been filled with things that interest me", category: "General interest" }
    ],
    anchors: [
      { value: 5, label: "All of the time" },
      { value: 4, label: "Most of the time" },
      { value: 3, label: "More than half of the time" },
      { value: 2, label: "Less than half of the time" },
      { value: 1, label: "Some of the time" },
      { value: 0, label: "At no time" }
    ],
    bands: [
      { min: 0, max: 12, band: "Poor Well-Being", severity: "moderate", description: "Your raw score is {score} out of 25 ({percentage}%). A raw score below 13 indicates reduced emotional well-being and is the official WHO-5 cut-off warranting further screening for depression." },
      { min: 13, max: 21, band: "Adequate Well-Being", severity: "low", description: "Your raw score is {score} out of 25 ({percentage}%). This reflects adequate psychological well-being over the past two weeks." },
      { min: 22, max: 25, band: "Optimal Well-Being", severity: "optimal", description: "Your raw score is {score} out of 25 ({percentage}%). This reflects high, flourishing psychological well-being." }
    ]
  },
  low_mood: {
    version: "1.0.0",
    type: "low_mood",
    title: "Low-Mood & Energy Screening (PHQ)",
    shortName: "PHQ-6",
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    maxScore: 18,
    questions: [
      { id: "q1", text: "Little interest or pleasure in doing things?", category: "Interest" },
      { id: "q2", text: "Feeling down, depressed, or hopeless?", category: "Mood" },
      { id: "q3", text: "Trouble falling or staying asleep, or sleeping too much?", category: "Sleep" },
      { id: "q4", text: "Feeling tired or having little energy?", category: "Energy" },
      { id: "q5", text: "Poor appetite or overeating?", category: "Appetite" },
      { id: "q6", text: "Feeling bad about yourself — or that you are a failure?", category: "Self-worth" }
    ],
    bands: [
      { min: 0, max: 4, band: "Minimal / Mild", severity: "low", description: "Your self-reflection score is {score} out of 18. This indicates minimal to mild depressive patterns." },
      { min: 5, max: 9, band: "Mild", severity: "low", description: "Your self-reflection score is {score} out of 18. This indicates mild low-mood patterns." },
      { min: 10, max: 14, band: "Moderate", severity: "moderate", description: "Your self-reflection score is {score} out of 18. This indicates a moderate low-mood pattern. Consider establishing structured daily micro-routines." },
      { min: 15, max: 18, band: "Severe", severity: "severe", description: "Your self-reflection score is {score} out of 18. This indicates a significant low-mood pattern. Speaking with a verified mental health professional is strongly encouraged." }
    ]
  },
  anxiety: {
    version: "1.0.0",
    type: "anxiety",
    title: "Anxiety & Overthinking Screening (GAD)",
    shortName: "GAD-6",
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    maxScore: 18,
    questions: [
      { id: "q1", text: "Feeling nervous, anxious or on edge?", category: "Nervousness" },
      { id: "q2", text: "Not being able to stop or control worrying?", category: "Worry" },
      { id: "q3", text: "Worrying too much about different things?", category: "Worry scope" },
      { id: "q4", text: "Trouble relaxing?", category: "Relaxation" },
      { id: "q5", text: "Being so restless that it is hard to sit still?", category: "Restlessness" },
      { id: "q6", text: "Becoming easily annoyed or irritable?", category: "Irritability" }
    ],
    bands: [
      { min: 0, max: 4, band: "Minimal / Mild", severity: "low", description: "Your self-reflection score is {score} out of 18. This indicates a manageable anxiety level." },
      { min: 5, max: 9, band: "Mild", severity: "low", description: "Your self-reflection score is {score} out of 18. This indicates mild worrying tendencies." },
      { min: 10, max: 14, band: "Moderate", severity: "moderate", description: "Your self-reflection score is {score} out of 18. This indicates moderate worrying loops. Grounding exercises and somatic breathing can help interrupt these loops." },
      { min: 15, max: 18, band: "Severe", severity: "severe", description: "Your self-reflection score is {score} out of 18. This indicates severe restlessness and overthinking loops. Clinical guidance is strongly recommended." }
    ]
  },
  burnout: {
    version: "1.0.0",
    type: "burnout",
    title: "Burnout & Exhaustion Screening",
    shortName: "MBI-4",
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    maxScore: 12,
    questions: [
      { id: "q1", text: "Feeling emotionally exhausted or drained by work?", category: "Exhaustion" },
      { id: "q2", text: "Feeling less interested or more cynical about your job?", category: "Cynicism" },
      { id: "q3", text: "Feeling like you aren't achieving or accomplishing enough?", category: "Efficacy" },
      { id: "q4", text: "Struggling to find energy or motivation to start your day?", category: "Motivation" }
    ],
    bands: [
      { min: 0, max: 3, band: "Healthy / Low Risk", severity: "low", description: "Your self-reflection score is {score} out of 12. You maintain healthy work-life boundaries and recovery reserves." },
      { min: 4, max: 7, band: "Moderate Burnout", severity: "moderate", description: "Your self-reflection score is {score} out of 12. Early signs of emotional detachment and energy depletion are present. Protect non-working hours." },
      { min: 8, max: 12, band: "Severe Exhaustion", severity: "severe", description: "Your self-reflection score is {score} out of 12. Significant cognitive exhaustion and detachment detected. Restorative breaks and professional support are advised." }
    ]
  },
  counsellor_match: {
    version: "1.0.0",
    type: "counsellor_match",
    title: "Counsellor Match Screening",
    shortName: "INTAKE-4",
    scoringType: "categorical",
    maxScore: 0,
    questions: [
      { id: "q1", text: "What is your primary reason for seeking counselling?", allowedValues: ["Stress/Burnout", "Anxiety/Panic", "Low mood/Depression", "Relationship issues", "Personal growth"] },
      { id: "q2", text: "What is your preferred language for counselling sessions?", allowedValues: ["English", "Hindi", "Both"] },
      { id: "q3", text: "Do you have a preferred gender for your counsellor?", allowedValues: ["Female", "Male", "No Preference"] },
      { id: "q4", text: "Have you attended therapy or clinical counselling before?", allowedValues: ["Yes, frequently", "Yes, in the past", "No, this is my first time"] }
    ],
    bands: [
      { min: 0, max: 0, band: "Ready to Connect", severity: "low", description: "Your preferences and therapeutic goals have been registered to connect you with verified clinical experts." }
    ]
  }
};

export const CRISIS_SAFETY_GUIDANCE = {
  disclaimer: "This self-assessment is an educational screening tool for self-awareness and care navigation. It does not constitute a formal psychiatric or medical diagnosis.",
  helplines: [
    { name: "Tele-MANAS (Govt of India)", number: "14416 / 1800-891-4416", available: "24/7 Free & Confidential" },
    { name: "KIRAN Mental Health Helpline", number: "1800-599-0019", available: "24/7 Toll-Free" }
  ]
};

/**
 * Validates submission completeness, rejects invalid values or fabricated scores,
 * and calculates deterministic score and risk banding.
 */
export function validateAndEvaluateScreening(screeningType, payload = {}) {
  const questionnaire = QUESTIONNAIRES[screeningType];
  if (!questionnaire) {
    return {
      isValid: false,
      error: `Unsupported screening type: ${screeningType}. Must be one of: ${Object.keys(QUESTIONNAIRES).join(", ")}`
    };
  }

  // 1. Reject fabricated scores upfront
  if (payload.score !== undefined && payload.score !== null) {
    const rawScore = Number(payload.score);
    if (isNaN(rawScore) || !Number.isFinite(rawScore) || rawScore < 0) {
      return {
        isValid: false,
        error: `Fabricated or invalid score provided (${payload.score}). Screening scores must be positive numbers computed from validated answers.`
      };
    }
  }

  // 2. Validate answers presence
  const rawAnswers = payload.responses !== undefined ? payload.responses : payload.answers;
  if (rawAnswers === undefined || rawAnswers === null) {
    return {
      isValid: false,
      error: "Empty answers provided. All questions must be completed."
    };
  }

  if (Array.isArray(rawAnswers) && rawAnswers.length === 0) {
    return {
      isValid: false,
      error: "Empty answers provided. All questions must be completed."
    };
  }

  if (typeof rawAnswers === "object" && !Array.isArray(rawAnswers) && Object.keys(rawAnswers).length === 0) {
    return {
      isValid: false,
      error: "Empty answers provided. All questions must be completed."
    };
  }

  if (typeof rawAnswers !== "object") {
    return {
      isValid: false,
      error: "Answers must be supplied as a structured object or array."
    };
  }

  // 3. Extract and validate each question's answer
  const questions = questionnaire.questions;
  const validatedAnswers = {};
  let serverCalculatedScore = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qKey1 = `q${i + 1}`; // 1-based (q1..q9)
    const qKey0 = `q${i}`;     // 0-based (q0..q8)
    const prefixedKey = `${screeningType}_q${i + 1}`; // e.g. phq9_q1, gad7_q1
    
    let answerValue;
    if (Array.isArray(rawAnswers)) {
      answerValue = rawAnswers[i];
    } else if (rawAnswers[prefixedKey] !== undefined) {
      answerValue = rawAnswers[prefixedKey];
    } else if (rawAnswers[qKey1] !== undefined) {
      answerValue = rawAnswers[qKey1];
    } else if (rawAnswers[qKey0] !== undefined) {
      answerValue = rawAnswers[qKey0];
    } else if (rawAnswers[String(i)] !== undefined) {
      answerValue = rawAnswers[String(i)];
    } else if (rawAnswers[q.id] !== undefined) {
      answerValue = rawAnswers[q.id];
    }

    // Completeness check
    if (answerValue === undefined || answerValue === null || answerValue === "") {
      return {
        isValid: false,
        error: `Incomplete answers: Question ${i + 1} (${q.text}) is unanswered. All ${questions.length} questions are required.`
      };
    }

    // Allowed values check
    if (questionnaire.scoringType === "sum") {
      if (typeof answerValue === "boolean") {
        return {
          isValid: false,
          error: `Invalid type boolean for Question ${i + 1}. Expected integer value from [${questionnaire.allowedValues.join(", ")}].`
        };
      }
      const numVal = Number(answerValue);
      if (isNaN(numVal) || !Number.isInteger(numVal) || !questionnaire.allowedValues.includes(numVal)) {
        return {
          isValid: false,
          error: `Invalid answer value '${answerValue}' for Question ${i + 1}. Allowed values are: ${questionnaire.allowedValues.join(", ")}.`
        };
      }
      validatedAnswers[qKey1] = numVal;
      serverCalculatedScore += numVal;
    } else {
      // Categorical validation
      const stringVal = String(answerValue).trim();
      if (!q.allowedValues.includes(stringVal)) {
        return {
          isValid: false,
          error: `Invalid choice '${stringVal}' for Question ${i + 1}. Allowed options are: ${q.allowedValues.join(", ")}.`
        };
      }
      validatedAnswers[qKey1] = stringVal;
    }
  }

  // 4. Reject client-supplied fabricated score if it differs from server computation
  if (payload.score !== undefined && payload.score !== null) {
    const clientScore = Number(payload.score);
    if (clientScore !== serverCalculatedScore) {
      return {
        isValid: false,
        error: `Client score mismatch: Submitted score was ${clientScore}, but server-calculated score from answers is ${serverCalculatedScore}.`
      };
    }
  }

  // 5. Band and severity determination
  let matchedBand = questionnaire.bands[0];
  for (const b of questionnaire.bands) {
    if (serverCalculatedScore >= b.min && serverCalculatedScore <= b.max) {
      matchedBand = b;
      break;
    }
  }

  // 6. Clinician-approved item-level safety rules (MH-16)
  // Any positive response on a safety-critical item (e.g., PHQ-9 Item 9: self-harm thoughts)
  // triggers immediate crisis guidance regardless of whether total score is low (e.g. Total = 1, "Minimal")
  let itemLevelSafetyTriggered = false;
  let safetyTriggerItem = null;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qKey1 = `q${i + 1}`;
    const ansVal = validatedAnswers[qKey1];
    if (q.isSafetyCritical || q.category === "Self-harm" || (questionnaire.shortName === "PHQ-9" && i === 8)) {
      if (Number(ansVal) > 0) {
        itemLevelSafetyTriggered = true;
        safetyTriggerItem = { questionIndex: i + 1, questionText: q.text, answerValue: ansVal };
        break;
      }
    }
  }

  const description = matchedBand.description.replace("{score}", String(serverCalculatedScore));
  const safetyGuidance = {
    ...CRISIS_SAFETY_GUIDANCE,
    crisisAlert: itemLevelSafetyTriggered,
    hasItemLevelCrisisAlert: itemLevelSafetyTriggered,
    safetyTriggerItem,
    recommendedAction: itemLevelSafetyTriggered
      ? "URGENT CLINICAL SAFETY GUIDANCE: You indicated thoughts of being better off dead or hurting yourself. Regardless of your total score, your safety is our top priority. Please contact a free, confidential 24/7 crisis helpline right away."
      : (matchedBand.severity === "severe"
          ? "Given your elevated score, we strongly encourage reaching out to a licensed psychologist or crisis helpline."
          : "You can track your mood changes over time or discuss these reflections with a verified counsellor.")
  };

  if (itemLevelSafetyTriggered) {
    safetyGuidance.helplines = [
      { name: "Tele-MANAS (Govt of India)", number: "14416 / 1800-891-4416", available: "24/7 Free & Confidential (Toll-Free)" },
      { name: "AASRA Suicide Prevention Helpline", number: "9820466726", available: "24/7 Free & Confidential" },
      { name: "KIRAN Mental Health Helpline", number: "1800-599-0019", available: "24/7 Toll-Free" },
      { name: "National Emergency Services", number: "112", available: "24/7 Toll-Free" }
    ];
  }

  // Extract optional functional impact & intake context (unscored, non-diagnostic)
  const functionalImpact = payload.functionalImpact !== undefined && payload.functionalImpact !== null
    ? Number(payload.functionalImpact)
    : (rawAnswers.functionalImpact !== undefined && rawAnswers.functionalImpact !== null ? Number(rawAnswers.functionalImpact) : null);

  const rawContext = payload.intakeContext || rawAnswers.intakeContext || null;
  let intakeContext = null;
  if (rawContext && typeof rawContext === "object") {
    intakeContext = {
      onsetDuration: typeof rawContext.onsetDuration === "string" ? rawContext.onsetDuration.slice(0, 100) : "",
      dailyDifficulties: Array.isArray(rawContext.dailyDifficulties) ? rawContext.dailyDifficulties.slice(0, 10) : [],
      healthChanges: typeof rawContext.healthChanges === "string" ? rawContext.healthChanges.slice(0, 500) : "",
      previousSupport: typeof rawContext.previousSupport === "string" ? rawContext.previousSupport.slice(0, 100) : "",
      personalGoals: typeof rawContext.personalGoals === "string" ? rawContext.personalGoals.slice(0, 500) : ""
    };
  }

  const language = typeof payload.language === "string" ? payload.language.slice(0, 10) : "en";

  return {
    isValid: true,
    questionnaireVersion: questionnaire.version,
    policyVersion: questionnaire.policyVersion || "2026.1",
    language,
    screeningType,
    score: serverCalculatedScore,
    band: matchedBand.band,
    severity: itemLevelSafetyTriggered ? "critical" : matchedBand.severity,
    title: questionnaire.title,
    description,
    safetyGuidance,
    validatedAnswers,
    functionalImpact,
    intakeContext
  };
}

/**
 * Calculates accurate chronological age from a YYYY-MM-DD date string
 * against a reference date (defaulting to current date), accounting for leap years
 * and exact day-of-month boundaries.
 */
export function calculateAge(dobString, referenceDate = new Date()) {
  if (!dobString) return null;

  let year, month, day;
  if (typeof dobString === "string") {
    const str = dobString.trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  } else if (dobString instanceof Date && !isNaN(dobString.getTime())) {
    year = dobString.getUTCFullYear();
    month = dobString.getUTCMonth() + 1;
    day = dobString.getUTCDate();
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dobUtc = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(dobUtc.getTime())) return null;
  if (dobUtc.getUTCFullYear() !== year || dobUtc.getUTCMonth() !== month - 1 || dobUtc.getUTCDate() !== day) {
    return null;
  }

  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const refUtc = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  if (dobUtc > refUtc) return null;

  let age = refUtc.getUTCFullYear() - dobUtc.getUTCFullYear();
  const monthDiff = refUtc.getUTCMonth() - dobUtc.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refUtc.getUTCDate() < dobUtc.getUTCDate())) {
    age--;
  }

  if (age < 0) return null;
  return age;
}


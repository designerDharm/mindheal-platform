const PROHIBITED_DIAGNOSIS_PATTERNS = [
  /you have (depression|bipolar|adhd|anxiety disorder|schizophrenia|ptsd|ocd|a mental illness)/i,
  /you are (bipolar|schizophrenic|autistic|depressed|borderline)/i,
  /this confirms (depression|bipolar|adhd|autism|a disorder)/i,
  /your (handwriting|signature|face|dream) proves (trauma|dishonesty|mental illness|depression)/i,
  /take this (medicine|medication|drug|pill|antidepressant)/i,
  /stop taking your (medicine|medication|pills|antidepressants)/i,
  /prescribe (you|a dose of)/i
];

export function validateAndSanitizeAiOutput(rawText = "") {
  if (!rawText || typeof rawText !== "string") {
    return {
      isValid: true,
      text: rawText,
      hasMedicalClaims: false
    };
  }

  for (const pattern of PROHIBITED_DIAGNOSIS_PATTERNS) {
    if (pattern.test(rawText)) {
      console.warn("[SafetyDetector] Blocked medical/diagnostic claim in AI output.");
      
      const safeSanitizedText = rawText
        .replace(pattern, "[reflective observation]")
        .trim();

      const disclaimer = "\n\n*Disclaimer: MindHeal AI provides reflective wellness guidance and is not a medical diagnostic tool. Please consult a licensed professional for clinical evaluation.*";

      return {
        isValid: false,
        text: `${safeSanitizedText}${disclaimer}`,
        hasMedicalClaims: true,
        matchedPattern: pattern.toString()
      };
    }
  }

  return {
    isValid: true,
    text: rawText,
    hasMedicalClaims: false
  };
}

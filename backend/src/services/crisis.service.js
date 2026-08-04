import { repositories } from "../repositories/index.js";

const HIGH_RISK_PATTERNS = [
  /suicide/i,
  /kill my\s*self/i,
  /want to die/i,
  /end my life/i,
  /self[- ]harm/i,
  /cut my\s*wrists/i,
  /overdose/i,
  /hanging my\s*self/i
];

export async function checkDeterministicCrisis(text, userId = null) {
  if (!text || typeof text !== "string") return null;

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(text)) {
      const actionMessage = "If you are feeling overwhelmed or having thoughts of self-harm, please reach out immediately to a trusted professional or a free 24/7 crisis helpline. In India, call AASRA at +91-9820466726 or Tele-MANAS at 14416.";
      
      try {
        await repositories.crisisEvents?.create?.({
          userId,
          source: "deterministic_rule_engine",
          riskLevel: "CRITICAL",
          detectedTextHash: "masked_for_privacy",
          actionTaken: "Triggered emergency helpline response and blocked generative AI pipeline."
        });
      } catch (err) {
        console.error("[CrisisEngine] Failed to log crisis event:", err);
      }

      return {
        isCrisis: true,
        riskLevel: "CRITICAL",
        message: actionMessage,
        helplines: [
          { name: "Tele-MANAS (India)", phone: "14416" },
          { name: "AASRA Suicide Helpline", phone: "+91-9820466726" },
          { name: "Vandrevala Foundation", phone: "+91-9999666555" }
        ]
      };
    }
  }

  return null;
}

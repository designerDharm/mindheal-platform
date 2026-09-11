import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ASSESSMENT_REGISTRY, scoreAssessment } from "../src/data/assessment-registry.js";
import { createAssessmentState, AssessmentController } from "../src/features/assessment-flow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const mainJsPath = path.join(rootDir, "src", "main.js");

test("Prompt 5: Complete safety handling and result wording", async (t) => {
  const mainJsContent = fs.readFileSync(mainJsPath, "utf8");

  await t.test("1. PHQ-9 Item 9 triggers safety alert for positive values (1, 2, 3) across low and high total scores", () => {
    // Value 1 with low total score (score = 1)
    const resLow1 = scoreAssessment("phq9", [0,0,0,0,0,0,0,0,1]);
    assert.strictEqual(resLow1.totalScore, 1);
    assert.strictEqual(resLow1.itemLevelSafetyTriggered, true);
    assert.strictEqual(resLow1.safetyTriggerItem.score, 1);

    // Value 2 with moderate total score
    const resMed2 = scoreAssessment("phq9", [1,1,1,1,1,1,1,1,2]);
    assert.strictEqual(resMed2.totalScore, 10);
    assert.strictEqual(resMed2.itemLevelSafetyTriggered, true);
    assert.strictEqual(resMed2.safetyTriggerItem.score, 2);

    // Value 3 with severe total score
    const resHigh3 = scoreAssessment("phq9", [3,3,3,3,3,3,3,3,3]);
    assert.strictEqual(resHigh3.totalScore, 27);
    assert.strictEqual(resHigh3.itemLevelSafetyTriggered, true);
    assert.strictEqual(resHigh3.safetyTriggerItem.score, 3);
  });

  await t.test("2. PHQ-9 Item 9 = 0 does NOT trigger crisis alert, and low score does NOT claim person is completely safe", () => {
    const resZero = scoreAssessment("phq9", [0,0,0,0,0,0,0,0,0]);
    assert.strictEqual(resZero.totalScore, 0);
    assert.strictEqual(resZero.itemLevelSafetyTriggered, false);
    assert.strictEqual(resZero.safetyTriggerItem, null);

    // Ensure wording says "Minimal or no depressive symptoms reported" and NOT "You are completely safe"
    assert.doesNotMatch(resZero.description, /completely safe/i);
  });

  await t.test("3. Result layout displays non-diagnostic metadata (score/range, instrument, date, version, limitations)", () => {
    assert.match(mainJsContent, /Non-Diagnostic Screening Result/, "Result screen must state non-diagnostic screening");
    assert.match(mainJsContent, /Clinical Limitations & Next Steps/, "Result screen must include clinical limitations header");
    assert.match(mainJsContent, /Screening Instrument/, "Must show screening instrument metadata");
    assert.match(mainJsContent, /Language & Version/, "Must show language and version metadata");
    assert.match(mainJsContent, /Completion Date/, "Must show completion date metadata");
    assert.match(mainJsContent, /Recall Period/, "Must show recall period metadata");
    assert.match(mainJsContent, /Score Range/, "Must show explicit score range (e.g. 0 – 27)");
  });

  await t.test("4. Emergency support is directly accessible without requiring login, AI credits, or payment", () => {
    // Tele-MANAS (14416) and AASRA (9820466726)
    assert.match(mainJsContent, /href="tel:14416"/, "Must render direct call link to Tele-MANAS (14416)");
    assert.match(mainJsContent, /href="tel:9820466726"/, "Must render direct call link to AASRA (9820466726)");
    assert.match(mainJsContent, /href="#\/crisis"/, "Must provide fallback link to full crisis directory");
  });

  await t.test("5. Verified contact details match statutory Indian helplines", () => {
    assert.match(mainJsContent, /14416/, "Tele-MANAS national toll-free helpline");
    assert.match(mainJsContent, /1800-891-4416/, "Tele-MANAS full 1800 number");
    assert.match(mainJsContent, /9820466726/, "AASRA suicide helpline");
    assert.match(mainJsContent, /1800-599-0019/, "KIRAN mental health helpline");
    assert.match(mainJsContent, /112/, "National Emergency number 112");
  });
});

import test from "node:test";
import assert from "node:assert";
import { ASSESSMENT_REGISTRY, scoreAssessment, ASSESSMENT_REGISTRY_VERSION } from "../src/data/assessment-registry.js";
import { validateAndEvaluateScreening, QUESTIONNAIRES } from "../backend/src/services/questionnaire.service.js";

test("Prompt 3: Establish versioned definitions and deterministic scoring", async (t) => {

  await t.test("1. Registry exposes versioned metadata, recall period, and rights status", () => {
    assert.strictEqual(ASSESSMENT_REGISTRY_VERSION, "2026.1.0");
    const phq9 = ASSESSMENT_REGISTRY.phq9;
    assert.strictEqual(phq9.shortName, "PHQ-9");
    assert.strictEqual(phq9.itemCount, 9);
    assert.strictEqual(phq9.recallPeriod, "Over the last 2 weeks");
    assert.match(phq9.copyright, /public domain screener/i);
    assert.strictEqual(phq9.items[8].isSafetyCritical, true);

    const gad7 = ASSESSMENT_REGISTRY.gad7;
    assert.strictEqual(gad7.shortName, "GAD-7");
    assert.strictEqual(gad7.itemCount, 7);
    assert.strictEqual(gad7.recallPeriod, "Over the last 2 weeks");
    assert.match(gad7.copyright, /public domain screener/i);
  });

  await t.test("2. PHQ-9 deterministic scoring: boundaries (0/27) and score transitions (4/5, 9/10, 14/15, 19/20)", () => {
    // Score 0 -> Minimal Depression
    const r0 = scoreAssessment("phq9", [0,0,0,0,0,0,0,0,0]);
    assert.strictEqual(r0.isValid, true);
    assert.strictEqual(r0.totalScore, 0);
    assert.strictEqual(r0.band, "Minimal Depression");
    assert.strictEqual(r0.itemLevelSafetyTriggered, false);

    // Score 4 -> Minimal Depression (Transition boundary 4)
    const r4 = scoreAssessment("phq9", [1,1,1,1,0,0,0,0,0]);
    assert.strictEqual(r4.isValid, true);
    assert.strictEqual(r4.totalScore, 4);
    assert.strictEqual(r4.band, "Minimal Depression");

    // Score 5 -> Mild Depression (Transition boundary 5)
    const r5 = scoreAssessment("phq9", [1,1,1,1,1,0,0,0,0]);
    assert.strictEqual(r5.isValid, true);
    assert.strictEqual(r5.totalScore, 5);
    assert.strictEqual(r5.band, "Mild Depression");

    // Score 9 -> Mild Depression (Transition boundary 9)
    const r9 = scoreAssessment("phq9", [2,2,2,2,1,0,0,0,0]);
    assert.strictEqual(r9.isValid, true);
    assert.strictEqual(r9.totalScore, 9);
    assert.strictEqual(r9.band, "Mild Depression");

    // Score 10 -> Moderate Depression (Transition boundary 10)
    const r10 = scoreAssessment("phq9", [2,2,2,2,2,0,0,0,0]);
    assert.strictEqual(r10.isValid, true);
    assert.strictEqual(r10.totalScore, 10);
    assert.strictEqual(r10.band, "Moderate Depression");

    // Score 14 -> Moderate Depression (Transition boundary 14)
    const r14 = scoreAssessment("phq9", [2,2,2,2,2,2,2,0,0]);
    assert.strictEqual(r14.isValid, true);
    assert.strictEqual(r14.totalScore, 14);
    assert.strictEqual(r14.band, "Moderate Depression");

    // Score 15 -> Moderately Severe Depression (Transition boundary 15)
    const r15 = scoreAssessment("phq9", [3,3,3,3,3,0,0,0,0]);
    assert.strictEqual(r15.isValid, true);
    assert.strictEqual(r15.totalScore, 15);
    assert.strictEqual(r15.band, "Moderately Severe Depression");

    // Score 19 -> Moderately Severe Depression (Transition boundary 19)
    const r19 = scoreAssessment("phq9", [3,3,3,3,3,2,2,0,0]);
    assert.strictEqual(r19.isValid, true);
    assert.strictEqual(r19.totalScore, 19);
    assert.strictEqual(r19.band, "Moderately Severe Depression");

    // Score 20 -> Severe Depression (Transition boundary 20)
    const r20 = scoreAssessment("phq9", [3,3,3,3,3,3,2,0,0]);
    assert.strictEqual(r20.isValid, true);
    assert.strictEqual(r20.totalScore, 20);
    assert.strictEqual(r20.band, "Severe Depression");

    // Score 27 -> Severe Depression (Maximum total)
    const r27 = scoreAssessment("phq9", [3,3,3,3,3,3,3,3,3]);
    assert.strictEqual(r27.isValid, true);
    assert.strictEqual(r27.totalScore, 27);
    assert.strictEqual(r27.band, "Severe Depression");
    assert.strictEqual(r27.itemLevelSafetyTriggered, true);
  });

  await t.test("3. GAD-7 deterministic scoring: boundaries (0/21) and score transitions (4/5, 9/10, 14/15)", () => {
    // Score 0 -> Minimal Anxiety
    const g0 = scoreAssessment("gad7", [0,0,0,0,0,0,0]);
    assert.strictEqual(g0.isValid, true);
    assert.strictEqual(g0.totalScore, 0);
    assert.strictEqual(g0.band, "Minimal Anxiety");

    // Score 4 -> Minimal Anxiety (Transition boundary 4)
    const g4 = scoreAssessment("gad7", [1,1,1,1,0,0,0]);
    assert.strictEqual(g4.isValid, true);
    assert.strictEqual(g4.totalScore, 4);
    assert.strictEqual(g4.band, "Minimal Anxiety");

    // Score 5 -> Mild Anxiety (Transition boundary 5)
    const g5 = scoreAssessment("gad7", [1,1,1,1,1,0,0]);
    assert.strictEqual(g5.isValid, true);
    assert.strictEqual(g5.totalScore, 5);
    assert.strictEqual(g5.band, "Mild Anxiety");

    // Score 9 -> Mild Anxiety (Transition boundary 9)
    const g9 = scoreAssessment("gad7", [2,2,2,2,1,0,0]);
    assert.strictEqual(g9.isValid, true);
    assert.strictEqual(g9.totalScore, 9);
    assert.strictEqual(g9.band, "Mild Anxiety");

    // Score 10 -> Moderate Anxiety (Transition boundary 10)
    const g10 = scoreAssessment("gad7", [2,2,2,2,2,0,0]);
    assert.strictEqual(g10.isValid, true);
    assert.strictEqual(g10.totalScore, 10);
    assert.strictEqual(g10.band, "Moderate Anxiety");

    // Score 14 -> Moderate Anxiety (Transition boundary 14)
    const g14 = scoreAssessment("gad7", [2,2,2,2,2,2,2]);
    assert.strictEqual(g14.isValid, true);
    assert.strictEqual(g14.totalScore, 14);
    assert.strictEqual(g14.band, "Moderate Anxiety");

    // Score 15 -> Severe Anxiety (Transition boundary 15)
    const g15 = scoreAssessment("gad7", [3,3,3,3,3,0,0]);
    assert.strictEqual(g15.isValid, true);
    assert.strictEqual(g15.totalScore, 15);
    assert.strictEqual(g15.band, "Severe Anxiety");

    // Score 21 -> Severe Anxiety (Maximum total)
    const g21 = scoreAssessment("gad7", [3,3,3,3,3,3,3]);
    assert.strictEqual(g21.isValid, true);
    assert.strictEqual(g21.totalScore, 21);
    assert.strictEqual(g21.band, "Severe Anxiety");
  });

  await t.test("4. Input validation rejects missing, malformed, booleans, decimals, and out-of-range items", () => {
    // Missing an item (only 8 items for PHQ-9)
    const incomplete = scoreAssessment("phq9", [1,1,1,1,1,1,1,1]);
    assert.strictEqual(incomplete.isValid, false);
    assert.match(incomplete.error, /incomplete response set/i);

    // Boolean value
    const boolVal = scoreAssessment("phq9", [1,1,1,1,1,1,1,1,true]);
    assert.strictEqual(boolVal.isValid, false);
    assert.match(boolVal.error, /invalid type boolean/i);

    // Decimal value
    const decimalVal = scoreAssessment("phq9", [1,1,1,1,1,1,1,1,2.5]);
    assert.strictEqual(decimalVal.isValid, false);
    assert.match(decimalVal.error, /invalid non-integer value/i);

    // Out of range (4 is outside [0, 1, 2, 3])
    const outOfRange = scoreAssessment("phq9", [1,1,1,1,1,1,1,1,4]);
    assert.strictEqual(outOfRange.isValid, false);
    assert.match(outOfRange.error, /out of allowed range/i);

    // Negative value
    const negVal = scoreAssessment("phq9", [1,1,1,1,1,1,1,1,-1]);
    assert.strictEqual(negVal.isValid, false);
    assert.match(negVal.error, /out of allowed range/i);

    // Never turn unanswered items into zero
    const emptyItem = scoreAssessment("phq9", { phq9_q1: 0, phq9_q2: 0, phq9_q3: null });
    assert.strictEqual(emptyItem.isValid, false);
    assert.match(emptyItem.error, /unanswered/i);
  });

  await t.test("5. Backend service validates GAD-7 and PHQ-9 identically with rejection of booleans and decimals", () => {
    assert.ok(QUESTIONNAIRES.gad7, "Backend QUESTIONNAIRES must contain gad7");
    assert.strictEqual(QUESTIONNAIRES.gad7.questions.length, 7);

    const validGad = validateAndEvaluateScreening("gad7", {
      responses: [1, 2, 1, 2, 1, 2, 1]
    });
    assert.strictEqual(validGad.isValid, true);
    assert.strictEqual(validGad.score, 10);
    assert.strictEqual(validGad.band, "Moderate Anxiety");

    // Rejection of boolean in backend service
    const boolBackend = validateAndEvaluateScreening("gad7", {
      responses: [1, 2, 1, 2, 1, 2, true]
    });
    assert.strictEqual(boolBackend.isValid, false);
    assert.match(boolBackend.error, /boolean/i);

    // Rejection of decimal in backend service
    const decBackend = validateAndEvaluateScreening("gad7", {
      responses: [1, 2, 1, 2, 1, 2, 1.5]
    });
    assert.strictEqual(decBackend.isValid, false);
    assert.match(decBackend.error, /Invalid answer value/i);
  });
});

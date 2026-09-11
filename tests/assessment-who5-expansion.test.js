import test from "node:test";
import assert from "node:assert";
import { ASSESSMENT_REGISTRY, scoreAssessment, ANCHORS_6_POINT } from "../src/data/assessment-registry.js";
import { QUESTIONNAIRES } from "../backend/src/services/questionnaire.service.js";

test("Prompt 10: Expand One Inventory at a Time — WHO-5 Well-Being Index Candidate", async (t) => {

  await t.test("1. Exact-Form Record completeness and fidelity", () => {
    const who5 = ASSESSMENT_REGISTRY.who5;
    assert.ok(who5, "WHO-5 must be registered in assessment registry");
    assert.strictEqual(who5.id, "who5");
    assert.strictEqual(who5.canonicalName, "WHO-5 Well-Being Index (1998 version)");
    assert.strictEqual(who5.shortName, "WHO-5");
    assert.strictEqual(who5.category, "Well-Being Indicator");
    assert.strictEqual(who5.recallPeriod, "Over the last 2 weeks");
    assert.strictEqual(who5.itemCount, 5);
    assert.strictEqual(who5.minScore, 0);
    assert.strictEqual(who5.maxScore, 25);
    assert.strictEqual(who5.percentageMultiplier, 4);
    assert.deepStrictEqual(who5.allowedValues, [0, 1, 2, 3, 4, 5]);

    // Verify official item wording
    assert.strictEqual(who5.items[0].text, "I have felt cheerful and in good spirits");
    assert.strictEqual(who5.items[1].text, "I have felt calm and relaxed");
    assert.strictEqual(who5.items[2].text, "I have felt active and vigorous");
    assert.strictEqual(who5.items[3].text, "I woke up feeling fresh and rested");
    assert.strictEqual(who5.items[4].text, "My daily life has been filled with things that interest me");

    // Verify 6-point anchors
    assert.strictEqual(ANCHORS_6_POINT.length, 6);
    assert.strictEqual(ANCHORS_6_POINT[0].value, 5);
    assert.strictEqual(ANCHORS_6_POINT[0].label, "All of the time");
    assert.strictEqual(ANCHORS_6_POINT[5].value, 0);
    assert.strictEqual(ANCHORS_6_POINT[5].label, "At no time");

    // Verify backend questionnaire definition parity
    const backendWho5 = QUESTIONNAIRES.who5;
    assert.ok(backendWho5, "Backend QUESTIONNAIRES must contain who5");
    assert.strictEqual(backendWho5.maxScore, 25);
    assert.deepStrictEqual(backendWho5.allowedValues, [0, 1, 2, 3, 4, 5]);
  });

  await t.test("2. Gated availability: Unattended self-administration requires authenticated user login", () => {
    const who5 = ASSESSMENT_REGISTRY.who5;
    assert.strictEqual(who5.status, "available");
    assert.strictEqual(who5.requiresAuth, true);
  });

  await t.test("3. Deterministic scoring fixtures: Minimum, Maximum, and Cut-off Boundaries", () => {
    // 3a. Minimum score (0 on all 5 items) -> Raw 0, 0%
    const minAnswers = { who5_q1: 0, who5_q2: 0, who5_q3: 0, who5_q4: 0, who5_q5: 0 };
    const minRes = scoreAssessment("who5", minAnswers);
    assert.strictEqual(minRes.isValid, true);
    assert.strictEqual(minRes.totalScore, 0);
    assert.strictEqual(minRes.band, "Poor Well-Being");
    assert.strictEqual(minRes.severity, "moderate");

    // 3b. Clinical Cut-off: Score 12 (Raw score < 13 indicates poor well-being, threshold for depression evaluation)
    const cutOffBelowAnswers = { who5_q1: 3, who5_q2: 3, who5_q3: 2, who5_q4: 2, who5_q5: 2 };
    const cutOffBelowRes = scoreAssessment("who5", cutOffBelowAnswers);
    assert.strictEqual(cutOffBelowRes.isValid, true);
    assert.strictEqual(cutOffBelowRes.totalScore, 12);
    assert.strictEqual(cutOffBelowRes.band, "Poor Well-Being");

    // 3c. Clinical Cut-off: Score 13 (>= 13 reflects adequate well-being)
    const cutOffAboveAnswers = { who5_q1: 3, who5_q2: 3, who5_q3: 3, who5_q4: 2, who5_q5: 2 };
    const cutOffAboveRes = scoreAssessment("who5", cutOffAboveAnswers);
    assert.strictEqual(cutOffAboveRes.isValid, true);
    assert.strictEqual(cutOffAboveRes.totalScore, 13);
    assert.strictEqual(cutOffAboveRes.band, "Adequate Well-Being");

    // 3d. Maximum score (5 on all 5 items) -> Raw 25, 100%
    const maxAnswers = { who5_q1: 5, who5_q2: 5, who5_q3: 5, who5_q4: 5, who5_q5: 5 };
    const maxRes = scoreAssessment("who5", maxAnswers);
    assert.strictEqual(maxRes.isValid, true);
    assert.strictEqual(maxRes.totalScore, 25);
    assert.strictEqual(maxRes.band, "Optimal Well-Being");
  });

  await t.test("4. Missing-answer policy: Rejects incomplete, skipped, or missing answers", () => {
    // Only 4 of 5 items provided
    const incomplete = { who5_q1: 3, who5_q2: 3, who5_q3: 2, who5_q4: 2 };
    const resIncomplete = scoreAssessment("who5", incomplete);
    assert.strictEqual(resIncomplete.isValid, false);
    assert.match(resIncomplete.error, /incomplete|missing/i);

    // Empty answer provided
    const emptyItem = { who5_q1: 3, who5_q2: 3, who5_q3: null, who5_q4: 2, who5_q5: 2 };
    const resEmpty = scoreAssessment("who5", emptyItem);
    assert.strictEqual(resEmpty.isValid, false);
    assert.match(resEmpty.error, /unanswered/i);
  });

  await t.test("5. Input validation: Rejects out-of-range (>5, <0), booleans, and non-integers", () => {
    // Out-of-range value 6 (allowed are 0 to 5)
    const oobAnswers = { who5_q1: 6, who5_q2: 3, who5_q3: 2, who5_q4: 2, who5_q5: 2 };
    const resOob = scoreAssessment("who5", oobAnswers);
    assert.strictEqual(resOob.isValid, false);
    assert.match(resOob.error, /out of allowed range/i);

    // Negative value -1
    const negAnswers = { who5_q1: -1, who5_q2: 3, who5_q3: 2, who5_q4: 2, who5_q5: 2 };
    const resNeg = scoreAssessment("who5", negAnswers);
    assert.strictEqual(resNeg.isValid, false);
    assert.match(resNeg.error, /out of allowed range/i);

    // Decimal float
    const floatAnswers = { who5_q1: 2.5, who5_q2: 3, who5_q3: 2, who5_q4: 2, who5_q5: 2 };
    const resFloat = scoreAssessment("who5", floatAnswers);
    assert.strictEqual(resFloat.isValid, false);
    assert.match(resFloat.error, /non-integer/i);
  });
});

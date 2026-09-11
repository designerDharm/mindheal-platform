import test from "node:test";
import assert from "node:assert";
import { ASSESSMENT_REGISTRY, scoreAssessment, FUNCTIONAL_IMPACT_OPTIONS, INTAKE_CONTEXT_SCHEMA } from "../src/data/assessment-registry.js";
import { createAssessmentState, AssessmentController } from "../src/features/assessment-flow.js";
import { escapeHtml } from "../src/utils/dom.js";

test("Prompt 6: Functional impact and optional intake context", async (t) => {
  await t.test("1. Registry includes approved unscored functional-impact question on PHQ-9 and GAD-7", () => {
    const phq = ASSESSMENT_REGISTRY.phq9;
    const gad = ASSESSMENT_REGISTRY.gad7;

    assert.ok(phq.functionalImpact, "PHQ-9 must have functionalImpact definition");
    assert.strictEqual(phq.functionalImpact.isUnscored, true, "PHQ-9 functional impact must be marked unscored");
    assert.match(
      phq.functionalImpact.text,
      /how difficult have these problems made it for you to do your work/i,
      "PHQ-9 functional impact text must match canonical PHQ question"
    );
    assert.strictEqual(phq.functionalImpact.options.length, 4, "Must have 4 standard response options");

    assert.ok(gad.functionalImpact, "GAD-7 must have functionalImpact definition");
    assert.strictEqual(gad.functionalImpact.isUnscored, true, "GAD-7 functional impact must be marked unscored");
    assert.strictEqual(FUNCTIONAL_IMPACT_OPTIONS.length, 4);
    assert.strictEqual(FUNCTIONAL_IMPACT_OPTIONS[0].value, 0);
    assert.strictEqual(FUNCTIONAL_IMPACT_OPTIONS[3].value, 3);
  });

  await t.test("2. Changing functional impact or context NEVER modifies deterministic instrument score", () => {
    // Base PHQ-9 answers summing to 9 (mild depression)
    const baseAnswers = {
      phq9_q1: 1,
      phq9_q2: 1,
      phq9_q3: 1,
      phq9_q4: 1,
      phq9_q5: 1,
      phq9_q6: 1,
      phq9_q7: 1,
      phq9_q8: 1,
      phq9_q9: 1
    };

    const baseResult = scoreAssessment("phq9", baseAnswers);
    assert.strictEqual(baseResult.isValid, true);
    assert.strictEqual(baseResult.totalScore, 9);
    assert.strictEqual(baseResult.severity, "mild");

    // Add functional impact = 0
    const resWithImpact0 = scoreAssessment("phq9", {
      ...baseAnswers,
      functionalImpact: 0
    });
    assert.strictEqual(resWithImpact0.totalScore, 9, "Score must remain 9 with functionalImpact = 0");
    assert.strictEqual(resWithImpact0.functionalImpact.value, 0);

    // Add functional impact = 3 (extremely difficult)
    const resWithImpact3 = scoreAssessment("phq9", {
      ...baseAnswers,
      functionalImpact: 3
    });
    assert.strictEqual(resWithImpact3.totalScore, 9, "Score must remain 9 with functionalImpact = 3");
    assert.strictEqual(resWithImpact3.functionalImpact.value, 3);

    // Add full intake context
    const resWithContext = scoreAssessment("phq9", {
      ...baseAnswers,
      functionalImpact: 2,
      intakeContext: {
        onsetDuration: "more_than_1_year",
        dailyDifficulties: ["work_study", "routine_sleep"],
        healthChanges: "Started new medication 2 months ago",
        previousSupport: "past_therapy",
        personalGoals: "Develop healthy sleep hygiene"
      }
    });

    assert.strictEqual(resWithContext.totalScore, 9, "Score must remain exactly 9 regardless of intake context");
    assert.strictEqual(resWithContext.severity, "mild");
    assert.strictEqual(resWithContext.functionalImpact.value, 2);
    assert.strictEqual(resWithContext.intakeContext.onsetDuration, "more_than_1_year");
    assert.strictEqual(resWithContext.intakeContext.personalGoals, "Develop healthy sleep hygiene");
  });

  await t.test("3. Total omission of context and functional impact never blocks scoring or results", () => {
    // Completely omitting functionalImpact and intakeContext
    const gadAnswers = {
      gad7_q1: 2,
      gad7_q2: 2,
      gad7_q3: 2,
      gad7_q4: 2,
      gad7_q5: 2,
      gad7_q6: 2,
      gad7_q7: 2
    };

    const result = scoreAssessment("gad7", gadAnswers);
    assert.strictEqual(result.isValid, true, "Omission of optional context must be valid");
    assert.strictEqual(result.totalScore, 14);
    assert.strictEqual(result.severity, "moderate");
    assert.strictEqual(result.functionalImpact, null, "Functional impact should be null when omitted");
    assert.strictEqual(result.intakeContext, null, "Intake context should be null when omitted");
  });

  await t.test("4. AssessmentController manages functional impact and intake context without mutating answers", () => {
    const controller = new AssessmentController(createAssessmentState("phq9", 0));
    controller.startTest();

    // Answer all 9 questions with 1
    for (let i = 0; i < 9; i++) {
      controller.selectOption(1, true);
    }
    assert.strictEqual(controller.state.step, "review");

    // Set functional impact
    controller.setFunctionalImpact(2);
    assert.strictEqual(controller.state.functionalImpact, 2);

    // Update intake context
    controller.updateIntakeContext("onsetDuration", "1_to_6_months");
    controller.updateIntakeContext("dailyDifficulties", ["work_study"]);
    controller.updateIntakeContext("healthChanges", "Sleep apnea diagnosis");
    controller.updateIntakeContext("personalGoals", "Improve daily energy");

    assert.strictEqual(controller.state.intakeContext.onsetDuration, "1_to_6_months");
    assert.deepStrictEqual(controller.state.intakeContext.dailyDifficulties, ["work_study"]);

    // Submit assessment
    const subResult = controller.submitAssessment();
    assert.strictEqual(subResult.isValid, true);
    assert.strictEqual(subResult.totalScore, 9);
    assert.strictEqual(subResult.functionalImpact.value, 2);
    assert.strictEqual(subResult.intakeContext.healthChanges, "Sleep apnea diagnosis");

    // Verify clearIntakeContext
    controller.clearIntakeContext();
    assert.strictEqual(controller.state.intakeContext.healthChanges, "");
  });

  await t.test("5. Sensitive HTML/script-like input in intake context is safely escaped", () => {
    const maliciousInput = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    const escaped = escapeHtml(maliciousInput);

    assert.strictEqual(escaped.includes("<script>"), false);
    assert.strictEqual(escaped.includes("<img"), false);
    assert.strictEqual(escaped, "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  await t.test("6. INTAKE_CONTEXT_SCHEMA defines non-diagnostic self-reflection intake fields", () => {
    assert.ok(INTAKE_CONTEXT_SCHEMA.onsetDuration);
    assert.ok(INTAKE_CONTEXT_SCHEMA.dailyDifficulties);
    assert.ok(INTAKE_CONTEXT_SCHEMA.healthChanges);
    assert.ok(INTAKE_CONTEXT_SCHEMA.previousSupport);
    assert.ok(INTAKE_CONTEXT_SCHEMA.personalGoals);
    assert.strictEqual(INTAKE_CONTEXT_SCHEMA.healthChanges.maxLength, 500);
    assert.strictEqual(INTAKE_CONTEXT_SCHEMA.personalGoals.maxLength, 500);
  });
});

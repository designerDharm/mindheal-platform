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

test("Prompt 4: Questionnaire completion, answer review, back/next navigation, and debouncing", async (t) => {

  await t.test("1. AssessmentController manages state and stores responses by stable item ID", () => {
    const controller = new AssessmentController(createAssessmentState("phq9", 0));
    assert.strictEqual(controller.state.instrumentId, "phq9");
    assert.strictEqual(controller.state.step, "intro");

    controller.startTest();
    assert.strictEqual(controller.state.step, "questionnaire");
    assert.strictEqual(controller.state.currentQuestionIndex, 0);

    // Answer Q1 with 2 (More than half the days)
    const res1 = controller.selectOption(2);
    assert.strictEqual(res1, true);
    assert.strictEqual(controller.state.answers["phq9_q1"], 2);
    assert.strictEqual(controller.state.currentQuestionIndex, 1);
  });

  await t.test("2. Back and Next navigation traverses questions without losing saved answers", () => {
    const controller = new AssessmentController(createAssessmentState("gad7", 1));
    controller.startTest();

    // Answer first 3 questions (bypassing debounce for rapid test execution)
    controller.selectOption(1, true); // gad7_q1 = 1 -> moves to Q2
    controller.selectOption(2, true); // gad7_q2 = 2 -> moves to Q3
    controller.selectOption(3, true); // gad7_q3 = 3 -> moves to Q4
    assert.strictEqual(controller.state.currentQuestionIndex, 3);

    // Go Back
    controller.goBack(); // to Q3
    assert.strictEqual(controller.state.currentQuestionIndex, 2);
    assert.strictEqual(controller.state.answers["gad7_q3"], 3);

    controller.goBack(); // to Q2
    assert.strictEqual(controller.state.currentQuestionIndex, 1);
    assert.strictEqual(controller.state.answers["gad7_q2"], 2);

    // Go Next
    controller.goNext(); // to Q3
    assert.strictEqual(controller.state.currentQuestionIndex, 2);
    assert.strictEqual(controller.state.answers["gad7_q3"], 3);
  });

  await t.test("3. In-place answer editing replaces old score and recomputes correctly", () => {
    const controller = new AssessmentController(createAssessmentState("phq9", 0));
    controller.startTest();

    // Fill all 9 answers with 1 (total = 9, Mild)
    for (let i = 0; i < 9; i++) {
      controller.selectOption(1, true);
    }
    assert.strictEqual(controller.state.step, "review");

    // Edit Item 1 from 1 to 3
    const editRes = controller.editAnswer("phq9_q1", 3);
    assert.strictEqual(editRes, true);
    assert.strictEqual(controller.state.answers["phq9_q1"], 3);

    // Submit assessment
    const result = controller.submitAssessment();
    assert.strictEqual(result.isValid, true);
    // 3 + 8*1 = 11 (Moderate Depression)
    assert.strictEqual(result.totalScore, 11);
    assert.strictEqual(result.band, "Moderate Depression");
  });

  await t.test("4. Debounces rapid taps to prevent accidental skipping of questions", () => {
    const controller = new AssessmentController(createAssessmentState("phq9", 0));
    controller.startTest();

    // First tap succeeds
    const tap1 = controller.selectOption(1);
    assert.strictEqual(tap1, true);

    // Immediate second tap within 200ms must be rejected
    const tap2 = controller.selectOption(2);
    assert.strictEqual(tap2, false);
  });

  await t.test("5. Prevents duplicate submissions while in flight", () => {
    const controller = new AssessmentController(createAssessmentState("gad7", 1));
    controller.startTest();
    for (let i = 0; i < 7; i++) {
      controller.state.answers[`gad7_q${i+1}`] = 2;
    }
    controller.state.step = "review";

    // First submission
    controller.state.isSubmitting = true;
    const dupRes = controller.submitAssessment();
    assert.strictEqual(dupRes, false);
  });

  await t.test("6. UI code in main.js implements Review screen, Back button, and debounced handlers", () => {
    const mainJsContent = fs.readFileSync(mainJsPath, "utf8");

    assert.match(mainJsContent, /window\.handleTestBack\s*=/, "main.js must define handleTestBack");
    assert.match(mainJsContent, /window\.handleTestNext\s*=/, "main.js must define handleTestNext");
    assert.match(mainJsContent, /window\.handleEditTestQuestion\s*=/, "main.js must define handleEditTestQuestion");
    assert.match(mainJsContent, /window\.handleTestSubmit\s*=/, "main.js must define handleTestSubmit");
    assert.match(mainJsContent, /Review Your Answers/, "main.js must include review screen header");
  });
});

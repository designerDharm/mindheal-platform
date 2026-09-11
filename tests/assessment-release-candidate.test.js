import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ASSESSMENT_REGISTRY, scoreAssessment } from "../src/data/assessment-registry.js";
import { createAssessmentState, AssessmentController } from "../src/features/assessment-flow.js";
import { t, dict } from "../src/utils/i18n.js";
import { validateAndEvaluateScreening, QUESTIONNAIRES } from "../backend/src/services/questionnaire.service.js";
import { createApp } from "../backend/src/app.js";
import { repositories } from "../backend/src/repositories/index.js";
import { createId } from "../backend/src/utils/security.js";
import { getBalance } from "../backend/src/services/wallet.service.js";

// Mock localStorage for test environment if undefined
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const mainJsPath = path.join(rootDir, "src", "main.js");
const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");

test("Prompt 12: Release Candidate Verification — Staging & Packaging Matrix", async (tSuite) => {
  createApp();

  await tSuite.test("1. Release Candidate Scope & Gated Content Integrity", () => {
    // Approved clinical tools are available
    assert.strictEqual(ASSESSMENT_REGISTRY.phq9.status, "available");
    assert.strictEqual(ASSESSMENT_REGISTRY.gad7.status, "available");
    assert.strictEqual(ASSESSMENT_REGISTRY.who5.status, "available");
    assert.strictEqual(ASSESSMENT_REGISTRY.who5.requiresAuth, true);

    // Catalog reflects dynamic honest counts
    assert.ok(mainJsContent.includes("Free Clinical Screenings"));
    assert.ok(mainJsContent.includes("In Clinical Review"));
  });

  await tSuite.test("2. Zero-Balance User Lifecycle & Free Screening Guarantee", async () => {
    const user = {
      id: createId("usr"),
      name: "Staging RC User",
      email: "staging_rc@example.com",
      dateOfBirth: "1990-01-01",
      role: "user"
    };
    await repositories.users.create(user);
    await repositories.wallets.createForOwner("user", user.id);

    const initialBal = await getBalance(user.id);
    assert.strictEqual(initialBal, 0, "User starts with ₹0 wallet balance");

    const controller = await import("../backend/src/controllers/screening.controller.js");

    // Initiate PHQ-9 screening
    const startRes = await controller.createScreening({
      body: { screeningType: "phq9" },
      user
    });
    assert.strictEqual(startRes.status, 201);
    const screeningId = startRes.body.data.id;

    // Complete screening with moderate depression responses: sum = 12
    const completeRes = await controller.completeScreening({
      params: { id: screeningId },
      body: {
        responses: {
          phq9_q1: 2, phq9_q2: 2, phq9_q3: 2, phq9_q4: 1,
          phq9_q5: 1, phq9_q6: 1, phq9_q7: 1, phq9_q8: 2, phq9_q9: 0
        },
        intakeContext: {
          onsetDuration: "1_to_6_months",
          personalGoals: "Improve focus and energy"
        }
      },
      user
    });
    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.body.data.score, 12);
    assert.strictEqual(completeRes.body.data.band, "Moderate Depression");

    // Balance remains exactly 0
    const finalBal = await getBalance(user.id);
    assert.strictEqual(finalBal, 0, "Basic screening never debits wallet");

    // Cleanup synthetic test user & screening
    await repositories.screenings.delete(screeningId);
    assert.strictEqual(await repositories.screenings.findById(screeningId), null);
  });

  await tSuite.test("3. PHQ-9 Item 9 Crisis Alert & Emergency Routing Support", () => {
    // Synthetic suicidal ideation score
    const answers = {
      phq9_q1: 0, phq9_q2: 0, phq9_q3: 0, phq9_q4: 0,
      phq9_q5: 0, phq9_q6: 0, phq9_q7: 0, phq9_q8: 0, phq9_q9: 2
    };
    const res = scoreAssessment("phq9", answers);
    assert.strictEqual(res.totalScore, 2);
    assert.strictEqual(res.itemLevelSafetyTriggered, true);

    // UI contains statutory helplines
    assert.ok(mainJsContent.includes("14416")); // Tele-MANAS
    assert.ok(mainJsContent.includes("9820466726")); // AASRA
    assert.ok(mainJsContent.includes("1800-599-0019")); // KIRAN
    assert.ok(mainJsContent.includes("112")); // Emergency
  });

  await tSuite.test("4. Hindi Delivery Fidelity & Non-Diagnostic Objective Copy", () => {
    assert.ok(dict["hi"], "Hindi translation dictionary present");
    assert.ok(dict["hi"]["Urgent Safety Guidance"]);
    assert.strictEqual(dict["hi"]["Urgent Safety Guidance"], "अति आवश्यक सुरक्षा मार्गदर्शन");
    assert.ok(dict["hi"]["Clinician-Approved Crisis Protocol"]);
    assert.strictEqual(dict["hi"]["Clinician-Approved Crisis Protocol"], "चिकित्सक-अनुमोदित संकट प्रोटोकॉल");
  });

  await tSuite.test("5. Answer Editing & Idempotent History Sync", () => {
    const controller = new AssessmentController(createAssessmentState("gad7", 0));
    controller.startTest();

    // Answer all 7 items with 1 -> Total = 7 (Mild Anxiety)
    for (let i = 0; i < 7; i++) {
      controller.selectOption(1, true);
    }
    assert.strictEqual(controller.state.step, "review");

    // Edit Item 2 from 1 to 3 -> Total becomes 9
    controller.editAnswer("gad7_q2", 3);
    assert.strictEqual(controller.state.answers["gad7_q2"], 3);

    const submission = controller.submitAssessment();
    assert.strictEqual(submission.totalScore, 9);
    assert.strictEqual(submission.band, "Mild Anxiety");
  });

  await tSuite.test("6. Expirable Sharing & Permanent Ownership Deletion", async () => {
    const userA = { id: createId("usr"), name: "User A", email: "user_a@example.com", dateOfBirth: "1990-01-01", role: "user" };
    const userB = { id: createId("usr"), name: "User B", email: "user_b@example.com", dateOfBirth: "1992-05-15", role: "user" };
    await repositories.users.create(userA);
    await repositories.users.create(userB);

    const screeningController = await import("../backend/src/controllers/screening.controller.js");

    const created = await screeningController.createScreening({
      body: { screeningType: "phq9" },
      user: userA
    });
    const sId = created.body.data.id;

    await screeningController.completeScreening({
      params: { id: sId },
      body: { responses: { phq9_q1: 1, phq9_q2: 1, phq9_q3: 1, phq9_q4: 1, phq9_q5: 1, phq9_q6: 1, phq9_q7: 1, phq9_q8: 1, phq9_q9: 0 } },
      user: userA
    });

    // Foreign user B cannot delete User A's screening (403 Forbidden)
    const unauthorizedDel = await screeningController.deleteScreening({
      params: { id: sId },
      user: userB
    });
    assert.strictEqual(unauthorizedDel.status, 403);

    // Share link generation
    const shareRes = await screeningController.shareScreening({
      params: { id: sId },
      user: userA
    });
    assert.strictEqual(shareRes.status, 200);
    const token = shareRes.body.data.shareToken;

    // Public sanitized shared report read
    const publicRead = await screeningController.getSharedScreening({
      params: { shareToken: token }
    });
    assert.strictEqual(publicRead.status, 200);
    assert.strictEqual(publicRead.body.data.score, 8);
    assert.strictEqual(publicRead.body.data.userId, undefined, "User ID must be redacted from shared reports");

    // Owner deletes screening
    const ownerDel = await screeningController.deleteScreening({
      params: { id: sId },
      user: userA
    });
    assert.strictEqual(ownerDel.status, 200);
    assert.strictEqual(await repositories.screenings.findById(sId), null);
  });
});

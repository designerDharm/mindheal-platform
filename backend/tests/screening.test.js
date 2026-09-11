import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { createId } from "../src/utils/security.js";
import { getBalance } from "../src/services/wallet.service.js";

process.env.REPOSITORY_DRIVER = "memory";

test("Diagnostic Screening End-to-End Flow (MH-37: Free Basic Screenings & Optional Paid Interpretation)", async (t) => {
  const app = createApp();

  const user = {
    id: createId("usr"),
    name: "Screening Tester",
    email: "screening@example.com",
    dateOfBirth: "1995-05-10",
    role: "user"
  };

  await repositories.users.create(user);
  await repositories.wallets.createForOwner("user", user.id);

  let sessionID;

  await t.test("1. Zero-balance user creates basic screening for FREE without debit", async () => {
    // Current wallet balance is strictly 0
    const balanceBefore = await getBalance(user.id);
    assert.strictEqual(balanceBefore, 0);

    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.createScreening({
      body: { screeningType: "anxiety" },
      user
    });

    assert.strictEqual(res.status, 201, "Screening creation must succeed for zero-balance users");
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.screeningType, "anxiety");
    assert.strictEqual(res.body.data.status, "started");

    sessionID = res.body.data.id;

    // Verify wallet was NOT debited — balance remains 0
    const balanceAfter = await getBalance(user.id);
    assert.strictEqual(balanceAfter, 0, "Basic screening must not debit wallet");
  });

  await t.test("2. Zero-balance user completes screening with deterministic scoring & safety guidance", async () => {
    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.completeScreening({
      params: { id: sessionID },
      body: {
        // Server calculates score from answers: 3 + 2 + 3 + 1 + 2 + 1 = 12
        responses: { q1: 3, q2: 2, q3: 3, q4: 1, q5: 2, q6: 1 }
      },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, "completed");
    assert.strictEqual(res.body.data.score, 12);
    assert.strictEqual(res.body.data.band, "Moderate");
    assert.strictEqual(res.body.data.hasPaidInterpretation, false);

    // Verify deterministic safety guidance is returned
    assert.ok(res.body.data.safetyGuidance, "Safety guidance must be provided");
    assert.match(res.body.data.safetyGuidance.disclaimer, /educational screening tool/i);
    assert.ok(res.body.data.safetyGuidance.helplines.length >= 2);
    const teleManas = res.body.data.safetyGuidance.helplines.find(h => h.name.includes("Tele-MANAS"));
    assert.ok(teleManas, "Must include Tele-MANAS helpline");
    assert.match(teleManas.number, /14416/);

    // Verify balance remains 0
    const balanceAfter = await getBalance(user.id);
    assert.strictEqual(balanceAfter, 0, "Completing screening must not debit wallet");
  });

  await t.test("3. Zero-balance user reads the completed screening result without a debit", async () => {
    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.getScreening({
      params: { id: sessionID },
      user
    });

    assert.strictEqual(res.status, 200, "Reading screening result must succeed");
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, sessionID);
    assert.strictEqual(res.body.data.status, "completed");
    assert.strictEqual(res.body.data.score, 12);
    assert.strictEqual(res.body.data.band, "Moderate");
    assert.strictEqual(res.body.data.hasPaidInterpretation, false);
    assert.ok(res.body.data.safetyGuidance, "Safety guidance must be present when reading result");
    assert.ok(res.body.data.safetyGuidance.helplines.some(h => h.number.includes("14416")));

    // An unrelated user cannot read this screening
    const otherUser = { id: createId("usr"), role: "user" };
    const forbiddenRes = await controller.getScreening({
      params: { id: sessionID },
      user: otherUser
    });
    assert.strictEqual(forbiddenRes.status, 403, "Unrelated user must be forbidden from reading another's screening");

    // Verify wallet balance is still strictly 0
    const balance = await getBalance(user.id);
    assert.strictEqual(balance, 0, "Reading screening result must not debit wallet");
  });

  await t.test("4. Optional paid interpretation fails when user has insufficient balance", async () => {
    const balance = await getBalance(user.id);
    assert.strictEqual(balance, 0);

    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.requestInterpretation({
      params: { id: sessionID },
      body: { consentToAiInterpretation: true },
      user
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error.message, /insufficient wallet balance/i);

    // Balance remains 0
    assert.strictEqual(await getBalance(user.id), 0);
  });

  await t.test("5. User can purchase optional in-depth clinical interpretation report after top-up", async () => {
    const wallet = await repositories.wallets.findByOwner(user.id);
    // Top up 100 INR = 10,000 paise
    await repositories.wallets.createLedgerEntry({
      id: createId("led"),
      walletId: wallet.id,
      direction: "credit",
      amountPaise: 10000,
      entryType: "wallet_topup",
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(await getBalance(user.id), 10000);

    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.requestInterpretation({
      params: { id: sessionID },
      body: { consentToAiInterpretation: true },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.hasPaidInterpretation, true);
    assert.ok(res.body.data.interpretation.length > 50, "Narrative interpretation must be populated");
    assert.match(res.body.data.interpretation, /Comprehensive Clinical Narrative/);

    // Balance debited by 49 INR = 4,900 paise. 10,000 - 4,900 = 5,100 paise
    const balanceAfter = await getBalance(user.id);
    assert.strictEqual(balanceAfter, 5100);

    // Repeated call is idempotent and does not double-debit
    const repeatRes = await controller.requestInterpretation({
      params: { id: sessionID },
      body: { consentToAiInterpretation: true },
      user
    });
    assert.strictEqual(repeatRes.status, 200);
    assert.strictEqual(await getBalance(user.id), 5100, "Idempotent interpretation request must not double-debit");
  });

  await t.test("6. List my screenings returns completed screening", async () => {
    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.listMyScreenings({ user });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].id, sessionID);
    assert.strictEqual(res.body.data[0].status, "completed");
  });
});

test("Backend Screening Scoring & Input Validation (MH-36: Versioned Definitions, Completeness, Value Checks & Fabricated Score Rejection)", async (t) => {
  const controller = await import("../src/controllers/screening.controller.js");
  const user = {
    id: createId("usr"),
    name: "Scoring Tester",
    email: "scoring_test@example.com",
    dateOfBirth: "1992-03-20",
    role: "user"
  };
  await repositories.users.create(user);
  await repositories.wallets.createForOwner("user", user.id);

  await t.test("1. Versioned questionnaire definitions are stored and exposed", async () => {
    const res = await controller.listQuestionnaires();
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.low_mood, "Must have low_mood definition");
    assert.ok(res.body.data.anxiety, "Must have anxiety definition");
    assert.ok(res.body.data.burnout, "Must have burnout definition");
    assert.ok(res.body.data.counsellor_match, "Must have counsellor_match definition");

    assert.strictEqual(res.body.data.low_mood.version, "1.0.0");
    assert.deepStrictEqual(res.body.data.low_mood.allowedValues, [0, 1, 2, 3]);
    assert.strictEqual(res.body.data.low_mood.questions.length, 6);
  });

  await t.test("2. Rejects empty answers ([] and {}) with 400 Bad Request", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "low_mood" },
      user
    });
    const scrId = initRes.body.data.id;

    // Test with empty array
    const emptyArrayRes = await controller.completeScreening({
      params: { id: scrId },
      body: { answers: [] },
      user
    });
    assert.strictEqual(emptyArrayRes.status, 400);
    assert.match(emptyArrayRes.body.error.message, /empty answers/i);

    // Test with empty object
    const emptyObjRes = await controller.completeScreening({
      params: { id: scrId },
      body: { responses: {} },
      user
    });
    assert.strictEqual(emptyObjRes.status, 400);
    assert.match(emptyObjRes.body.error.message, /empty answers/i);
  });

  await t.test("3. Rejects incomplete answers (fewer than required questions) with 400 Bad Request", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "low_mood" },
      user
    });
    const scrId = initRes.body.data.id;

    // Only 2 of 6 questions answered
    const res = await controller.completeScreening({
      params: { id: scrId },
      body: { responses: { q1: 1, q2: 2 } },
      user
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /incomplete answers/i);
  });

  await t.test("4. Rejects invalid answer values (negative, out of bounds, non-integer) with 400 Bad Request", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "low_mood" },
      user
    });
    const scrId = initRes.body.data.id;

    // Value -1 (negative)
    const negRes = await controller.completeScreening({
      params: { id: scrId },
      body: { responses: { q1: -1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1 } },
      user
    });
    assert.strictEqual(negRes.status, 400);
    assert.match(negRes.body.error.message, /invalid answer value/i);

    // Value 4 (allowed are 0, 1, 2, 3)
    const oobRes = await controller.completeScreening({
      params: { id: scrId },
      body: { responses: { q1: 4, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1 } },
      user
    });
    assert.strictEqual(oobRes.status, 400);
    assert.match(oobRes.body.error.message, /invalid answer value/i);

    // Value "invalid" (non-numeric)
    const textRes = await controller.completeScreening({
      params: { id: scrId },
      body: { responses: { q1: "not_a_number", q2: 1, q3: 1, q4: 1, q5: 1, q6: 1 } },
      user
    });
    assert.strictEqual(textRes.status, 400);
    assert.match(textRes.body.error.message, /invalid answer value/i);
  });

  await t.test("5. Rejects fabricated client score (e.g. -999) with 400 Bad Request", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "low_mood" },
      user
    });
    const scrId = initRes.body.data.id;

    // Fabricated score with empty answers: { score: -999, answers: [] }
    const res1 = await controller.completeScreening({
      params: { id: scrId },
      body: { score: -999, answers: [] },
      user
    });
    assert.strictEqual(res1.status, 400);
    assert.match(res1.body.error.message, /fabricated|invalid score/i);

    // Fabricated score with answers present: score: -999
    const res2 = await controller.completeScreening({
      params: { id: scrId },
      body: {
        score: -999,
        responses: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1 }
      },
      user
    });
    assert.strictEqual(res2.status, 400);
    assert.match(res2.body.error.message, /fabricated|invalid score/i);

    // Fabricated mismatch score: actual score is 6, client claims 18
    const res3 = await controller.completeScreening({
      params: { id: scrId },
      body: {
        score: 18,
        responses: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1 }
      },
      user
    });
    assert.strictEqual(res3.status, 400);
    assert.match(res3.body.error.message, /client score mismatch/i);
  });

  await t.test("6. Strictly calculates result from answers on the backend without trusting client score", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "low_mood" },
      user
    });
    const scrId = initRes.body.data.id;

    // Submit answers without any score field — server calculates 1+2+3+0+1+2 = 9
    const res = await controller.completeScreening({
      params: { id: scrId },
      body: {
        responses: { q1: 1, q2: 2, q3: 3, q4: 0, q5: 1, q6: 2 }
      },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.score, 9);
    assert.strictEqual(res.body.data.band, "Mild");
    assert.strictEqual(res.body.data.severity, "low");
    assert.ok(res.body.data.description.includes("score is 9 out of 18"));

    // Verify stored record has questionnaireVersion and calculated score
    const stored = await repositories.screenings.findById(scrId);
    assert.strictEqual(stored.score, 9);
    assert.strictEqual(stored.responsesJson.questionnaireVersion, "1.0.0");
    assert.strictEqual(stored.responsesJson.score, 9);
  });

  await t.test("7. Accepts array format answers and calculates score correctly", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "burnout" },
      user
    });
    const scrId = initRes.body.data.id;

    // Burnout has 4 questions: [2, 3, 2, 3] -> sum = 10 (Severe Exhaustion)
    const res = await controller.completeScreening({
      params: { id: scrId },
      body: {
        answers: [2, 3, 2, 3]
      },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.score, 10);
    assert.strictEqual(res.body.data.band, "Severe Exhaustion");
    assert.strictEqual(res.body.data.severity, "severe");
  });

  await t.test("8. Synthetic positive PHQ-9 Item 9 triggers crisis guidance even when total score is low (MH-16)", async () => {
    const initRes = await controller.createScreening({
      body: { screeningType: "phq9" },
      user
    });
    const scrId = initRes.body.data.id;

    // Synthetic positive Item 9: Q1..Q8 = 0, Q9 = 1 (Total score = 1, "Minimal Depression")
    const res = await controller.completeScreening({
      params: { id: scrId },
      body: {
        answers: [0, 0, 0, 0, 0, 0, 0, 0, 1]
      },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.score, 1);
    assert.strictEqual(res.body.data.band, "Minimal Depression");
    assert.strictEqual(res.body.data.severity, "critical", "Severity must escalate to critical due to positive Item 9");
    assert.strictEqual(res.body.data.safetyGuidance.hasItemLevelCrisisAlert, true);
    assert.match(res.body.data.safetyGuidance.recommendedAction, /thoughts of being better off dead or hurting yourself/i);
    assert.ok(res.body.data.safetyGuidance.helplines.some(h => h.number.includes("14416")));
    assert.ok(res.body.data.safetyGuidance.helplines.some(h => h.number.includes("9820466726")));
  });
});

test("Transactional Screening Interpretation & Failure Compensation (MH-38: Zero Completed Charges Surviving Failures)", async (t) => {
  const controller = await import("../src/controllers/screening.controller.js");
  const user = {
    id: createId("usr"),
    name: "Transaction Failure Tester",
    email: "tx_test@example.com",
    role: "user"
  };

  await repositories.users.create(user);
  await repositories.wallets.createForOwner("user", user.id);

  // Seed user wallet with exactly 10,000 paise (₹100)
  const wallet = await repositories.wallets.findByOwner(user.id);
  await repositories.wallets.createLedgerEntry({
    id: createId("led"),
    walletId: wallet.id,
    direction: "credit",
    amountPaise: 10000,
    entryType: "wallet_topup",
    createdAt: new Date().toISOString()
  });

  // Verify initial balance
  assert.strictEqual(await getBalance(user.id), 10000);

  // Create and complete a baseline screening
  const createRes = await controller.createScreening({
    body: { screeningType: "anxiety" },
    user
  });
  const screeningId = createRes.body.data.id;

  const completeRes = await controller.completeScreening({
    params: { id: screeningId },
    body: {
      answers: [2, 2, 2, 2, 2, 2]
    },
    user
  });
  assert.strictEqual(completeRes.status, 200);
  assert.strictEqual(await getBalance(user.id), 10000, "Basic screening must remain free with zero debit");

  await t.test("1. Failure injected AFTER RESERVATION compensates hold and leaves 0 completed charge", async () => {
    // Inject failure right after wallet reservation
    controller.screeningInterpretationHooks.afterReservation = async () => {
      throw new Error("Simulated network timeout immediately after reservation hold");
    };

    try {
      const res = await controller.requestInterpretation({
        params: { id: screeningId },
        body: { consentToAiInterpretation: true },
        user
      });

      assert.strictEqual(res.status, 400, "Request must return 400 when operation fails");
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.fields.compensated, true, "Must flag hold as compensated");
      assert.match(res.body.error.message, /network timeout/i);

      // Verify balance is completely restored to 10,000 paise
      const balanceAfter = await getBalance(user.id);
      assert.strictEqual(balanceAfter, 10000, "User wallet balance must remain exactly 10000 paise (no completed charge)");

      // Verify ledger has matching hold and refund entries
      const entries = await repositories.wallets.ledgerEntries(wallet.id);
      const holdEntries = entries.filter(e => e.entryType === "screening_interpretation_hold" && e.direction === "debit");
      const refundEntries = entries.filter(e => e.entryType === "screening_interpretation_hold_refund" && e.direction === "credit");
      assert.strictEqual(holdEntries.length, 1, "Must have recorded 1 reservation hold");
      assert.strictEqual(refundEntries.length, 1, "Must have recorded 1 compensation refund");
      assert.strictEqual(holdEntries[0].amountPaise, 4900);
      assert.strictEqual(refundEntries[0].amountPaise, 4900);

      // Verify screening in repository was NOT updated with paid interpretation
      const scr = await repositories.screenings.findById(screeningId);
      assert.strictEqual(scr.responsesJson.hasPaidInterpretation, false);
      assert.strictEqual(scr.responsesJson.interpretation, null);
    } finally {
      controller.screeningInterpretationHooks.afterReservation = null;
    }
  });

  await t.test("2. Failure injected DURING RESULT CREATION compensates hold and leaves 0 completed charge", async () => {
    // Inject failure during narrative synthesis
    controller.screeningInterpretationHooks.generateClinicalNarrative = async () => {
      throw new Error("Simulated AI narrative generation engine unavailable");
    };

    try {
      const res = await controller.requestInterpretation({
        params: { id: screeningId },
        body: { consentToAiInterpretation: true },
        user
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.fields.compensated, true);
      assert.match(res.body.error.message, /AI narrative generation engine unavailable/i);

      // Verify balance is completely restored to 10,000 paise
      const balanceAfter = await getBalance(user.id);
      assert.strictEqual(balanceAfter, 10000, "Wallet balance must remain 10000 paise after result creation failure");

      // Verify screening state unchanged
      const scr = await repositories.screenings.findById(screeningId);
      assert.strictEqual(scr.responsesJson.hasPaidInterpretation, false);
      assert.strictEqual(scr.responsesJson.interpretation, null);
    } finally {
      controller.screeningInterpretationHooks.generateClinicalNarrative = null;
    }
  });

  await t.test("3. Failure injected DURING PERSISTENCE compensates hold and leaves 0 completed charge", async () => {
    const originalUpdate = repositories.screenings.update;
    // Inject persistence failure when attempting to save the interpretation
    repositories.screenings.update = async (id, patch) => {
      if (patch.responsesJson?.hasPaidInterpretation) {
        throw new Error("Simulated database write deadlock during screening update");
      }
      return originalUpdate.call(repositories.screenings, id, patch);
    };

    try {
      const res = await controller.requestInterpretation({
        params: { id: screeningId },
        body: { consentToAiInterpretation: true },
        user
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.fields.compensated, true);
      assert.match(res.body.error.message, /database write deadlock/i);

      // Verify balance is completely restored to 10,000 paise
      const balanceAfter = await getBalance(user.id);
      assert.strictEqual(balanceAfter, 10000, "Wallet balance must remain 10000 paise after persistence failure");

      // Verify screening record in repository
      const scr = await repositories.screenings.findById(screeningId);
      assert.strictEqual(scr.responsesJson.hasPaidInterpretation, false);
    } finally {
      repositories.screenings.update = originalUpdate;
    }
  });

  await t.test("4. Normal flow after transient failures completes settlement with exactly one charge", async () => {
    // Now request interpretation with all systems operational
    const res = await controller.requestInterpretation({
      params: { id: screeningId },
      body: { consentToAiInterpretation: true },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.hasPaidInterpretation, true);
    assert.ok(res.body.data.interpretation.length > 50);

    // Balance debited by exactly ₹49 = 4,900 paise. 10,000 - 4,900 = 5,100 paise
    const balanceAfter = await getBalance(user.id);
    assert.strictEqual(balanceAfter, 5100, "Wallet must be charged exactly once after clean execution");

    // Double-entry journal transaction must exist
    const journals = await repositories.journalTransactions.list();
    const interpJournal = journals.find(j => j.journalType === "SCREENING_INTERPRETATION_PURCHASE" && j.businessReferenceId === screeningId);
    assert.ok(interpJournal, "Completed settlement must post journal transaction");
    assert.strictEqual(interpJournal.entries.length, 2);

    // Idempotent repeat call does not charge again
    const repeatRes = await controller.requestInterpretation({
      params: { id: screeningId },
      body: { consentToAiInterpretation: true },
      user
    });
    assert.strictEqual(repeatRes.status, 200);
    assert.strictEqual(repeatRes.body.data.alreadyPurchased, true);
    assert.strictEqual(await getBalance(user.id), 5100, "Repeat request must not debit again");
  });
});



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

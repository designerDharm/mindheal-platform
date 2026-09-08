import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { createId } from "../src/utils/security.js";
import { getBalance } from "../src/services/wallet.service.js";

process.env.REPOSITORY_DRIVER = "memory";

test("Diagnostic Screening End-to-End Flow", async (t) => {
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

  await t.test("1. Create screening fails with insufficient balance", async () => {
    // Current wallet balance is 0, so GAD-7 (Anxiety) which costs 3 credits should fail
    const balance = await getBalance(user.id);
    assert.strictEqual(balance, 0);

    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.createScreening({
      body: { screeningType: "anxiety" },
      user
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await t.test("2. Create screening succeeds after top-up", async () => {
    const wallet = await repositories.wallets.findByOwner(user.id);
    // Credit 500 paise = 5 credits
    await repositories.wallets.createLedgerEntry({
      id: createId("led"),
      walletId: wallet.id,
      direction: "credit",
      amountPaise: 500,
      entryType: "topup",
      createdAt: new Date().toISOString()
    });

    const balanceBefore = await getBalance(user.id);
    assert.strictEqual(balanceBefore, 500);

    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.createScreening({
      body: { screeningType: "anxiety" },
      user
    });
    
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.screeningType, "anxiety");
    assert.strictEqual(res.body.data.status, "started");

    sessionID = res.body.data.id;

    // Check balance is deducted: 5 credits - 3 credits = 2 credits = 200 paise
    const balanceAfter = await getBalance(user.id);
    assert.strictEqual(balanceAfter, 200);
  });

  await t.test("3. Complete screening session", async () => {
    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.completeScreening({
      params: { id: sessionID },
      body: {
        score: 12, // Moderate anxiety
        responses: { q1: 3, q2: 2, q3: 3, q4: 1, q5: 2, q6: 1 }
      },
      user
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, "completed");
    assert.strictEqual(res.body.data.score, 12);
    assert.strictEqual(res.body.data.responsesJson.q1, 3);
  });

  await t.test("4. Fetch list of screenings for user", async () => {
    const controller = await import("../src/controllers/screening.controller.js");
    const res = await controller.listMyScreenings({ user });
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].id, sessionID);
  });
});

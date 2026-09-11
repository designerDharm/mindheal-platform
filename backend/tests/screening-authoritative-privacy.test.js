import test from "node:test";
import assert from "node:assert/strict";
import { repositories } from "../src/repositories/index.js";
import { createId, hashPassword } from "../src/utils/security.js";
import * as screeningController from "../src/controllers/screening.controller.js";
import { validateAndEvaluateScreening, QUESTIONNAIRES } from "../src/services/questionnaire.service.js";

test("Prompt 8 Authoritative & Private Results Test Suite", async (t) => {
  // Setup test users
  const userA = {
    id: createId("usr"),
    name: "User Alice",
    email: `alice_${Date.now()}@example.com`,
    role: "user"
  };
  const userB = {
    id: createId("usr"),
    name: "User Bob",
    email: `bob_${Date.now()}@example.com`,
    role: "user"
  };

  await repositories.users.create({
    id: userA.id,
    name: userA.name,
    email: userA.email,
    dateOfBirth: "1994-04-12",
    passwordHash: await hashPassword("Password123!"),
    role: "user"
  });

  await repositories.users.create({
    id: userB.id,
    name: userB.name,
    email: userB.email,
    dateOfBirth: "1991-11-23",
    passwordHash: await hashPassword("Password123!"),
    role: "user"
  });

  await t.test("1. Rejects client-supplied fabricated scores differing from authoritative server computation", async () => {
    // Valid 9 answers: sum is 1+2+1+0+0+0+0+0+0 = 4
    const validAnswers = {
      q1: 1, q2: 2, q3: 1, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0
    };

    // Client falsely asserts score is 25
    const tamperedPayload = {
      score: 25,
      responses: validAnswers
    };

    const res = validateAndEvaluateScreening("phq9", tamperedPayload);
    assert.equal(res.isValid, false);
    assert.match(res.error, /Client score mismatch/i);
  });

  await t.test("2. Authoritative server computation succeeds with standard or canonical item keys and preserves versioning", async () => {
    // Canonical prefixed keys: phq9_q1..phq9_q9
    const answersWithPrefixedKeys = {
      phq9_q1: 2,
      phq9_q2: 2,
      phq9_q3: 1,
      phq9_q4: 1,
      phq9_q5: 0,
      phq9_q6: 0,
      phq9_q7: 0,
      phq9_q8: 0,
      phq9_q9: 0
    };

    const payload = {
      responses: answersWithPrefixedKeys,
      functionalImpact: 2,
      intakeContext: {
        onsetDuration: "1_to_6_months",
        dailyDifficulties: ["work_studies", "sleep"],
        healthChanges: "None",
        previousSupport: "first_time",
        personalGoals: "Feel calmer and focused"
      },
      language: "hi"
    };

    const res = validateAndEvaluateScreening("phq9", payload);
    assert.equal(res.isValid, true);
    assert.equal(res.score, 6); // 2+2+1+1 = 6 (Mild Depression)
    assert.equal(res.band, "Mild Depression");
    assert.equal(res.questionnaireVersion, "2026.1.0");
    assert.equal(res.policyVersion, "2026.1");
    assert.equal(res.functionalImpact, 2);
    assert.equal(res.intakeContext.onsetDuration, "1_to_6_months");
  });

  await t.test("3. Authenticated ownership & cross-account isolation: User B cannot access or complete User A's screening", async () => {
    // Alice creates a screening session
    const createRes = await screeningController.createScreening({
      body: { screeningType: "phq9" },
      user: userA
    });
    assert.equal(createRes.status, 201);
    const screeningId = createRes.body.data.id;

    // Bob tries to complete Alice's screening
    const bobComplete = await screeningController.completeScreening({
      params: { id: screeningId },
      body: { responses: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1, q9: 0 } },
      user: userB
    });
    assert.equal(bobComplete.status, 403);

    // Bob tries to fetch Alice's screening
    const bobGet = await screeningController.getScreening({
      params: { id: screeningId },
      user: userB
    });
    assert.equal(bobGet.status, 403);

    // Alice completes her own screening
    const aliceComplete = await screeningController.completeScreening({
      params: { id: screeningId },
      body: { responses: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1, q9: 0 } },
      user: userA
    });
    assert.equal(aliceComplete.status, 200);
    assert.equal(aliceComplete.body.data.score, 8);
  });

  await t.test("4. Duplicate submission idempotency returns existing completed record", async () => {
    const createRes = await screeningController.createScreening({
      body: { screeningType: "gad7" },
      user: userA
    });
    const screeningId = createRes.body.data.id;
    const idempotencyKey = "idem_test_" + Date.now();

    const answers = { q1: 1, q2: 2, q3: 1, q4: 0, q5: 0, q6: 0, q7: 0 }; // sum = 4

    // First completion call
    const firstCall = await screeningController.completeScreening({
      params: { id: screeningId },
      body: { responses: answers },
      headers: { "x-idempotency-key": idempotencyKey },
      user: userA
    });
    assert.equal(firstCall.status, 200);
    assert.equal(firstCall.body.data.score, 4);

    // Immediate duplicate concurrent retry with same key
    const duplicateCall = await screeningController.completeScreening({
      params: { id: screeningId },
      body: { responses: answers },
      headers: { "x-idempotency-key": idempotencyKey },
      user: userA
    });
    assert.equal(duplicateCall.status, 200);
    assert.equal(duplicateCall.body.data.score, 4);
    assert.equal(duplicateCall.body.data.isIdempotentReplay, true);
  });

  await t.test("5. Share token creation, public sanitized view, and token revocation", async () => {
    const createRes = await screeningController.createScreening({
      body: { screeningType: "phq9" },
      user: userA
    });
    const screeningId = createRes.body.data.id;

    await screeningController.completeScreening({
      params: { id: screeningId },
      body: {
        responses: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0 },
        functionalImpact: 1
      },
      user: userA
    });

    // Share screening
    const shareRes = await screeningController.shareScreening({
      params: { id: screeningId },
      user: userA
    });
    assert.equal(shareRes.status, 200);
    const { shareToken } = shareRes.body.data;
    assert.ok(shareToken);

    // Unauthenticated public access using share token
    const publicView = await screeningController.getSharedScreening({
      params: { shareToken }
    });
    assert.equal(publicView.status, 200);
    assert.equal(publicView.body.data.score, 0);
    assert.equal(publicView.body.data.isSharedReport, true);
    assert.equal(publicView.body.data.userId, undefined); // No private user details leaked!

    // Revoke share token
    const revokeRes = await screeningController.revokeShareScreening({
      params: { id: screeningId },
      user: userA
    });
    assert.equal(revokeRes.status, 200);

    // Public access should now fail (404)
    const revokedView = await screeningController.getSharedScreening({
      params: { shareToken }
    });
    assert.equal(revokedView.status, 404);
  });

  await t.test("6. Deletion permanently removes screening record from owner's account", async () => {
    const createRes = await screeningController.createScreening({
      body: { screeningType: "phq9" },
      user: userA
    });
    const screeningId = createRes.body.data.id;

    // Bob cannot delete Alice's screening
    const bobDelete = await screeningController.deleteScreening({
      params: { id: screeningId },
      user: userB
    });
    assert.equal(bobDelete.status, 403);

    // Alice deletes her own screening
    const aliceDelete = await screeningController.deleteScreening({
      params: { id: screeningId },
      user: userA
    });
    assert.equal(aliceDelete.status, 200);
    assert.equal(aliceDelete.body.data.deleted, true);

    // Fetching deleted screening returns 404
    const getRes = await screeningController.getScreening({
      params: { id: screeningId },
      user: userA
    });
    assert.equal(getRes.status, 404);
  });
});

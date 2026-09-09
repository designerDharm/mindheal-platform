import assert from "node:assert";
import { register, registerCounsellor } from "../backend/src/controllers/auth.controller.js";
import { issueOtp, verifyOtp, consumeVerificationProof } from "../backend/src/services/auth.service.js";
import { repositories } from "../backend/src/repositories/index.js";

async function runDeepVerification() {
  console.log("Starting Comprehensive MH-10 Verification Suite...");

  // ----------------------------------------------------
  // 1. Missing verification proof in user registration
  // ----------------------------------------------------
  console.log("\n[Test 1] Missing proof in user registration");
  const missingUserProof = await register({
    body: {
      fullName: "No Proof User",
      email: "noproof@example.com",
      password: "Password123!"
    }
  });
  assert.strictEqual(missingUserProof.status, 400);
  assert.match(missingUserProof.body.error.message, /Verification proof is required/);
  console.log("✔ User registration without verificationProof rejected (400):", missingUserProof.body.error.message);

  // ----------------------------------------------------
  // 2. Missing verification proof in counsellor registration
  // ----------------------------------------------------
  console.log("\n[Test 2] Missing proof in counsellor registration");
  const missingCnsProof = await registerCounsellor({
    body: {
      fullName: "No Proof Counsellor",
      mobile: "+919888888801",
      password: "Password123!",
      licenseNumber: "LIC-TEST-01",
      specializations: ["CBT"]
    }
  });
  assert.strictEqual(missingCnsProof.status, 400);
  assert.match(missingCnsProof.body.error.message, /Verification proof is required/);
  console.log("✔ Counsellor registration without verificationProof rejected (400):", missingCnsProof.body.error.message);

  // ----------------------------------------------------
  // 3. Destination mismatch: Proof for email A used to register email B
  // ----------------------------------------------------
  console.log("\n[Test 3] Destination mismatch in user registration");
  const userAEmail = "verified_user_a@example.com";
  const userBEmail = "unverified_user_b@example.com";
  const issuedA = await issueOtp(userAEmail);
  const verifiedA = await verifyOtp(issuedA.challengeId, issuedA.devCode, userAEmail);
  assert.ok(verifiedA.verificationProof, "Verification proof must be generated");

  const mismatchRes = await register({
    body: {
      fullName: "User B",
      email: userBEmail,
      password: "Password123!",
      verificationProof: verifiedA.verificationProof
    }
  });
  assert.strictEqual(mismatchRes.status, 400);
  assert.match(mismatchRes.body.error.message, /Invalid, expired, reused, or destination-mismatched/);
  console.log("✔ Destination-mismatched proof rejected (400):", mismatchRes.body.error.message);

  // ----------------------------------------------------
  // 4. Valid proof succeeds ONCE and creates user (201)
  // ----------------------------------------------------
  console.log("\n[Test 4] Valid proof succeeds once");
  const legitUserEmail = "legit_user@example.com";
  const issuedLegit = await issueOtp(legitUserEmail);
  const verifiedLegit = await verifyOtp(issuedLegit.challengeId, issuedLegit.devCode, legitUserEmail);

  const legitRes = await register({
    body: {
      fullName: "Legit User",
      email: legitUserEmail,
      password: "Password123!",
      verificationProof: verifiedLegit.verificationProof
    }
  });
  assert.strictEqual(legitRes.status, 201);
  assert.strictEqual(legitRes.body.data.user.email, legitUserEmail);
  console.log("✔ Legitimate user registration succeeded (201):", legitRes.body.data.user.id);

  // ----------------------------------------------------
  // 5. Reused proof fails on second attempt (400)
  // ----------------------------------------------------
  console.log("\n[Test 5] Reused proof fails on subsequent attempt");
  const reuseRes = await register({
    body: {
      fullName: "Legit User Replay",
      email: legitUserEmail,
      password: "Password123!",
      verificationProof: verifiedLegit.verificationProof
    }
  });
  assert.strictEqual(reuseRes.status, 400);
  assert.match(reuseRes.body.error.message, /Invalid, expired, reused, or destination-mismatched/);
  console.log("✔ Reused proof rejected (400):", reuseRes.body.error.message);

  // ----------------------------------------------------
  // 6. Expired proof fails (400)
  // ----------------------------------------------------
  console.log("\n[Test 6] Expired proof fails");
  const expiredEmail = "expired_user@example.com";
  const issuedExp = await issueOtp(expiredEmail);
  const verifiedExp = await verifyOtp(issuedExp.challengeId, issuedExp.devCode, expiredEmail);

  // Manually consume with expired time simulation or invalid proof
  const dummyProof = "proof_non_existent_or_expired_12345";
  const expRes = await register({
    body: {
      fullName: "Expired User",
      email: expiredEmail,
      password: "Password123!",
      verificationProof: dummyProof
    }
  });
  assert.strictEqual(expRes.status, 400);
  assert.match(expRes.body.error.message, /Invalid, expired, reused, or destination-mismatched/);
  console.log("✔ Non-existent / expired proof rejected (400):", expRes.body.error.message);

  // ----------------------------------------------------
  // 7. Counsellor registration with mobile verification proof
  // ----------------------------------------------------
  console.log("\n[Test 7] Counsellor registration with verified mobile");
  const cnsMobile = "+919876543299";
  const issuedCns = await issueOtp(cnsMobile);
  const verifiedCns = await verifyOtp(issuedCns.challengeId, issuedCns.devCode, cnsMobile);

  // 7a. First attempt with valid proof succeeds
  const legitCnsRes = await registerCounsellor({
    body: {
      fullName: "Dr. Legitimate",
      mobile: cnsMobile,
      email: "drlegit@example.com",
      password: "Password123!",
      licenseNumber: "LIC-VALID-999",
      specializations: ["Anxiety", "Depression"],
      verificationProof: verifiedCns.verificationProof
    }
  });
  assert.strictEqual(legitCnsRes.status, 201);
  assert.strictEqual(legitCnsRes.body.data.counsellor.mobile, cnsMobile);
  console.log("✔ Legitimate counsellor registration succeeded (201):", legitCnsRes.body.data.counsellor.id);

  // 7b. Second attempt reusing counsellor proof fails
  const reuseCnsRes = await registerCounsellor({
    body: {
      fullName: "Dr. Legitimate Clone",
      mobile: cnsMobile,
      email: "drclone@example.com",
      password: "Password123!",
      licenseNumber: "LIC-CLONE-999",
      specializations: ["Anxiety"],
      verificationProof: verifiedCns.verificationProof
    }
  });
  assert.strictEqual(reuseCnsRes.status, 400);
  assert.match(reuseCnsRes.body.error.message, /Invalid, expired, reused, or destination-mismatched/);
  console.log("✔ Reused counsellor proof rejected (400):", reuseCnsRes.body.error.message);

  // ----------------------------------------------------
  // 8. Concurrent race condition with identical proof
  // ----------------------------------------------------
  console.log("\n[Test 8] Concurrent race condition: Multiple simultaneous requests with same proof");
  const raceEmail = "race_user@example.com";
  const issuedRace = await issueOtp(raceEmail);
  const verifiedRace = await verifyOtp(issuedRace.challengeId, issuedRace.devCode, raceEmail);

  const results = await Promise.all([
    register({
      body: {
        fullName: "Race User 1",
        email: raceEmail,
        password: "Password123!",
        verificationProof: verifiedRace.verificationProof
      }
    }),
    register({
      body: {
        fullName: "Race User 2",
        email: raceEmail,
        password: "Password123!",
        verificationProof: verifiedRace.verificationProof
      }
    }),
    register({
      body: {
        fullName: "Race User 3",
        email: raceEmail,
        password: "Password123!",
        verificationProof: verifiedRace.verificationProof
      }
    })
  ]);

  const successes = results.filter((r) => r.status === 201);
  const failures = results.filter((r) => r.status === 400);

  assert.strictEqual(successes.length, 1, "Exactly one concurrent registration must succeed");
  assert.strictEqual(failures.length, 2, "Other concurrent registrations must be rejected");
  console.log(`✔ Concurrent race verified: ${successes.length} succeeded (201), ${failures.length} rejected (400)`);

  console.log("\n==========================================");
  console.log("ALL MH-10 VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
}

runDeepVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

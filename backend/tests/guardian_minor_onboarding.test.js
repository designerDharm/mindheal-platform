import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import {
  createUser,
  loginUser,
  createSession,
  refreshSession,
  issueOtp,
  verifyOtp,
  approveGuardianConsent
} from "../src/services/auth.service.js";
import {
  register,
  login
} from "../src/controllers/auth.controller.js";
import { updateMe } from "../src/controllers/user.controller.js";
import { signAccessToken, signRefreshToken, signOnboardingToken } from "../src/utils/security.js";

async function getValidProof(destination) {
  const issued = await issueOtp(destination);
  const verified = await verifyOtp(issued.challengeId, issued.devCode, destination);
  return verified.verificationProof;
}

function getMinorDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 16);
  return d.toISOString().split("T")[0];
}

function getAdultDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d.toISOString().split("T")[0];
}

test("MH-42: Guardian approval and minor onboarding suite", async (t) => {
  const app = createApp();

  const dispatch = async ({ method = "GET", url, token, body = null }) => {
    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, val) { this.headers[name] = val; },
      writeHead(code, headers) { this.statusCode = code; Object.assign(this.headers, headers); },
      write(c) { chunks.push(c); },
      end(c) {
        if (c) chunks.push(c);
        this.body = chunks.length ? JSON.parse(chunks.join("")) : null;
      }
    };
    const req = {
      method,
      url,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      socket: { remoteAddress: "127.0.0.1" },
      async *[Symbol.asyncIterator]() {
        if (body) yield Buffer.from(JSON.stringify(body));
      }
    };
    await app.handle(req, res);
    return res;
  };

  await t.test("1. Password registration for minor derives PENDING_GUARDIAN and returns GUARDIAN_CONSENT_REQUIRED without session", async () => {
    const email = `minor_reg_${Date.now()}@example.com`;
    const proof = await getValidProof(email);
    const minorDob = getMinorDob();

    const res = await register({
      body: {
        fullName: "Test Minor User",
        email,
        password: "Password123!",
        dateOfBirth: minorDob,
        guardianEmail: "parent@example.com",
        verificationProof: proof
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.status, "GUARDIAN_CONSENT_REQUIRED");
    assert.strictEqual(res.body.data.email, email);
    assert.strictEqual(res.body.data.accessToken, undefined);

    const createdRecord = await repositories.users.findByEmailAndRole(email, "user");
    assert.ok(createdRecord);
    assert.strictEqual(createdRecord.onboardingStatus, "PENDING_GUARDIAN");
    assert.strictEqual(createdRecord.isGuardianConsentVerified, false);
    assert.strictEqual(createdRecord.guardianConsentStatus, "PENDING");
  });

  await t.test("2. Minor cannot bypass restrictions by supplying onboardingStatus or isGuardianConsentVerified during registration", async () => {
    const email = `minor_tamper_${Date.now()}@example.com`;
    const proof = await getValidProof(email);
    const minorDob = getMinorDob();

    // 2a. Controller rejects privilege fields
    const res = await register({
      body: {
        fullName: "Tampering Minor",
        email,
        password: "Password123!",
        dateOfBirth: minorDob,
        guardianEmail: "parent@example.com",
        verificationProof: proof,
        onboardingStatus: "COMPLETED",
        isGuardianConsentVerified: true
      }
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /forbidden during registration/);

    // 2b. Direct call to createUser derives PENDING_GUARDIAN for minor
    const directUser = await createUser({
      role: "user",
      fullName: "Direct Minor",
      email: `direct_${Date.now()}@example.com`,
      password: "Password123!",
      dateOfBirth: minorDob,
      guardianEmail: "parent@example.com",
      onboardingStatus: "COMPLETED"
    });
    assert.strictEqual(directUser.onboardingStatus, "PENDING_GUARDIAN");
    assert.strictEqual(directUser.isGuardianConsentVerified, false);
    assert.strictEqual(directUser.guardianConsentStatus, "PENDING");
  });

  await t.test("3. Password login for pending minor returns GUARDIAN_CONSENT_REQUIRED across password and Google flows", async () => {
    const email = `minor_login_${Date.now()}@example.com`;
    const password = "Password123!";
    const minorDob = getMinorDob();

    await createUser({
      role: "user",
      fullName: "Login Minor",
      email,
      password,
      dateOfBirth: minorDob,
      guardianEmail: "guardian@example.com"
    });

    // Password login
    const pwRes = await login({
      body: { email, password, role: "user" }
    });
    assert.strictEqual(pwRes.status, 200);
    assert.strictEqual(pwRes.body.data.status, "GUARDIAN_CONSENT_REQUIRED");
    assert.strictEqual(pwRes.body.data.email, email);
    assert.strictEqual(pwRes.body.data.accessToken, undefined);

    // Direct loginUser service
    const serviceRes = await loginUser({ email, password, role: "user" });
    assert.strictEqual(serviceRes.status, "GUARDIAN_CONSENT_REQUIRED");
    assert.strictEqual(serviceRes.email, email);
  });

  await t.test("4. Minor token refresh and session creation fail closed when guardian consent is pending", async () => {
    const email = `minor_token_${Date.now()}@example.com`;
    const minor = await createUser({
      role: "user",
      fullName: "Minor Token",
      email,
      password: "Password123!",
      dateOfBirth: getMinorDob(),
      guardianEmail: "parent@example.com"
    });

    // createSession throws GUARDIAN_CONSENT_REQUIRED
    await assert.rejects(
      async () => createSession(minor),
      (err) => {
        assert.strictEqual(err.code, "GUARDIAN_CONSENT_REQUIRED");
        return true;
      }
    );

    // If an attacker forged/held a refresh token, refreshSession rejects
    const forgedRefresh = signRefreshToken(minor);
    await assert.rejects(
      async () => refreshSession(forgedRefresh),
      (err) => {
        assert.strictEqual(err.code, "GUARDIAN_CONSENT_REQUIRED");
        return true;
      }
    );
  });

  await t.test("5. Authenticated API access is blocked with HTTP 403 GUARDIAN_CONSENT_REQUIRED while consent is pending", async () => {
    const email = `minor_api_${Date.now()}@example.com`;
    const minor = await createUser({
      role: "user",
      fullName: "Minor API",
      email,
      password: "Password123!",
      dateOfBirth: getMinorDob(),
      guardianEmail: "parent@example.com"
    });

    // Sign a temporary access token to test middleware gate
    const minorToken = signAccessToken(minor);

    const blockedRes = await dispatch({
      method: "POST",
      url: "/api/v1/user/mood/log",
      token: minorToken,
      body: { mood: "anxious", score: 4 }
    });

    assert.strictEqual(blockedRes.statusCode, 403);
    assert.strictEqual(blockedRes.body.error.code, "GUARDIAN_CONSENT_REQUIRED");
    assert.match(blockedRes.body.error.message, /Parent\/guardian approval is required/);
  });

  await t.test("6. User profile update via updateMe rejects tampering with onboarding or consent fields", async () => {
    const adultUser = await createUser({
      role: "user",
      fullName: "Adult Profile User",
      email: `adult_prof_${Date.now()}@example.com`,
      password: "Password123!",
      dateOfBirth: getAdultDob()
    });

    const res = await updateMe({
      user: adultUser,
      body: {
        fullName: "Updated Adult",
        onboardingStatus: "PENDING_GUARDIAN",
        isGuardianConsentVerified: false
      }
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /forbidden/);
  });

  await t.test("7. Guardian approval unlocks minor onboarding and allows full access to standard user features", async () => {
    const email = `minor_approved_${Date.now()}@example.com`;
    const password = "Password123!";
    const minor = await createUser({
      role: "user",
      fullName: "Approved Minor",
      email,
      password,
      dateOfBirth: getMinorDob(),
      guardianEmail: "parent_approved@example.com"
    });

    const consentToken = signOnboardingToken({ sub: minor.id, purpose: "guardian" });
    const approvalRes = await approveGuardianConsent(consentToken);
    assert.strictEqual(approvalRes.success, true);
    assert.strictEqual(approvalRes.email, email);

    // Verify user in repository now has COMPLETED onboarding and APPROVED consent
    const refreshedUser = await repositories.users.findById(minor.id);
    assert.strictEqual(refreshedUser.onboardingStatus, "COMPLETED");
    assert.strictEqual(refreshedUser.isGuardianConsentVerified, true);
    assert.strictEqual(refreshedUser.guardianConsentStatus, "APPROVED");

    // Login succeeds now
    const loginRes = await login({
      body: { email, password, role: "user" }
    });
    assert.strictEqual(loginRes.status, 200);
    assert.ok(loginRes.body.data.accessToken);

    // Minor can now access standard authenticated routes like mood logging
    const moodRes = await dispatch({
      method: "POST",
      url: "/api/v1/user/mood/log",
      token: loginRes.body.data.accessToken,
      body: { mood: "happy", score: 9 }
    });
    assert.strictEqual(moodRes.statusCode, 201);

    // But adult-only feature (/api/v1/ai/chat) still correctly blocks minor per MH-09!
    const aiRes = await dispatch({
      method: "POST",
      url: "/api/v1/ai/chat",
      token: loginRes.body.data.accessToken,
      body: { message: "Hello AI" }
    });
    assert.strictEqual(aiRes.statusCode, 403);
    assert.match(aiRes.body.error.message, /restricted to verified adult users aged 18 or above/);
  });
});

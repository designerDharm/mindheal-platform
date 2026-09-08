import test from "node:test";
import assert from "node:assert";
import { login, completeProfile, link, approveGuardian } from "../src/controllers/auth.controller.js";
import { repositories } from "../src/repositories/index.js";
import { signOnboardingToken, hashPassword } from "../src/utils/security.js";

test("Secure Onboarding Integration Suite", async (t) => {
  const originalUsers = repositories.users;

  // Helper mock res object
  const createMockRes = () => ({
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    }
  });

  await t.test("1. Google Sign-In with Unregistered Google Account on signin flow (SIGNUP_REQUIRED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => null
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-unregistered@example.com-uid123-UnregisteredUser",
        role: "user",
        flow: "signin"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 1 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "SIGNUP_REQUIRED");
    assert.strictEqual(result.body.data.email, "unregistered@example.com");
  });

  await t.test("2. Google Sign-Up with Unregistered Google Account on signup flow (PROFILE_REQUIRED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => null
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-newuser@example.com-uid456-NewUser",
        role: "user",
        flow: "signup"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 2 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "PROFILE_REQUIRED");
    assert.strictEqual(result.body.data.email, "newuser@example.com");
    assert.ok(result.body.data.onboardingToken);
    assert.ok(res.headers["Set-Cookie"].includes("onboarding_token="));
  });

  await t.test("3. Google Sign-In with Registered Google Account - Complete Profile (AUTHENTICATED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_adult",
        role: "user",
        email: "adult@example.com",
        firebaseUid: "uid_adult",
        fullName: "Adult User",
        dateOfBirth: "1990-01-01",
        profileCompletedAt: "2026-08-01T00:00:00Z",
        onboardingStatus: "COMPLETED",
        isActive: true
      })
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-adult@example.com-uid_adult-Adult User",
        role: "user",
        flow: "signin"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 3 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "AUTHENTICATED");
    assert.ok(result.body.data.session.accessToken);
  });

  await t.test("4. Google Sign-In with Incomplete Profile Account (PROFILE_REQUIRED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_incomplete",
        role: "user",
        email: "incomplete@example.com",
        firebaseUid: "uid_incomplete",
        fullName: null,
        dateOfBirth: null,
        profileCompletedAt: null,
        onboardingStatus: "COMPLETED",
        isActive: true
      })
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-incomplete@example.com-uid_incomplete-Incomplete",
        role: "user",
        flow: "signin"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 4 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "PROFILE_REQUIRED");
    assert.ok(result.body.data.onboardingToken);
  });

  await t.test("5. Google Sign-In with Suspended/Restricted Account (ACCOUNT_RESTRICTED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_restricted",
        role: "user",
        email: "restricted@example.com",
        firebaseUid: "uid_restricted",
        isActive: false
      })
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-restricted@example.com-uid_restricted-Restricted",
        role: "user",
        flow: "signin"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 5 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "ACCOUNT_RESTRICTED");
  });

  await t.test("6. Google Sign-In with Password-Registered Account - Email Collision (ACCOUNT_LINK_REQUIRED)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_pwd",
        role: "user",
        email: "pwd@example.com",
        firebaseUid: null,
        passwordHash: "somehash",
        isActive: true
      })
    };

    const res = createMockRes();
    const result = await login({
      body: {
        idToken: "mock-token-pwd@example.com-uid_pwd-PwdUser",
        role: "user",
        flow: "signin"
      },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 6 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "ACCOUNT_LINK_REQUIRED");
    assert.strictEqual(result.body.data.email, "pwd@example.com");
  });

  await t.test("7. Submit complete profile details for Adult user (AUTHENTICATED)", async () => {
    let updatedFields = null;
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_adult",
        role: "user",
        email: "adult@example.com",
        firebaseUid: "uid_adult",
        profileCompletedAt: null
      }),
      update: async (id, patch) => {
        updatedFields = patch;
        return {
          id,
          role: "user",
          email: "adult@example.com",
          ...patch
        };
      }
    };

    const onboardingToken = signOnboardingToken({ firebaseUid: "uid_adult", email: "adult@example.com", name: "Adult", role: "user", flow: "signup" });
    const res = createMockRes();
    const result = await completeProfile({
      body: {
        fullName: "Adult User",
        dateOfBirth: "1995-05-15",
        termsConsent: true,
        onboardingToken
      },
      req: { headers: {} },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 7 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "AUTHENTICATED");
    assert.ok(updatedFields.profileCompletedAt);
    assert.strictEqual(updatedFields.onboardingStatus, "COMPLETED");
  });

  await t.test("8. Submit complete profile details for Minor user (age 15-17) (GUARDIAN_CONSENT_REQUIRED)", async () => {
    let updatedFields = null;
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_minor",
        role: "user",
        email: "minor@example.com",
        firebaseUid: "uid_minor",
        profileCompletedAt: null
      }),
      update: async (id, patch) => {
        updatedFields = patch;
        return {
          id,
          role: "user",
          email: "minor@example.com",
          ...patch
        };
      }
    };

    // Age 16 (DOB = 16 years ago today)
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 16);
    const dobString = dob.toISOString().split("T")[0];

    const onboardingToken = signOnboardingToken({ firebaseUid: "uid_minor", email: "minor@example.com", name: "Minor", role: "user", flow: "signup" });
    const res = createMockRes();
    const result = await completeProfile({
      body: {
        fullName: "Minor User",
        dateOfBirth: dobString,
        guardianEmail: "parent@example.com",
        termsConsent: true,
        onboardingToken
      },
      req: { headers: {} },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 8 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "GUARDIAN_CONSENT_REQUIRED");
    assert.strictEqual(updatedFields.onboardingStatus, "PENDING_GUARDIAN");
    assert.strictEqual(updatedFields.guardianEmail, "parent@example.com");
  });

  await t.test("9. Submit complete profile details for Under 15 user (AGE_NOT_ELIGIBLE)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_child",
        role: "user",
        email: "child@example.com",
        firebaseUid: "uid_child",
        profileCompletedAt: null
      })
    };

    // Age 10 (DOB = 10 years ago today)
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 10);
    const dobString = dob.toISOString().split("T")[0];

    const onboardingToken = signOnboardingToken({ firebaseUid: "uid_child", email: "child@example.com", name: "Child", role: "user", flow: "signup" });
    const res = createMockRes();
    const result = await completeProfile({
      body: {
        fullName: "Child User",
        dateOfBirth: dobString,
        termsConsent: true,
        onboardingToken
      },
      req: { headers: {} },
      res
    });

    if (result.status !== 200) {
      console.error("TEST 9 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "AGE_NOT_ELIGIBLE");
  });

  await t.test("10. Submit complete profile details with missing fields (badRequest)", async () => {
    const onboardingToken = signOnboardingToken({ firebaseUid: "uid_adult", email: "adult@example.com", name: "Adult", role: "user", flow: "signup" });
    const res = createMockRes();
    const result = await completeProfile({
      body: {
        termsConsent: true,
        onboardingToken
      },
      req: { headers: {} },
      res
    });

    assert.strictEqual(result.status, 400);
  });

  await t.test("11. Submit complete profile details with missing terms consent (badRequest)", async () => {
    const onboardingToken = signOnboardingToken({ firebaseUid: "uid_adult", email: "adult@example.com", name: "Adult", role: "user", flow: "signup" });
    const res = createMockRes();
    const result = await completeProfile({
      body: {
        fullName: "Adult User",
        dateOfBirth: "1995-05-15",
        termsConsent: false,
        onboardingToken
      },
      req: { headers: {} },
      res
    });

    assert.strictEqual(result.status, 400);
  });

  await t.test("12. Google re-authentication / account linking with correct credentials (AUTHENTICATED)", async () => {
    let updatedUid = null;
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_pwd",
        role: "user",
        email: "pwd@example.com",
        passwordHash: hashPassword("password"),
        fullName: "Pwd User",
        dateOfBirth: "1990-01-01",
        profileCompletedAt: "2026-08-01T00:00:00Z",
        onboardingStatus: "COMPLETED",
        isActive: true
      }),
      update: async (id, patch) => {
        updatedUid = patch.firebaseUid;
        return {
          id,
          role: "user",
          email: "pwd@example.com",
          fullName: "Pwd User",
          dateOfBirth: "1990-01-01",
          ...patch,
          profileCompletedAt: "2026-08-01T00:00:00Z",
          onboardingStatus: "COMPLETED",
          isActive: true
        };
      }
    };

    const result = await link({
      body: {
        email: "pwd@example.com",
        password: "password",
        idToken: "mock-token-pwd@example.com-uid_pwd-PwdUser",
        role: "user"
      }
    });

    if (result.status !== 200) {
      console.error("TEST 12 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.status, "AUTHENTICATED");
    assert.strictEqual(updatedUid, "uid_pwd");
  });

  await t.test("13. Google re-authentication / account linking with incorrect password (rejects)", async () => {
    repositories.users = {
      ...originalUsers,
      findByEmailAndRole: async () => ({
        id: "usr_pwd",
        role: "user",
        email: "pwd@example.com",
        passwordHash: hashPassword("password"),
        isActive: true
      })
    };

    const result = await link({
      body: {
        email: "pwd@example.com",
        password: "wrong_password",
        idToken: "mock-token-pwd@example.com-uid_pwd-PwdUser",
        role: "user"
      }
    });

    assert.strictEqual(result.status, 400);
  });

  await t.test("14. Approve guardian consent with valid token (updates status to COMPLETED)", async () => {
    let updatedStatus = null;
    repositories.users = {
      ...originalUsers,
      findById: async () => ({
        id: "usr_minor",
        role: "user",
        email: "minor@example.com"
      }),
      update: async (id, patch) => {
        updatedStatus = patch;
        return {
          id,
          role: "user",
          email: "minor@example.com",
          ...patch
        };
      }
    };

    const consentToken = signOnboardingToken({ sub: "usr_minor", purpose: "guardian" });
    const result = await approveGuardian({
      body: { token: consentToken }
    });

    if (result.status !== 200) {
      console.error("TEST 14 ERROR BODY:", result);
    }

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.success, true);
    assert.strictEqual(updatedStatus.onboardingStatus, "COMPLETED");
    assert.strictEqual(updatedStatus.isGuardianConsentVerified, true);
    assert.strictEqual(updatedStatus.guardianConsentStatus, "APPROVED");
  });

  await t.test("15. Approve guardian consent with invalid token (rejects)", async () => {
    const result = await approveGuardian({
      body: { token: "invalid_token" }
    });

    assert.strictEqual(result.status, 400);
  });

  // Reset original repositories
  repositories.users = originalUsers;
});

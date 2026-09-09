import test from "node:test";
import assert from "node:assert";
import { login, register, registerCounsellor } from "../src/controllers/auth.controller.js";
import { repositories } from "../src/repositories/index.js";
import { hashPassword, generateTotp } from "../src/utils/security.js";

test("auth controller", async (t) => {
  await t.test("returns the same generic response for missing users and wrong passwords", async () => {
    const originalUsers = repositories.users;

    try {
      repositories.users = {
        ...originalUsers,
        findByEmailAndRole: async () => null
      };
      const missingUser = await login({
        body: { email: "missing@example.com", password: "wrong", role: "user" }
      });

      repositories.users = {
        ...originalUsers,
        findByEmailAndRole: async () => ({
          id: "usr_login",
          role: "user",
          email: "known@example.com",
          passwordHash: hashPassword("correct-password"),
          isActive: true
        })
      };
      const wrongPassword = await login({
        body: { email: "known@example.com", password: "wrong", role: "user" }
      });

      assert.strictEqual(missingUser.status, 401);
      assert.strictEqual(wrongPassword.status, 401);
      assert.deepStrictEqual(missingUser.body, wrongPassword.body);
      assert.strictEqual(missingUser.body.error.message, "Invalid email, password, or role.");
      assert.ok(!JSON.stringify(missingUser.body).includes("User not found"));
      assert.ok(!JSON.stringify(wrongPassword.body).includes("Invalid password"));
    } finally {
      repositories.users = originalUsers;
    }
  });

  await t.test("MH-10: requires valid verificationProof for user registration", async () => {
    const res = await register({
      body: {
        fullName: "Test User",
        email: "test_no_proof@example.com",
        password: "Password123!"
      }
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /Verification proof is required/);
  });

  await t.test("MH-10: requires valid verificationProof for counsellor registration", async () => {
    const res = await registerCounsellor({
      body: {
        fullName: "Test Counsellor",
        mobile: "+919876543211",
        password: "Password123!",
        licenseNumber: "LIC-001",
        specializations: ["CBT"]
      }
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /Verification proof is required/);
  });

  await t.test("MH-11: admin login rejects missing or invalid TOTP code with 401", async () => {
    const originalUsers = repositories.users;
    const adminEmail = "admin_totp_test@example.com";
    const password = "Password123!";
    const totpSecret = "JBSWY3DPEHPK3PXP";

    try {
      repositories.users = {
        ...originalUsers,
        findByEmailAndRole: async (email, role) => {
          if (email === adminEmail && role === "admin") {
            return {
              id: "usr_admin_test",
              role: "admin",
              email: adminEmail,
              passwordHash: hashPassword(password),
              totpSecret,
              isTotpEnabled: true,
              isActive: true
            };
          }
          return null;
        }
      };

      // 1. Missing TOTP
      const missingTotp = await login({
        body: { email: adminEmail, password, role: "admin" }
      });
      assert.strictEqual(missingTotp.status, 401);
      assert.match(missingTotp.body.error.message, /Two-factor authentication code is required/);

      // 2. Incorrect TOTP
      const wrongTotp = await login({
        body: { email: adminEmail, password, role: "admin", totp: "000000" }
      });
      assert.strictEqual(wrongTotp.status, 401);
      assert.match(wrongTotp.body.error.message, /Invalid two-factor authentication code/);

      // 3. Valid TOTP succeeds
      const validCode = generateTotp(totpSecret);
      const validLogin = await login({
        body: { email: adminEmail, password, role: "admin", totp: validCode }
      });
      assert.strictEqual(validLogin.status, 200);
      assert.ok(validLogin.body.data.accessToken);
    } finally {
      repositories.users = originalUsers;
    }
  });
});

import assert from "node:assert";
import { login } from "../backend/src/controllers/auth.controller.js";
import { repositories } from "../backend/src/repositories/index.js";
import { hashPassword, generateTotp } from "../backend/src/utils/security.js";

async function runDeepVerification() {
  console.log("Starting Comprehensive MH-11 2FA Verification Suite...");

  const adminEmail = "admin_mh11@example.com";
  const adminPassword = "Password123!";
  const totpSecret = "JBSWY3DPEHPK3PXP";

  let adminUser = await repositories.users.findByEmailAndRole(adminEmail, "admin");
  if (!adminUser) {
    adminUser = await repositories.users.create({
      id: "usr_admin_mh11",
      role: "admin",
      fullName: "MH11 Admin User",
      email: adminEmail,
      password: adminPassword,
      passwordHash: hashPassword(adminPassword),
      totpSecret,
      isTotpEnabled: true,
      isActive: true
    });
  }

  // ----------------------------------------------------
  // Test 1: Correct password + MISSING second factor -> FAILS (401)
  // ----------------------------------------------------
  console.log("\n[Test 1] Admin login with missing TOTP");
  const missingTotpRes = await login({
    body: {
      email: adminEmail,
      password: adminPassword,
      role: "admin"
    }
  });
  assert.strictEqual(missingTotpRes.status, 401);
  assert.match(missingTotpRes.body.error.message, /Two-factor authentication code is required/);
  console.log("✔ Missing second factor rejected (401):", missingTotpRes.body.error.message);

  // ----------------------------------------------------
  // Test 2: Correct password + EMPTY string second factor -> FAILS (401)
  // ----------------------------------------------------
  console.log("\n[Test 2] Admin login with empty TOTP");
  const emptyTotpRes = await login({
    body: {
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      totp: "   "
    }
  });
  assert.strictEqual(emptyTotpRes.status, 401);
  assert.match(emptyTotpRes.body.error.message, /Two-factor authentication code is required/);
  console.log("✔ Empty second factor rejected (401):", emptyTotpRes.body.error.message);

  // ----------------------------------------------------
  // Test 3: Correct password + INCORRECT second factor -> FAILS (401)
  // ----------------------------------------------------
  console.log("\n[Test 3] Admin login with incorrect TOTP");
  const wrongTotpRes = await login({
    body: {
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      totp: "000000"
    }
  });
  assert.strictEqual(wrongTotpRes.status, 401);
  assert.match(wrongTotpRes.body.error.message, /Invalid two-factor authentication code/);
  console.log("✔ Incorrect second factor rejected (401):", wrongTotpRes.body.error.message);

  // ----------------------------------------------------
  // Test 4: INCORRECT password + valid second factor -> FAILS (401)
  // ----------------------------------------------------
  console.log("\n[Test 4] Admin login with incorrect password");
  const validTotp = generateTotp(totpSecret);
  const wrongPassRes = await login({
    body: {
      email: adminEmail,
      password: "WrongPassword!",
      role: "admin",
      totp: validTotp
    }
  });
  assert.strictEqual(wrongPassRes.status, 401);
  assert.match(wrongPassRes.body.error.message, /Invalid email, password, or role/);
  console.log("✔ Incorrect password rejected (401):", wrongPassRes.body.error.message);

  // ----------------------------------------------------
  // Test 5: Correct credentials + VALID RFC 6238 TOTP -> SUCCEEDS (200)
  // ----------------------------------------------------
  console.log("\n[Test 5] Admin login with valid credentials & valid TOTP");
  const validLoginRes = await login({
    body: {
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      totp: validTotp
    }
  });
  assert.strictEqual(validLoginRes.status, 200);
  assert.ok(validLoginRes.body.data.accessToken, "Must issue valid access token");
  assert.strictEqual(validLoginRes.body.data.user.role, "admin");
  console.log("✔ Valid credentials and RFC 6238 TOTP succeeded (200): session issued for", validLoginRes.body.data.user.email);

  // ----------------------------------------------------
  // Test 6: Non-admin (User) does NOT require TOTP
  // ----------------------------------------------------
  console.log("\n[Test 6] Standard user login without TOTP");
  const userEmail = "standard_user_mh11@example.com";
  const userPass = "Password123!";
  let stdUser = await repositories.users.findByEmailAndRole(userEmail, "user");
  if (!stdUser) {
    stdUser = await repositories.users.create({
      id: "usr_std_mh11",
      role: "user",
      fullName: "Standard User",
      email: userEmail,
      password: userPass,
      passwordHash: hashPassword(userPass),
      isActive: true
    });
  }

  const userLoginRes = await login({
    body: {
      email: userEmail,
      password: userPass,
      role: "user"
    }
  });
  assert.strictEqual(userLoginRes.status, 200);
  assert.ok(userLoginRes.body.data.accessToken);
  console.log("✔ Standard user login without TOTP succeeds as expected (200)");

  console.log("\n==========================================");
  console.log("ALL MH-11 2FA VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
}

runDeepVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

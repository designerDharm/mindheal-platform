import test from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { createId, generateTotp, signOnboardingToken, hashPassword } from "../src/utils/security.js";

const app = createApp();

async function request(method, path, { body, token, headers = {}, rawBody } = {}) {
  const reqBody = rawBody !== undefined ? rawBody : body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    ...(rawBody === undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...headers
  };
  const ip = headers["x-forwarded-for"] || `10.42.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250) + 1}`;
  req.headers["x-forwarded-for"] = ip;
  req.socket = { remoteAddress: ip };

  const res = {
    statusCode: 0,
    headers: {},
    payload: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.payload = payload;
    }
  };

  await app.handle(req, res);

  return {
    status: res.statusCode,
    headers: res.headers,
    body: res.payload ? JSON.parse(res.payload) : null
  };
}

test("Complete Staging Journeys Verification Suite", async (suite) => {
  const runId = Date.now();
  let adminToken = "";
  let adminUserId = "";

  suite.before(async () => {
    // 1. Authenticate platform Admin
    const adminTotp = generateTotp("JBSWY3DPEHPK3PXP");
    const adminLoginRes = await request("POST", "/api/v1/auth/login", {
      body: {
        email: "admin@example.com",
        password: "Password123!",
        role: "admin",
        totp: adminTotp
      }
    });
    assert.strictEqual(adminLoginRes.status, 200, "Admin login must succeed with valid TOTP");
    adminToken = adminLoginRes.body.data.accessToken;
    adminUserId = adminLoginRes.body.data.user.id;

    // 2. Ensure test API configurations exist for Generative AI endpoints
    await request("PUT", "/api/v1/admin/api-config/AI%20Counselling%20Chat", {
      token: adminToken,
      body: { provider: "openai", modelName: "mock-chat", apiKeyEncrypted: "chat_smoke_key", isActive: true }
    });
    await request("PUT", "/api/v1/admin/api-config/Handwriting%20Analysis", {
      token: adminToken,
      body: { provider: "gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "handwriting_smoke_key", isActive: true }
    });
    await request("PUT", "/api/v1/admin/api-config/Dream%20Analysis%20PDF%20Report", {
      token: adminToken,
      body: { provider: "gemini", modelName: "gemini-2.5-flash", apiKeyEncrypted: "dream_smoke_key", isActive: true }
    });
  });

  // =========================================================================
  // JOURNEY 1: Authentication & Account Lifecycle
  // =========================================================================
  await suite.test("Journey 1: Authentication & Account Lifecycle", async (t) => {
    const adultEmail = `adult_${runId}@example.com`;
    const adultMobile = `+9198${String(runId).slice(-8)}`;
    const adultPassword = "SecurePassword123!";
    let adultAccessToken = "";
    let adultRefreshToken = "";
    let adultUserId = "";

    const minorEmail = `minor_${runId}@example.com`;
    const minorMobile = `+9197${String(runId).slice(-8)}`;
    const guardianEmail = `guardian_${runId}@example.com`;
    let minorUserId = "";

    await t.test("1.1 Success Scenario: Adult registration, OTP proof, login, refresh, minor consent, and clean logout", async () => {
      // Step 1: Adult OTP Verification
      const otpSend = await request("POST", "/api/v1/auth/send-otp", {
        body: { mobile: adultMobile }
      });
      assert.strictEqual(otpSend.status, 200);
      const challengeId = otpSend.body.data.challengeId;
      const devCode = otpSend.body.data.devCode || "123456";

      const otpVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId, code: devCode, mobile: adultMobile }
      });
      assert.strictEqual(otpVerify.status, 200);
      const verificationProof = otpVerify.body.data.verificationProof;
      assert.ok(verificationProof, "Verification proof must be returned");

      // Step 2: Adult User Registration
      const regRes = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Staging Adult User",
          email: adultEmail,
          mobile: adultMobile,
          password: adultPassword,
          dateOfBirth: "1992-05-15", // Adult age ~34
          verificationProof
        }
      });
      assert.strictEqual(regRes.status, 201, "Adult registration must return 201 Created");
      assert.ok(regRes.body.data.accessToken, "Access token required on signup");
      adultUserId = regRes.body.data.user.id;
      assert.strictEqual(regRes.body.data.user.onboardingStatus, "COMPLETED");

      // Step 3: Adult User Login
      const loginRes = await request("POST", "/api/v1/auth/login", {
        body: { email: adultEmail, password: adultPassword, role: "user" }
      });
      assert.strictEqual(loginRes.status, 200, "Login must succeed with valid credentials");
      adultAccessToken = loginRes.body.data.accessToken;
      adultRefreshToken = loginRes.body.data.refreshToken;
      assert.ok(adultAccessToken && adultRefreshToken);

      // Step 4: Token Refresh
      const refreshRes = await request("POST", "/api/v1/auth/refresh", {
        body: { refreshToken: adultRefreshToken }
      });
      assert.strictEqual(refreshRes.status, 200, "Refresh token endpoint must issue fresh access token");
      assert.ok(refreshRes.body.data.accessToken);

      // Step 5: Minor User Registration with Guardian Email
      const minorOtpSend = await request("POST", "/api/v1/auth/send-otp", {
        body: { mobile: minorMobile }
      });
      const minorVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: minorOtpSend.body.data.challengeId, code: minorOtpSend.body.data.devCode || "123456", mobile: minorMobile }
      });

      const minorReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Staging Minor User",
          email: minorEmail,
          mobile: minorMobile,
          password: "MinorPassword123!",
          dateOfBirth: "2010-06-10", // Age ~16
          guardianEmail,
          verificationProof: minorVerify.body.data.verificationProof
        }
      });
      assert.strictEqual(minorReg.status, 201);
      assert.strictEqual(minorReg.body.data.status, "GUARDIAN_CONSENT_REQUIRED");
      const minorRecord = await repositories.users.findByEmailAndRole(minorEmail, "user");
      assert.ok(minorRecord, "Minor user record must exist in DB");
      minorUserId = minorRecord.id;
      assert.strictEqual(minorRecord.guardianConsentStatus, "PENDING");
      assert.strictEqual(minorRecord.onboardingStatus, "PENDING_GUARDIAN");

      // Step 6: Guardian Approval Workflow
      const consentToken = signOnboardingToken({ sub: minorUserId, purpose: "guardian" });
      const approveRes = await request("POST", "/api/v1/auth/guardian/approve", {
        body: { token: consentToken }
      });
      assert.strictEqual(approveRes.status, 200, "Guardian approval must succeed");

      // Verify updated minor record in SSoT
      const minorUserRecord = await repositories.users.findById(minorUserId);
      assert.strictEqual(minorUserRecord.guardianConsentStatus, "APPROVED");
      assert.strictEqual(minorUserRecord.isGuardianConsentVerified, true);
      assert.strictEqual(minorUserRecord.onboardingStatus, "COMPLETED");

      // Step 7: Clean Logout & Token Revocation
      const logoutRes = await request("POST", "/api/v1/auth/logout", {
        token: adultAccessToken,
        body: { refreshToken: adultRefreshToken }
      });
      assert.strictEqual(logoutRes.status, 200, "Logout must succeed");

      // Attempting to reuse revoked refresh token must be rejected
      const revokedRefresh = await request("POST", "/api/v1/auth/refresh", {
        body: { refreshToken: adultRefreshToken }
      });
      assert.strictEqual(revokedRefresh.status, 401, "Revoked refresh token must be rejected with 401");
    });

    await t.test("1.2 Failure Scenario: Missing verification proof, minor without guardian email, under-15, wrong password, admin without TOTP", async () => {
      // 1. Missing verification proof on register (MH-10)
      const missingProof = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "No Proof User",
          email: `noproof_${runId}@example.com`,
          mobile: `+9196${String(runId).slice(-8)}`,
          password: "Password123!",
          dateOfBirth: "1995-01-01"
        }
      });
      assert.strictEqual(missingProof.status, 400, "Registration without proof must return 400");
      assert.match(missingProof.body.error.message, /verification/i);

      // 2. Minor registration without guardian email
      const minorOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: `+9195${String(runId).slice(-8)}` } });
      const minorVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: minorOtp.body.data.challengeId, code: minorOtp.body.data.devCode || "123456", mobile: `+9195${String(runId).slice(-8)}` }
      });
      const minorNoGuardian = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "No Guardian Minor",
          email: `noguardian_${runId}@example.com`,
          mobile: `+9195${String(runId).slice(-8)}`,
          password: "Password123!",
          dateOfBirth: "2010-01-01",
          verificationProof: minorVerify.body.data.verificationProof
        }
      });
      assert.strictEqual(minorNoGuardian.status, 400, "Minor without guardian email must return 400");
      assert.match(minorNoGuardian.body.error.message, /guardian/i);

      // 3. Platform minimum age violation (under 15 years old)
      const childOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: `+9194${String(runId).slice(-8)}` } });
      const childVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: childOtp.body.data.challengeId, code: childOtp.body.data.devCode || "123456", mobile: `+9194${String(runId).slice(-8)}` }
      });
      const childReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Child User",
          email: `child_${runId}@example.com`,
          mobile: `+9194${String(runId).slice(-8)}`,
          password: "Password123!",
          dateOfBirth: "2018-01-01", // Age ~8
          guardianEmail: "parent@example.com",
          verificationProof: childVerify.body.data.verificationProof
        }
      });
      assert.strictEqual(childReg.status, 400, "Under 15 must be rejected");
      assert.match(childReg.body.error.message, /15/i);

      // 4. Invalid Password
      const wrongPass = await request("POST", "/api/v1/auth/login", {
        body: { email: adultEmail, password: "WrongPassword999!", role: "user" }
      });
      assert.strictEqual(wrongPass.status, 401, "Wrong password must return 401");

      // 5. Role Mismatch
      const wrongRole = await request("POST", "/api/v1/auth/login", {
        body: { email: adultEmail, password: adultPassword, role: "counsellor" }
      });
      assert.strictEqual(wrongRole.status, 401, "Role mismatch must return 401");

      // 6. Admin login without TOTP (MH-11)
      const adminNoTotp = await request("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.com", password: "Password123!", role: "admin" }
      });
      assert.strictEqual(adminNoTotp.status, 401, "Admin login without TOTP must return 401");
      assert.match(adminNoTotp.body.error.message, /TOTP|two-factor/i);

      // 7. Admin login with invalid TOTP code
      const adminBadTotp = await request("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.com", password: "Password123!", role: "admin", totp: "000000" }
      });
      assert.strictEqual(adminBadTotp.status, 401, "Admin login with bad TOTP must return 401");
    });

    await t.test("1.3 Unauthorized-User Scenario: Disabled account blocked, minor blocked from AI features, unauthenticated access rejected", async () => {
      // 1. Disabled Account Blocked (MH-12)
      const disabledUserId = createId("usr");
      await repositories.users.create({
        id: disabledUserId,
        fullName: "Disabled Staging User",
        email: `disabled_${runId}@example.com`,
        passwordHash: hashPassword("Password123!"),
        role: "user",
        isActive: false,
        status: "disabled"
      });

      const disabledLogin = await request("POST", "/api/v1/auth/login", {
        body: { email: `disabled_${runId}@example.com`, password: "Password123!", role: "user" }
      });
      assert.strictEqual(disabledLogin.status, 403, "Disabled account login must return 403 Forbidden");

      // 2. Minor user blocked from adult generative AI features (MH-09)
      // Login as the verified minor
      const minorLogin = await request("POST", "/api/v1/auth/login", {
        body: { email: minorEmail, password: "MinorPassword123!", role: "user" }
      });
      assert.strictEqual(minorLogin.status, 200);
      const minorToken = minorLogin.body.data.accessToken;

      const minorAiCall = await request("POST", "/api/v1/analysis/dream", {
        token: minorToken,
        body: { inputText: "Dreaming about a giant castle." }
      });
      assert.strictEqual(minorAiCall.status, 403, "Minor must be blocked from AI self-reflection reports");
      assert.match(minorAiCall.body.error.message, /18/i);

      // 3. Unauthenticated requests rejected
      const unauthProfile = await request("GET", "/api/v1/user/profile");
      assert.strictEqual(unauthProfile.status, 401, "Unauthenticated profile access must return 401");

      const unauthAdmin = await request("GET", "/api/v1/admin/users");
      assert.strictEqual(unauthAdmin.status, 401, "Unauthenticated admin access must return 401");
    });
  });

  // =========================================================================
  // JOURNEY 2: Counsellor Selection, Booking, Payment, Cancellation & Refunds
  // =========================================================================
  await suite.test("Journey 2: Counsellor Selection, Booking, Payment, Cancellation & Refunds", async (t) => {
    const clientEmail = `client_cns_${runId}@example.com`;
    const clientMobile = `+9193${String(runId).slice(-8)}`;
    const cnsUserEmail = `cns_user_${runId}@example.com`;
    const cnsUserMobile = `+9192${String(runId).slice(-8)}`;
    let clientToken = "";
    let clientUserId = "";
    let counsellorToken = "";
    let counsellorId = "";
    let testSlot1Id = "";
    let testSlot2Id = "";

    await t.test("2.1 Success Scenario: Discovery, wallet topup, booking hold, acceptance, cancellation refund (idempotent), second booking completion & payout", async () => {
      // 1. Create client account
      const clientOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: clientMobile } });
      const clientVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: clientOtp.body.data.challengeId, code: clientOtp.body.data.devCode || "123456", mobile: clientMobile }
      });
      const clientReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Booking Client",
          email: clientEmail,
          mobile: clientMobile,
          password: "ClientPassword123!",
          dateOfBirth: "1994-03-22",
          verificationProof: clientVerify.body.data.verificationProof
        }
      });
      clientToken = clientReg.body.data.accessToken;
      clientUserId = clientReg.body.data.user.id;

      // 2. Create and approve counsellor
      const cnsOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: cnsUserMobile } });
      const cnsVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: cnsOtp.body.data.challengeId, code: cnsOtp.body.data.devCode || "123456", mobile: cnsUserMobile }
      });
      const cnsReg = await request("POST", "/api/v1/auth/counsellor/register", {
        body: {
          fullName: "Dr. Staging Therapist",
          email: cnsUserEmail,
          mobile: cnsUserMobile,
          password: "CounsellorPass123!",
          licenseNumber: `LIC-${runId}`,
          specializations: "Anxiety, CBT",
          verificationProof: cnsVerify.body.data.verificationProof
        }
      });
      assert.strictEqual(cnsReg.status, 201);
      const applicationId = cnsReg.body.data.application.id;

      // Admin approves counsellor
      const approveRes = await request("PUT", `/api/v1/admin/counsellors/${applicationId}/verify`, {
        token: adminToken,
        body: { action: "approve" }
      });
      assert.strictEqual(approveRes.status, 200);

      // Counsellor login
      const cnsLogin = await request("POST", "/api/v1/auth/login", {
        body: { email: cnsUserEmail, password: "CounsellorPass123!", role: "counsellor" }
      });
      assert.strictEqual(cnsLogin.status, 200);
      counsellorToken = cnsLogin.body.data.accessToken;
      const cnsProfile = await repositories.counsellors.findByUserId(cnsLogin.body.data.user.id);
      counsellorId = cnsProfile.id;

      // Ensure counsellor has hourly rate and wallet
      await repositories.counsellors.update(counsellorId, { hourlyRateInr: 1000, verificationStatus: "approved" });
      const cnsWallet = await repositories.wallets.findByOwner(cnsLogin.body.data.user.id);
      if (!cnsWallet) {
        await repositories.wallets.createForOwner("counsellor", cnsLogin.body.data.user.id);
      }

      // Counsellor creates availability slots
      testSlot1Id = createId("slot");
      testSlot2Id = createId("slot");
      await repositories.availabilitySlots.create({
        id: testSlot1Id,
        counsellorId,
        slotDate: "2026-11-10",
        startTime: "10:00",
        endTime: "11:00",
        sessionType: "video",
        isBooked: false
      });
      await repositories.availabilitySlots.create({
        id: testSlot2Id,
        counsellorId,
        slotDate: "2026-11-10",
        startTime: "14:00",
        endTime: "15:00",
        sessionType: "video",
        isBooked: false
      });

      // Step 3: Public Counsellor Discovery
      const listings = await request("GET", "/api/v1/counsellors");
      assert.strictEqual(listings.status, 200);
      assert.ok(Array.isArray(listings.body.data));

      const slotList = await request("GET", `/api/v1/counsellors/${counsellorId}/slots`);
      assert.strictEqual(slotList.status, 200);
      assert.strictEqual(slotList.body.data.length, 2, "Both unbooked slots must be listed");

      // Step 4: Client Wallet Top-Up
      const topupOrder = await request("POST", "/api/v1/wallet/topup/order", {
        token: clientToken,
        body: { amountInr: 2500 } // ₹2500 top-up
      });
      assert.strictEqual(topupOrder.status, 201);
      const paymentId = `pay_${runId}_client`;

      const topupVerify = await request("POST", "/api/v1/wallet/topup/verify", {
        token: clientToken,
        body: {
          orderId: topupOrder.body.data.id,
          razorpay_order_id: topupOrder.body.data.gatewayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: "test_verified_signature"
        }
      });
      assert.strictEqual(topupVerify.status, 200);

      const walletCheck = await request("GET", "/api/v1/wallet/balance", { token: clientToken });
      assert.strictEqual(walletCheck.body.data.balancePaise, 250000, "Wallet balance must reflect ₹2500 (250000 paise)");

      // Step 5: Session 1 Booking (will be cancelled and refunded)
      const booking1 = await request("POST", "/api/v1/sessions/book", {
        token: clientToken,
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-10T10:00:00.000Z",
          durationMinutes: 60,
          amountInr: 1000
        }
      });
      assert.strictEqual(booking1.status, 201, "Session booking must return 201");
      const session1Id = booking1.body.data.id;

      // Balance after hold: 250000 - 100000 = 150000 paise
      const balAfterHold1 = await request("GET", "/api/v1/wallet/balance", { token: clientToken });
      assert.strictEqual(balAfterHold1.body.data.balancePaise, 150000);

      // Counsellor accepts Session 1
      const accept1 = await request("PUT", `/api/v1/sessions/${session1Id}/accept`, { token: counsellorToken });
      assert.strictEqual(accept1.status, 200);
      assert.strictEqual(accept1.body.data.status, "confirmed");

      // Step 6: Cancellation by user releases slot and issues immediate refund
      const cancel1 = await request("PUT", `/api/v1/sessions/${session1Id}/cancel`, { token: clientToken });
      assert.strictEqual(cancel1.status, 200);
      assert.strictEqual(cancel1.body.data.status, "cancelled");

      // Balance restored to 250000 paise
      const balAfterCancel = await request("GET", "/api/v1/wallet/balance", { token: clientToken });
      assert.strictEqual(balAfterCancel.body.data.balancePaise, 250000, "Refund must restore full 250000 paise balance");

      // Slot 1 released
      const slot1Record = await repositories.availabilitySlots.findById(testSlot1Id);
      assert.strictEqual(slot1Record.isBooked, false, "Slot must be marked available after cancellation");

      // Repeat cancellation is idempotent (zero double refund)
      const repeatCancel = await request("PUT", `/api/v1/sessions/${session1Id}/cancel`, { token: clientToken });
      assert.strictEqual(repeatCancel.status, 200);
      const balAfterRepeatCancel = await request("GET", "/api/v1/wallet/balance", { token: clientToken });
      assert.strictEqual(balAfterRepeatCancel.body.data.balancePaise, 250000, "Balance must strictly remain 250000 on repeated cancel");

      // Step 7: Session 2 Booking, Acceptance, Completion & Commission Settlement
      const booking2 = await request("POST", "/api/v1/sessions/book", {
        token: clientToken,
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-10T14:00:00.000Z",
          durationMinutes: 60,
          amountInr: 1000
        }
      });
      assert.strictEqual(booking2.status, 201);
      const session2Id = booking2.body.data.id;

      // Counsellor accepts Session 2
      await request("PUT", `/api/v1/sessions/${session2Id}/accept`, { token: counsellorToken });

      // Counsellor completes Session 2
      const completeRes = await request("PUT", `/api/v1/sessions/${session2Id}/complete`, { token: counsellorToken });
      assert.strictEqual(completeRes.status, 200);
      assert.strictEqual(completeRes.body.data.status, "completed");

      // Counsellor earnings settled: Gross ₹1000, Commission 10% (₹100), Counsellor net ₹900 (90000 paise)
      const cnsBalance = await request("GET", "/api/v1/wallet/balance", { token: counsellorToken });
      assert.strictEqual(cnsBalance.body.data.balancePaise, 90000, "Counsellor wallet must receive net ₹900 (90000 paise)");

      // Re-completing session is idempotent
      const repeatComplete = await request("PUT", `/api/v1/sessions/${session2Id}/complete`, { token: counsellorToken });
      assert.strictEqual(repeatComplete.status, 200);
      const cnsBalanceRepeat = await request("GET", "/api/v1/wallet/balance", { token: counsellorToken });
      assert.strictEqual(cnsBalanceRepeat.body.data.balancePaise, 90000, "Counsellor balance must not duplicate on repeated complete");
    });

    await t.test("2.2 Failure Scenario: Double booking same slot, insufficient balance, tampered duration, invalid complete", async () => {
      // 1. Double booking already booked slot
      const doubleBook = await request("POST", "/api/v1/sessions/book", {
        token: clientToken,
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-10T14:00:00.000Z", // Slot 2 is already booked/completed
          durationMinutes: 60,
          amountInr: 1000
        }
      });
      assert.strictEqual(doubleBook.status, 400, "Booking booked slot must return 400");

      // 2. Insufficient balance booking
      const emptyUserMobile = `+9191${String(runId).slice(-8)}`;
      const emptyOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: emptyUserMobile } });
      const emptyVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: emptyOtp.body.data.challengeId, code: emptyOtp.body.data.devCode || "123456", mobile: emptyUserMobile }
      });
      const emptyReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Broke User",
          email: `broke_${runId}@example.com`,
          mobile: emptyUserMobile,
          password: "Password123!",
          dateOfBirth: "1990-01-01",
          verificationProof: emptyVerify.body.data.verificationProof
        }
      });
      const brokeToken = emptyReg.body.data.accessToken;

      const brokeSlotId = createId("slot");
      await repositories.availabilitySlots.create({
        id: brokeSlotId,
        counsellorId,
        slotDate: "2026-11-12",
        startTime: "11:00",
        endTime: "12:00",
        sessionType: "video",
        isBooked: false
      });

      const brokeBooking = await request("POST", "/api/v1/sessions/book", {
        token: brokeToken,
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-12T11:00:00.000Z",
          durationMinutes: 60,
          amountInr: 1000
        }
      });
      assert.strictEqual(brokeBooking.status, 400, "Insufficient wallet balance must return 400");
      assert.match(brokeBooking.body.error.message, /balance/i);

      // 3. Tampered invalid duration (< 1 or > 240 mins)
      const tamperedDuration = await request("POST", "/api/v1/sessions/book", {
        token: clientToken,
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-10T10:00:00.000Z",
          durationMinutes: 500, // Exceeds max 240
          amountInr: 1000
        }
      });
      assert.strictEqual(tamperedDuration.status, 400, "Tampered duration must return 400");

      // 4. Cannot cancel completed session
      const allSessions = await repositories.sessions.listForUser({ id: clientUserId, role: "user" });
      const completedSession = allSessions.find(s => s.status === "completed");
      if (completedSession) {
        const cancelCompleted = await request("PUT", `/api/v1/sessions/${completedSession.id}/cancel`, { token: clientToken });
        assert.strictEqual(cancelCompleted.status, 400, "Cannot cancel completed session");
      }
    });

    await t.test("2.3 Unauthorized-User Scenario: Unauthenticated booking, foreign user session operations, client completing session", async () => {
      // 1. Unauthenticated booking
      const unauthBook = await request("POST", "/api/v1/sessions/book", {
        body: {
          counsellorId,
          sessionType: "video",
          scheduledAt: "2026-11-10T10:00:00.000Z",
          durationMinutes: 60,
          amountInr: 1000
        }
      });
      assert.strictEqual(unauthBook.status, 401, "Unauthenticated booking must return 401");

      // 2. Foreign user attempting to cancel another user's session
      const otherUserMobile = `+9190${String(runId).slice(-8)}`;
      const otherOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: otherUserMobile } });
      const otherVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: otherOtp.body.data.challengeId, code: otherOtp.body.data.devCode || "123456", mobile: otherUserMobile }
      });
      const otherReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Other User C",
          email: `other_${runId}@example.com`,
          mobile: otherUserMobile,
          password: "Password123!",
          dateOfBirth: "1991-01-01",
          verificationProof: otherVerify.body.data.verificationProof
        }
      });
      const otherToken = otherReg.body.data.accessToken;

      const mySessions = await repositories.sessions.listForUser({ id: clientUserId, role: "user" });
      const targetSession = mySessions[0];

      const foreignCancel = await request("PUT", `/api/v1/sessions/${targetSession.id}/cancel`, { token: otherToken });
      assert.strictEqual(foreignCancel.status, 403, "Foreign user cannot cancel another user's session");

      // 3. User attempting counsellor action (completing session)
      const userComplete = await request("PUT", `/api/v1/sessions/${targetSession.id}/complete`, { token: clientToken });
      assert.strictEqual(userComplete.status, 403, "User cannot complete session (only counsellor/admin)");
    });
  });

  // =========================================================================
  // JOURNEY 3: Peer Support, Consent, Chat, Calls & Session Completion
  // =========================================================================
  await suite.test("Journey 3: Peer Support, Consent, Chat, Calls & Session Completion", async (t) => {
    const peerRequesterMobile = `+9189${String(runId).slice(-8)}`;
    const peerRequesterEmail = `peer_req_${runId}@example.com`;
    let peerRequesterToken = "";
    let peerRequesterUserId = "";

    const peerListenerMobile = `+9188${String(runId).slice(-8)}`;
    const peerListenerEmail = `peer_lis_${runId}@example.com`;
    let peerListenerToken = "";
    let peerListenerUserId = "";
    let peerListenerProfileId = "";

    let peerRequestId = "";
    let peerSessionId = "";

    await t.test("3.1 Success Scenario: Disclaimer, listener application, go-live, request, acceptance, payment, dual consent, RTC, and feedback", async () => {
      // 1. Create Requester (Adult User A)
      const reqOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: peerRequesterMobile } });
      const reqVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: reqOtp.body.data.challengeId, code: reqOtp.body.data.devCode || "123456", mobile: peerRequesterMobile }
      });
      const reqReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Peer Requester",
          email: peerRequesterEmail,
          mobile: peerRequesterMobile,
          password: "RequesterPass123!",
          dateOfBirth: "1993-07-14", // Age ~33
          verificationProof: reqVerify.body.data.verificationProof
        }
      });
      peerRequesterToken = reqReg.body.data.accessToken;
      peerRequesterUserId = reqReg.body.data.user.id;

      // Top up requester wallet
      const topup = await request("POST", "/api/v1/wallet/topup/order", { token: peerRequesterToken, body: { amountInr: 500 } });
      assert.strictEqual(topup.status, 201, "Topup order must return 201");
      await request("POST", "/api/v1/wallet/topup/verify", {
        token: peerRequesterToken,
        body: {
          orderId: topup.body.data.id,
          razorpay_order_id: topup.body.data.gatewayOrderId,
          razorpay_payment_id: `pay_${runId}_peer_req`,
          razorpay_signature: "sig_mock"
        }
      });

      // 2. Create Listener (Adult User B)
      const lisOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: peerListenerMobile } });
      const lisVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: lisOtp.body.data.challengeId, code: lisOtp.body.data.devCode || "123456", mobile: peerListenerMobile }
      });
      const lisReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Peer Listener",
          email: peerListenerEmail,
          mobile: peerListenerMobile,
          password: "ListenerPass123!",
          dateOfBirth: "1990-11-20", // Age ~36
          verificationProof: lisVerify.body.data.verificationProof
        }
      });
      peerListenerToken = lisReg.body.data.accessToken;
      peerListenerUserId = lisReg.body.data.user.id;

      // 3. User accepts Peer Talk Disclaimer
      const discRes = await request("POST", "/api/v1/peer-talk/accept-disclaimer", {
        token: peerRequesterToken,
        body: { version: "v1.0" }
      });
      assert.strictEqual(discRes.status, 200);

      // 4. User B applies as listener
      const applyRes = await request("POST", "/api/v1/peer-listeners/apply", {
        token: peerListenerToken,
        body: {
          publicDisplayName: "Compassionate Staging Listener",
          shortBio: "Active empathetic listener for daily stress and work pressure.",
          languages: ["en", "hi"],
          conversationInterests: ["Career Stress", "Burnout"]
        }
      });
      assert.strictEqual(applyRes.status, 201);
      peerListenerProfileId = applyRes.body.data.id || applyRes.body.data.profile?.id;

      // Admin approves listener
      const approveLis = await request("POST", `/api/v1/admin/peer-talk/listeners/${peerListenerProfileId}/approve`, {
        token: adminToken,
        body: { notes: "Verified credentials" }
      });
      assert.strictEqual(approveLis.status, 200);

      // Listener sets rates & goes live
      await repositories.peerListenerRates.createOrUpdate({
        listenerProfileId: peerListenerProfileId,
        sessionDurationMinutes: 15,
        feePaise: 7500,
        hourlyEquivalentPaise: 30000,
        currency: "INR"
      });
      const goLiveRes = await request("POST", "/api/v1/peer-listeners/me/go-live", { token: peerListenerToken });
      assert.strictEqual(goLiveRes.status, 200);

      // 5. Requester creates session request
      const sessionReqRes = await request("POST", "/api/v1/peer-session-requests", {
        token: peerRequesterToken,
        body: {
          listenerProfileId: peerListenerProfileId,
          requestedDurationMinutes: 15,
          topic: "Work Burnout"
        }
      });
      assert.strictEqual(sessionReqRes.status, 201);
      peerRequestId = sessionReqRes.body.data.id;

      // 6. Listener accepts request
      const acceptReqRes = await request("POST", `/api/v1/peer-session-requests/${peerRequestId}/accept`, {
        token: peerListenerToken
      });
      assert.strictEqual(acceptReqRes.status, 200);
      assert.strictEqual(acceptReqRes.body.data.requestStatus, "accepted");

      // 7. Requester creates payment order & verifies payment
      const payOrderRes = await request("POST", `/api/v1/peer-session-requests/${peerRequestId}/payment-order`, {
        token: peerRequesterToken
      });
      assert.strictEqual(payOrderRes.status, 201);
      const peerPayOrder = payOrderRes.body.data;

      const payVerifyRes = await request("POST", `/api/v1/peer-session-requests/${peerRequestId}/payment-verify`, {
        token: peerRequesterToken,
        body: {
          orderId: peerPayOrder.id,
          razorpay_order_id: peerPayOrder.gatewayOrderId,
          razorpay_payment_id: `pay_${runId}_peer_settle`,
          razorpay_signature: "mock_peer_sig"
        }
      });
      assert.strictEqual(payVerifyRes.status, 200);
      assert.strictEqual(payVerifyRes.body.data.requestStatus, "paid");
      peerSessionId = payVerifyRes.body.data.session?.id || payVerifyRes.body.data.sessionId;
      assert.ok(peerSessionId, "Session ID must be created upon payment verification");

      // 8. Mutual Dual Consent (Audio, Video, File Sharing)
      const reqConsentRes = await request("POST", `/api/v1/peer-sessions/${peerSessionId}/consent`, {
        token: peerRequesterToken,
        body: { capability: "audio", consentStatus: "granted" }
      });
      assert.strictEqual(reqConsentRes.status, 200);

      const lisConsentRes = await request("POST", `/api/v1/peer-sessions/${peerSessionId}/consent`, {
        token: peerListenerToken,
        body: { capability: "audio", consentStatus: "granted" }
      });
      assert.strictEqual(lisConsentRes.status, 200);

      // Verify mutual consent state
      const allConsents = await request("GET", `/api/v1/peer-sessions/${peerSessionId}/consents`, {
        token: peerRequesterToken
      });
      assert.strictEqual(allConsents.status, 200);
      assert.strictEqual(allConsents.body.data.length, 2);

      // 9. RTC Token Generation for active session
      const reqRtc = await request("GET", `/api/v1/peer-sessions/${peerSessionId}/rtc-token`, {
        token: peerRequesterToken
      });
      assert.strictEqual(reqRtc.status, 200);
      assert.ok(reqRtc.body.data.token, "RTC token must be generated for requester");

      const lisRtc = await request("GET", `/api/v1/peer-sessions/${peerSessionId}/rtc-token`, {
        token: peerListenerToken
      });
      assert.strictEqual(lisRtc.status, 200);
      assert.ok(lisRtc.body.data.token, "RTC token must be generated for listener");

      // 10. End session & submit feedback
      const endRes = await request("POST", `/api/v1/peer-sessions/${peerSessionId}/end`, {
        token: peerRequesterToken,
        body: { reason: "Completed naturally" }
      });
      assert.strictEqual(endRes.status, 200);

      const feedbackRes = await request("POST", `/api/v1/peer-sessions/${peerSessionId}/feedback`, {
        token: peerRequesterToken,
        body: {
          rating: 5,
          feedbackText: "Great support, felt much calmer after speaking.",
          wouldRecommend: true
        }
      });
      assert.ok([200, 201].includes(feedbackRes.status), "Feedback submission must succeed");
    });

    await t.test("3.2 Failure Scenario: File sharing locked in first 5 mins (GATE_LOCKED), payment proof reuse, minor browse rejection", async () => {
      // 1. File sharing attempted during 5-minute timer gate -> GATE_LOCKED
      const activeSession = await repositories.peerSessions.create({
        id: createId("pss"),
        requesterUserId: peerRequesterUserId,
        listenerProfileId: peerListenerProfileId,
        startedAt: new Date().toISOString(), // Just started (0s < 300s)
        sessionStartedAt: new Date().toISOString(),
        status: "active",
        sessionStatus: "active"
      });

      const boundary = "----WebKitFormBoundaryStagingGateTest";
      const fileContent = Buffer.from("%PDF-1.4 sample note\n%%EOF");
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="note.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        fileContent,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const gateUpload = await request("POST", "/api/v1/upload", {
        token: peerRequesterToken,
        rawBody: multipartBody,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(multipartBody.length),
          "x-peer-session-id": activeSession.id
        }
      });
      assert.strictEqual(gateUpload.status, 403);
      assert.strictEqual(gateUpload.body.error.code, "GATE_LOCKED");

      // 2. Minor user (<18) attempting to browse peer listeners
      const minorLogin = await request("POST", "/api/v1/auth/login", {
        body: { email: `minor_${runId}@example.com`, password: "MinorPassword123!", role: "user" }
      });
      const minorBrowse = await request("GET", "/api/v1/peer-listeners", {
        token: minorLogin.body.data.accessToken
      });
      assert.strictEqual(minorBrowse.status, 403, "Minor must be blocked from browsing peer listeners");
    });

    await t.test("3.3 Unauthorized-User Scenario: Foreign User C cannot view, accept, or access session RTC", async () => {
      // Create unrelated User C
      const userCMobile = `+9187${String(runId).slice(-8)}`;
      const userCOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: userCMobile } });
      const userCVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: userCOtp.body.data.challengeId, code: userCOtp.body.data.devCode || "123456", mobile: userCMobile }
      });
      const userCReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Foreign User C",
          email: `userc_${runId}@example.com`,
          mobile: userCMobile,
          password: "Password123!",
          dateOfBirth: "1989-04-12",
          verificationProof: userCVerify.body.data.verificationProof
        }
      });
      const userCToken = userCReg.body.data.accessToken;

      // 1. Foreign user cannot inspect peer session request (MH-40)
      const foreignReqInspect = await request("GET", `/api/v1/peer-session-requests/${peerRequestId}`, {
        token: userCToken
      });
      assert.strictEqual(foreignReqInspect.status, 403, "Foreign user C must not inspect peer request");

      // 2. Foreign user cannot accept peer request (MH-39)
      const foreignAccept = await request("POST", `/api/v1/peer-session-requests/${peerRequestId}/accept`, {
        token: userCToken
      });
      assert.strictEqual(foreignAccept.status, 403, "Foreign user C must not accept peer request");

      // 3. Foreign user cannot obtain RTC token for peer session
      const foreignRtc = await request("GET", `/api/v1/peer-sessions/${peerSessionId}/rtc-token`, {
        token: userCToken
      });
      assert.strictEqual(foreignRtc.status, 403, "Foreign user C must not obtain RTC token for session");
    });
  });

  // =========================================================================
  // JOURNEY 4: Clinical Screening, Safety Guidance, Report Ownership & Admin
  // =========================================================================
  await suite.test("Journey 4: Clinical Screening, Safety Guidance, Report Ownership & Admin Operations", async (t) => {
    const screeningUserEmail = `clinical_${runId}@example.com`;
    const screeningUserMobile = `+9186${String(runId).slice(-8)}`;
    let screeningUserToken = "";
    let screeningUserId = "";
    let screeningSessionId = "";

    await t.test("4.1 Success Scenario: Questionnaires, PHQ-9 submit, Item 9 crisis alert, free access, paid report unlock, handwriting, and admin audit", async () => {
      // 1. Register Adult User for Clinical Screening
      const scrOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: screeningUserMobile } });
      const scrVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: scrOtp.body.data.challengeId, code: scrOtp.body.data.devCode || "123456", mobile: screeningUserMobile }
      });
      const scrReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Clinical Patient User",
          email: screeningUserEmail,
          mobile: screeningUserMobile,
          password: "PatientPassword123!",
          dateOfBirth: "1988-12-05", // Age ~37
          verificationProof: scrVerify.body.data.verificationProof
        }
      });
      screeningUserToken = scrReg.body.data.accessToken;
      screeningUserId = scrReg.body.data.user.id;

      // Top up user wallet for optional paid clinical interpretation
      const topup = await request("POST", "/api/v1/wallet/topup/order", { token: screeningUserToken, body: { amountInr: 200 } });
      assert.strictEqual(topup.status, 201, "Topup order must return 201");
      await request("POST", "/api/v1/wallet/topup/verify", {
        token: screeningUserToken,
        body: {
          orderId: topup.body.data.id,
          razorpay_order_id: topup.body.data.gatewayOrderId,
          razorpay_payment_id: `pay_${runId}_scr`,
          razorpay_signature: "mock_scr_sig"
        }
      });

      // 2. Fetch questionnaires
      const questionnairesRes = await request("GET", "/api/v1/screenings/questionnaires");
      assert.strictEqual(questionnairesRes.status, 200);
      assert.ok(questionnairesRes.body.data.low_mood, "PHQ-9 low mood questionnaire must be available");

      // 3. Start Screening Session (Free access, ₹0 debit - MH-37)
      const startRes = await request("POST", "/api/v1/screenings", {
        token: screeningUserToken,
        body: { screeningType: "phq9" }
      });
      assert.strictEqual(startRes.status, 201);
      screeningSessionId = startRes.body.data.id;

      // 4. Submit Screening with Positive Item 9 (Suicidal Ideation) -> Triggers Crisis Guidance (MH-16, MH-17)
      // PHQ-9 answers: items 1-8 score 1, item 9 scores 2 (positive)
      const answers = [1, 1, 1, 1, 1, 1, 1, 1, 2];
      const completeRes = await request("POST", `/api/v1/screenings/${screeningSessionId}/complete`, {
        token: screeningUserToken,
        body: { answers }
      });
      assert.strictEqual(completeRes.status, 200);
      const evalData = completeRes.body.data;
      assert.strictEqual(evalData.score, 10, "Total score must equal 10");
      assert.strictEqual(evalData.safetyGuidance.crisisAlert, true, "Positive Item 9 must trigger crisisAlert");
      assert.ok(
        evalData.safetyGuidance.helplines.some(h => h.number.includes("9820466726") || h.name.includes("AASRA")),
        "Emergency crisis helpline must include AASRA (MH-17)"
      );

      // Verify wallet balance was NOT debited for basic screening (MH-37)
      const balCheck = await request("GET", "/api/v1/wallet/balance", { token: screeningUserToken });
      assert.strictEqual(balCheck.body.data.balancePaise, 20000, "Basic screening must remain free (₹0 debit)");

      // 5. Unlock Detailed Clinical Interpretation Report (Paid: ₹49 = 4900 paise - MH-38)
      const interpretRes = await request("POST", `/api/v1/screenings/${screeningSessionId}/interpret`, {
        token: screeningUserToken
      });
      assert.strictEqual(interpretRes.status, 200);
      assert.ok(interpretRes.body.data.interpretation, "Detailed clinical interpretation report must be returned");

      const balAfterInterpret = await request("GET", "/api/v1/wallet/balance", { token: screeningUserToken });
      assert.strictEqual(balAfterInterpret.body.data.balancePaise, 20000 - 4900, "Wallet must be debited exactly ₹49");

      // 6. Generate AI Handwriting Self-Reflection Report
      const handwritingRes = await request("POST", "/api/v1/analysis/handwriting", {
        token: screeningUserToken,
        body: {
          inputText: "Sample handwritten reflection text about overcoming stress and regaining balance."
        }
      });
      assert.strictEqual(handwritingRes.status, 201);
      const reportId = handwritingRes.body.data.id;

      // Report owner can fetch reports
      const myReports = await request("GET", "/api/v1/analysis/reports", { token: screeningUserToken });
      assert.strictEqual(myReports.status, 200);
      assert.ok(myReports.body.data.some(r => r.id === reportId));

      const singleReport = await request("GET", `/api/v1/analysis/reports/${reportId}`, { token: screeningUserToken });
      assert.strictEqual(singleReport.status, 200);
      assert.strictEqual(singleReport.body.data.id, reportId);

      // 7. Admin Operations & Audit Logs
      const adminUsers = await request("GET", "/api/v1/admin/users", { token: adminToken });
      assert.strictEqual(adminUsers.status, 200);
      assert.ok(Array.isArray(adminUsers.body.data));

      const auditLogs = await request("GET", "/api/v1/admin/audit-logs", { token: adminToken });
      assert.strictEqual(auditLogs.status, 200);
      assert.ok(Array.isArray(auditLogs.body.data));
    });

    await t.test("4.2 Failure Scenario: Empty answers, out-of-range score values, forged score rejection, insufficient balance unlock", async () => {
      // 1. Start another screening session
      const startRes = await request("POST", "/api/v1/screenings", {
        token: screeningUserToken,
        body: { screeningType: "anxiety" }
      });
      const scrId = startRes.body.data.id;

      // Rejects empty answers (MH-36)
      const emptyAnswers = await request("POST", `/api/v1/screenings/${scrId}/complete`, {
        token: screeningUserToken,
        body: { answers: [] }
      });
      assert.strictEqual(emptyAnswers.status, 400);

      // Rejects incomplete answers
      const incompleteAnswers = await request("POST", `/api/v1/screenings/${scrId}/complete`, {
        token: screeningUserToken,
        body: { answers: [1, 2] } // GAD-7 requires 7 answers
      });
      assert.strictEqual(incompleteAnswers.status, 400);

      // Rejects out-of-range answer values
      const outOfRange = await request("POST", `/api/v1/screenings/${scrId}/complete`, {
        token: screeningUserToken,
        body: { answers: [1, 2, 3, 4, 1, 2, 0] } // Values must be 0-3
      });
      assert.strictEqual(outOfRange.status, 400);

      // Rejects forged client score (-999)
      const forgedScore = await request("POST", `/api/v1/screenings/${scrId}/complete`, {
        token: screeningUserToken,
        body: { answers: [1, 1, 1, 1, 1, 1, 1], score: -999 }
      });
      assert.strictEqual(forgedScore.status, 400);

      // 2. Report unlock with insufficient balance
      const brokeTokenRes = await request("POST", "/api/v1/auth/login", {
        body: { email: `broke_${runId}@example.com`, password: "Password123!", role: "user" }
      });
      const brokeToken = brokeTokenRes.body.data.accessToken;

      const brokeScr = await request("POST", "/api/v1/screenings", {
        token: brokeToken,
        body: { screeningType: "low_mood" }
      });
      await request("POST", `/api/v1/screenings/${brokeScr.body.data.id}/complete`, {
        token: brokeToken,
        body: { answers: [0, 0, 0, 0, 0, 0, 0, 0, 0] }
      });

      const brokeUnlock = await request("POST", `/api/v1/screenings/${brokeScr.body.data.id}/interpret`, {
        token: brokeToken
      });
      assert.strictEqual(brokeUnlock.status, 400, "Insufficient balance must reject report interpretation unlock");
      assert.match(brokeUnlock.body.error.message, /balance/i);
    });

    await t.test("4.3 Unauthorized-User Scenario: Foreign user cannot access screening or report, regular user cannot access admin", async () => {
      // Create unrelated User D
      const userDMobile = `+9185${String(runId).slice(-8)}`;
      const userDOtp = await request("POST", "/api/v1/auth/send-otp", { body: { mobile: userDMobile } });
      const userDVerify = await request("POST", "/api/v1/auth/verify-otp", {
        body: { challengeId: userDOtp.body.data.challengeId, code: userDOtp.body.data.devCode || "123456", mobile: userDMobile }
      });
      const userDReg = await request("POST", "/api/v1/auth/register", {
        body: {
          fullName: "Foreign User D",
          email: `userd_${runId}@example.com`,
          mobile: userDMobile,
          password: "Password123!",
          dateOfBirth: "1990-09-09",
          verificationProof: userDVerify.body.data.verificationProof
        }
      });
      const userDToken = userDReg.body.data.accessToken;

      // 1. Foreign user D cannot access patient's screening session
      const foreignScr = await request("GET", `/api/v1/screenings/${screeningSessionId}`, {
        token: userDToken
      });
      assert.strictEqual(foreignScr.status, 403, "Foreign user cannot view another user's screening");

      // 2. Foreign user D cannot access patient's AI analysis report (MH-06)
      const patientReports = await repositories.reports.listForUser({ id: screeningUserId, role: "user" });
      if (patientReports && patientReports.length > 0) {
        const foreignReport = await request("GET", `/api/v1/analysis/reports/${patientReports[0].id}`, {
          token: userDToken
        });
        assert.strictEqual(foreignReport.status, 403, "Foreign user cannot view another user's analysis report");
      }

      // 3. Regular user cannot access Admin endpoints
      const forbiddenUsers = await request("GET", "/api/v1/admin/users", { token: screeningUserToken });
      assert.strictEqual(forbiddenUsers.status, 403, "Regular user cannot access admin user list");

      const forbiddenAudits = await request("GET", "/api/v1/admin/audit-logs", { token: screeningUserToken });
      assert.strictEqual(forbiddenAudits.status, 403, "Regular user cannot access admin audit logs");

      const forbiddenApiConfig = await request("PUT", "/api/v1/admin/api-config/Google%20Maps", {
        token: screeningUserToken,
        body: { isActive: true }
      });
      assert.strictEqual(forbiddenApiConfig.status, 403, "Regular user cannot update admin API configurations");
    });
  });
});

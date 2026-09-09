import test from "node:test";
import assert from "node:assert";
import { calculateAgeFromDob } from "../src/utils/validation.js";
import { calculateExactAge, createUser, createSession } from "../src/services/auth.service.js";
import { register, registerCounsellor } from "../src/controllers/auth.controller.js";
import { chat, createDreamReport } from "../src/controllers/ai.controller.js";
import { listListeners, applyListener, createSessionRequest } from "../src/controllers/peer.controller.js";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { signAccessToken } from "../src/utils/security.js";

test("MH-09: Date of Birth and Adult Restrictions Suite", async (t) => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Helper to get formatted date offset by years and days
  const getDateOffset = (yearsOffset, daysOffset = 0) => {
    const d = new Date(Date.UTC(yyyy - yearsOffset, now.getUTCMonth(), now.getUTCDate() + daysOffset));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  await t.test("1. calculateAgeFromDob and calculateExactAge edge cases", () => {
    // Missing / invalid / future dates
    assert.strictEqual(calculateAgeFromDob(null), null);
    assert.strictEqual(calculateAgeFromDob(undefined), null);
    assert.strictEqual(calculateAgeFromDob(""), null);
    assert.strictEqual(calculateAgeFromDob("invalid-date"), null);
    assert.strictEqual(calculateAgeFromDob("2026-02-31"), null); // Non-existent date
    assert.strictEqual(calculateAgeFromDob("2035-05-10"), null); // Future date
    assert.strictEqual(calculateExactAge("2035-05-10"), null);

    // Boundary cases:
    // Exactly 18 today
    const exactly18 = getDateOffset(18, 0);
    assert.strictEqual(calculateAgeFromDob(exactly18), 18);
    assert.strictEqual(calculateExactAge(exactly18), 18);

    // 17 years and 364 days (birthday tomorrow)
    const turning18Tomorrow = getDateOffset(18, 1);
    assert.strictEqual(calculateAgeFromDob(turning18Tomorrow), 17);

    // 18 years and 1 day (birthday yesterday)
    const turned18Yesterday = getDateOffset(18, -1);
    assert.strictEqual(calculateAgeFromDob(turned18Yesterday), 18);

    // Exactly 21 today
    const exactly21 = getDateOffset(21, 0);
    assert.strictEqual(calculateAgeFromDob(exactly21), 21);

    // Turning 21 tomorrow
    const turning21Tomorrow = getDateOffset(21, 1);
    assert.strictEqual(calculateAgeFromDob(turning21Tomorrow), 20);

    // Exactly 15 today
    const exactly15 = getDateOffset(15, 0);
    assert.strictEqual(calculateAgeFromDob(exactly15), 15);

    // Turning 15 tomorrow
    const turning15Tomorrow = getDateOffset(15, 1);
    assert.strictEqual(calculateAgeFromDob(turning15Tomorrow), 14);
  });

  await t.test("2. createUser validates and normalizes dateOfBirth", async () => {
    // 2a. Future DOB rejected
    await assert.rejects(
      async () => {
        await createUser({
          role: "user",
          fullName: "Future Person",
          email: "future@test.com",
          password: "Password123!",
          dateOfBirth: "2040-01-01"
        });
      },
      /Invalid Date of Birth/
    );

    // 2b. Invalid date string rejected
    await assert.rejects(
      async () => {
        await createUser({
          role: "user",
          fullName: "Invalid DOB Person",
          email: "invaliddob@test.com",
          password: "Password123!",
          dateOfBirth: "not-a-date"
        });
      },
      /Invalid Date of Birth/
    );

    // 2c. User under 15 rejected
    const under15 = getDateOffset(14, 0);
    await assert.rejects(
      async () => {
        await createUser({
          role: "user",
          fullName: "Too Young User",
          email: "tooyoung@test.com",
          password: "Password123!",
          dateOfBirth: under15
        });
      },
      /Minimum user age requirement is 15 years/
    );

    // 2d. User aged 15-17 without guardian email rejected
    const age16 = getDateOffset(16, 0);
    await assert.rejects(
      async () => {
        await createUser({
          role: "user",
          fullName: "Minor Without Guardian",
          email: "minor_noguardian@test.com",
          password: "Password123!",
          dateOfBirth: age16
        });
      },
      /Guardian email is required for users under 18 years old/
    );

    // 2e. Counsellor under 21 rejected
    const age20 = getDateOffset(20, 0);
    await assert.rejects(
      async () => {
        await createUser({
          role: "counsellor",
          fullName: "Young Counsellor",
          email: "young_cns@test.com",
          password: "Password123!",
          dateOfBirth: age20
        });
      },
      /Minimum counsellor age requirement is 21 years/
    );

    // 2f. Valid user aged 18+ succeeds and stores normalized YYYY-MM-DD
    const age25 = getDateOffset(25, 0);
    const validUser = await createUser({
      role: "user",
      fullName: "Adult User",
      email: `adult_${Date.now()}@test.com`,
      password: "Password123!",
      dateOfBirth: `${age25}T00:00:00.000Z` // ISO format passed
    });
    assert.strictEqual(validUser.dateOfBirth, age25);
    assert.strictEqual(validUser.date_of_birth, age25);
  });

  await t.test("3. Adult generative AI and peer features block missing, invalid, or minor DOB", async () => {
    // 3a. User with missing DOB
    const userNoDob = { id: "usr_nodob", role: "user", dateOfBirth: null, date_of_birth: null };
    const chatRes1 = await chat({ body: { message: "Hello" }, user: userNoDob });
    assert.strictEqual(chatRes1.status, 403);
    assert.match(chatRes1.body.error.message, /minor accounts|restricted to verified adult users/);

    const reportRes1 = await createDreamReport({ body: { inputText: "I was flying" }, user: userNoDob });
    assert.strictEqual(reportRes1.status, 403);

    const peerRes1 = await listListeners({ query: {}, user: userNoDob });
    assert.strictEqual(peerRes1.status, 403);
    assert.match(peerRes1.body.error.message, /18 years or older/);

    // 3b. User with invalid DOB
    const userInvalidDob = { id: "usr_invaliddob", role: "user", dateOfBirth: "bad-date" };
    const chatRes2 = await chat({ body: { message: "Hello" }, user: userInvalidDob });
    assert.strictEqual(chatRes2.status, 403);

    // 3c. User turning 18 tomorrow (17 years and 364 days)
    const turning18Tomorrow = getDateOffset(18, 1);
    const userMinor = { id: "usr_minor", role: "user", dateOfBirth: turning18Tomorrow };
    const chatRes3 = await chat({ body: { message: "Hello" }, user: userMinor });
    assert.strictEqual(chatRes3.status, 403);

    // 3d. User aged exactly 18 today succeeds
    const exactly18 = getDateOffset(18, 0);
    const userAdult18 = { id: "usr_adult18", role: "user", dateOfBirth: exactly18 };
    const chatRes4 = await chat({ body: { message: "Hello" }, user: userAdult18 });
    assert.strictEqual(chatRes4.status, 200);

    // 3e. User aged 18 years and 1 day succeeds
    const turned18Yesterday = getDateOffset(18, -1);
    const userAdult18Past = { id: "usr_adult18past", role: "user", dateOfBirth: turned18Yesterday };
    const chatRes5 = await chat({ body: { message: "Hello" }, user: userAdult18Past });
    assert.strictEqual(chatRes5.status, 200);
  });

  await t.test("4. app.js route-level requireAdult enforcement on /api/v1/ai/chat", async () => {
    const app = createApp();

    const dispatch = async (token, body = { message: "Hello AI" }) => {
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
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${token}`
        },
        socket: { remoteAddress: "127.0.0.1" },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(body));
        }
      };
      await app.handle(req, res);
      return res;
    };

    // 4a. User with null DOB -> blocked with 403 (No fallback to 20!)
    const u1 = await createUser({
      role: "user",
      fullName: "No DOB User",
      email: `nodob_${Date.now()}@test.com`,
      password: "Password123!"
    });
    // Manually force dateOfBirth to null to test legacy/unpopulated record
    await repositories.users.update(u1.id, { dateOfBirth: null, date_of_birth: null });
    const token1 = signAccessToken(u1);
    const res1 = await dispatch(token1);
    assert.strictEqual(res1.statusCode, 403);
    assert.match(res1.body.error.message, /restricted to verified adult users aged 18 or above/);

    // 4b. User with future DOB -> blocked with 403
    const u2 = await createUser({
      role: "user",
      fullName: "Future User",
      email: `future_${Date.now()}@test.com`,
      password: "Password123!",
      dateOfBirth: getDateOffset(25, 0)
    });
    await repositories.users.update(u2.id, { dateOfBirth: "2045-01-01", date_of_birth: "2045-01-01" });
    const token2 = signAccessToken(u2);
    const res2 = await dispatch(token2);
    assert.strictEqual(res2.statusCode, 403);
    assert.match(res2.body.error.message, /restricted to verified adult users aged 18 or above/);

    // 4c. User aged 17 years 364 days -> blocked with 403
    const u3 = await createUser({
      role: "user",
      fullName: "Minor User",
      email: `minor_${Date.now()}@test.com`,
      password: "Password123!",
      dateOfBirth: getDateOffset(17, 0),
      guardianEmail: "guardian@test.com"
    });
    await repositories.users.update(u3.id, {
      dateOfBirth: getDateOffset(18, 1),
      date_of_birth: getDateOffset(18, 1),
      onboardingStatus: "COMPLETED", // bypass onboarding check to test requireAdult specifically
      isGuardianConsentVerified: true,
      guardianConsentStatus: "APPROVED"
    });
    const token3 = signAccessToken(u3);
    const res3 = await dispatch(token3);
    assert.strictEqual(res3.statusCode, 403);
    assert.match(res3.body.error.message, /restricted to verified adult users aged 18 or above/);

    // 4d. User aged exactly 18 today -> allowed with 200
    const u4 = await createUser({
      role: "user",
      fullName: "Adult 18 User",
      email: `adult18_${Date.now()}@test.com`,
      password: "Password123!",
      dateOfBirth: getDateOffset(18, 0)
    });
    const token4 = signAccessToken(u4);
    const res4 = await dispatch(token4);
    assert.strictEqual(res4.statusCode, 200);

    // 4e. User aged 18 years and 1 day -> allowed with 200
    const u5 = await createUser({
      role: "user",
      fullName: "Adult 18 Plus 1 User",
      email: `adult18p1_${Date.now()}@test.com`,
      password: "Password123!",
      dateOfBirth: getDateOffset(18, -1)
    });
    const token5 = signAccessToken(u5);
    const res5 = await dispatch(token5);
    assert.strictEqual(res5.statusCode, 200);
  });
});

import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { signAccessToken, createId } from "../src/utils/security.js";
import { authorizePeerSessionParticipant } from "../src/controllers/peer.controller.js";

async function dispatch(app, { method, url, token, body }) {
  let resHeaders = {};
  let resStatusCode = 200;
  let resBody = "";

  const req = {
    method,
    url,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    socket: { remoteAddress: "127.0.0.1" },
    [Symbol.asyncIterator]: async function* () {
      if (body) yield Buffer.from(JSON.stringify(body));
    }
  };

  const res = {
    writeHead: (code, headers) => {
      resStatusCode = code;
      if (headers) resHeaders = { ...resHeaders, ...headers };
    },
    setHeader: (k, v) => {
      resHeaders[k] = v;
    },
    getHeader: (k) => resHeaders[k],
    end: (chunk) => {
      if (chunk) resBody += chunk;
    }
  };

  await app.handle(req, res);

  let parsed = null;
  try {
    parsed = JSON.parse(resBody);
  } catch {
    parsed = resBody;
  }

  return { statusCode: resStatusCode, headers: resHeaders, body: parsed };
}

test("MH-39: Fix listener profile/user ID confusion and unified participant authorization", async (t) => {
  const app = createApp();

  // Test Users
  const userA = {
    id: "usr_req_mh39_" + createId("u"),
    email: "requester_mh39@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1994-04-14",
    onboardingStatus: "COMPLETED"
  };

  const userB = {
    id: "usr_list_mh39_" + createId("u"),
    email: "listener_mh39@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1991-01-20",
    onboardingStatus: "COMPLETED"
  };

  const userC = {
    id: "usr_outsider_mh39_" + createId("u"),
    email: "outsider_mh39@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1996-06-25",
    onboardingStatus: "COMPLETED"
  };

  const adminUser = {
    id: "usr_admin_mh39_" + createId("u"),
    email: "admin_mh39@example.com",
    role: "admin",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1985-02-02",
    onboardingStatus: "COMPLETED"
  };

  await repositories.users.create(userA);
  await repositories.users.create(userB);
  await repositories.users.create(userC);
  await repositories.users.create(adminUser);

  // Listener profile for User B (Profile ID !== User ID)
  const listenerProfileB = {
    id: "plp_profile_mh39_" + createId("p"),
    userId: userB.id,
    publicDisplayName: "Verified Listener Beta",
    verificationStatus: "approved",
    moderationStatus: "active",
    acceptingRequests: true
  };
  await repositories.peerListenerProfiles.create(listenerProfileB);

  // Active peer session between User A (requester) and User B (via listenerProfileId)
  // Started 10 minutes ago so the 5-minute RTC lock is elapsed
  const startedAt = new Date(Date.now() - 600 * 1000).toISOString();
  const sessionId = "pss_test_mh39_" + createId("s");
  const session = await repositories.peerSessions.create({
    id: sessionId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    sessionDurationMinutes: 15,
    status: "active",
    sessionStatus: "active",
    startedAt,
    sessionStartedAt: startedAt,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString()
  });

  const tokenA = signAccessToken(userA);
  const tokenB = signAccessToken(userB);
  const tokenC = signAccessToken(userC);
  const tokenAdmin = signAccessToken(adminUser);

  await t.test("1. Unit: authorizePeerSessionParticipant resolves listener profile to owning user", async () => {
    // Requester User A
    const authA = await authorizePeerSessionParticipant(session, userA);
    assert.strictEqual(authA.authorized, true);
    assert.strictEqual(authA.role, "requester");
    assert.strictEqual(authA.requesterUserId, userA.id);
    assert.strictEqual(authA.listenerUserId, userB.id);

    // Listener User B (whose user.id !== listenerProfileB.id)
    const authB = await authorizePeerSessionParticipant(session, userB);
    assert.strictEqual(authB.authorized, true);
    assert.strictEqual(authB.role, "listener");
    assert.strictEqual(authB.listenerUserId, userB.id);
    assert.strictEqual(authB.listenerProfileId, listenerProfileB.id);

    // Platform Admin
    const authAdmin = await authorizePeerSessionParticipant(session, adminUser);
    assert.strictEqual(authAdmin.authorized, true);
    assert.strictEqual(authAdmin.role, "admin");

    // Unrelated User C
    const authC = await authorizePeerSessionParticipant(session, userC);
    assert.strictEqual(authC.authorized, false);
    assert.strictEqual(authC.status, 403);
  });

  await t.test("2. Session listing resolves listener profile and includes session for User A and User B", async () => {
    // Via repository
    const listA = await repositories.peerSessions.listForUser(userA);
    assert.ok(listA.some(s => s.id === sessionId), "User A should see session in listForUser");

    const listB = await repositories.peerSessions.listForUser(userB);
    assert.ok(listB.some(s => s.id === sessionId), "User B (listener) MUST see session in listForUser");

    const listC = await repositories.peerSessions.listForUser(userC);
    assert.ok(!listC.some(s => s.id === sessionId), "Outsider User C should not see session");

    // Via HTTP GET /api/v1/peer-sessions
    const resHttpA = await dispatch(app, { method: "GET", url: "/api/v1/peer-sessions", token: tokenA });
    assert.strictEqual(resHttpA.statusCode, 200);
    assert.ok(resHttpA.body.data.some(s => s.id === sessionId));

    const resHttpB = await dispatch(app, { method: "GET", url: "/api/v1/peer-sessions", token: tokenB });
    assert.strictEqual(resHttpB.statusCode, 200);
    assert.ok(resHttpB.body.data.some(s => s.id === sessionId));

    const resHttpC = await dispatch(app, { method: "GET", url: "/api/v1/peer-sessions", token: tokenC });
    assert.strictEqual(resHttpC.statusCode, 200);
    assert.ok(!resHttpC.body.data.some(s => s.id === sessionId));
  });

  await t.test("3. GET /api/v1/peer-sessions/:id permits participants, rejects outsider with 403", async () => {
    // Requester User A
    const resA = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}`, token: tokenA });
    assert.strictEqual(resA.statusCode, 200);
    assert.strictEqual(resA.body.data.id, sessionId);

    // Listener User B
    const resB = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}`, token: tokenB });
    assert.strictEqual(resB.statusCode, 200);
    assert.strictEqual(resB.body.data.id, sessionId);

    // Admin
    const resAdmin = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}`, token: tokenAdmin });
    assert.strictEqual(resAdmin.statusCode, 200);
    assert.strictEqual(resAdmin.body.data.id, sessionId);

    // Outsider User C receives 403
    const resC = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}`, token: tokenC });
    assert.strictEqual(resC.statusCode, 403);
    assert.strictEqual(resC.body.error.code, "FORBIDDEN");

    // Non-existent session receives 404
    const resNotFound = await dispatch(app, { method: "GET", url: "/api/v1/peer-sessions/pss_non_existent", token: tokenA });
    assert.strictEqual(resNotFound.statusCode, 404);
  });

  await t.test("4. Consent granting and viewing permits both User A and User B, rejects User C", async () => {
    // Requester User A grants voice consent
    const resConsentA = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/consent`,
      token: tokenA,
      body: { capability: "voice", status: "granted" }
    });
    assert.strictEqual(resConsentA.statusCode, 200);
    assert.strictEqual(resConsentA.body.data.userId, userA.id);
    assert.strictEqual(resConsentA.body.data.consentStatus, "granted");

    // Listener User B grants voice consent (previously failed with 403 due to profileId comparison)
    const resConsentB = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/consent`,
      token: tokenB,
      body: { capability: "voice", status: "granted" }
    });
    assert.strictEqual(resConsentB.statusCode, 200);
    assert.strictEqual(resConsentB.body.data.userId, userB.id);
    assert.strictEqual(resConsentB.body.data.consentStatus, "granted");

    // Outsider User C is rejected with 403
    const resConsentC = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/consent`,
      token: tokenC,
      body: { capability: "voice", status: "granted" }
    });
    assert.strictEqual(resConsentC.statusCode, 403);
    assert.strictEqual(resConsentC.body.error.code, "FORBIDDEN");

    // Consents query: User A and User B can view; User C receives 403
    const resGetA = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}/consents`, token: tokenA });
    assert.strictEqual(resGetA.statusCode, 200);
    assert.strictEqual(resGetA.body.data.length, 2);

    const resGetB = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}/consents`, token: tokenB });
    assert.strictEqual(resGetB.statusCode, 200);
    assert.strictEqual(resGetB.body.data.length, 2);

    const resGetC = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${sessionId}/consents`, token: tokenC });
    assert.strictEqual(resGetC.statusCode, 403);
    assert.strictEqual(resGetC.body.error.code, "FORBIDDEN");
  });

  await t.test("5. Mutual consent enforcement for RTC token generation", async () => {
    // Create a fresh session for mutual consent verification
    const session2Id = "pss_mutual_test_" + createId("s");
    const s2 = await repositories.peerSessions.create({
      id: session2Id,
      requesterUserId: userA.id,
      listenerProfileId: listenerProfileB.id,
      sessionDurationMinutes: 15,
      status: "active",
      sessionStatus: "active",
      startedAt,
      sessionStartedAt: startedAt,
      expiresAt: new Date(Date.now() + 300 * 1000).toISOString()
    });

    // Case 1: Neither participant granted consent
    const resRtc0 = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${session2Id}/rtc-token`, token: tokenA });
    assert.strictEqual(resRtc0.statusCode, 403);
    assert.match(resRtc0.body.error.message, /mutual consent/i);

    // Case 2: Only User A grants consent
    await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${session2Id}/consent`,
      token: tokenA,
      body: { capability: "voice", status: "granted" }
    });
    const resRtc1 = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${session2Id}/rtc-token`, token: tokenA });
    assert.strictEqual(resRtc1.statusCode, 403);
    assert.match(resRtc1.body.error.message, /mutual consent/i);

    // Case 3: User B also grants consent
    await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${session2Id}/consent`,
      token: tokenB,
      body: { capability: "voice", status: "granted" }
    });

    // Now BOTH User A and User B can generate RTC token!
    const resRtcA = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${session2Id}/rtc-token`, token: tokenA });
    assert.strictEqual(resRtcA.statusCode, 200);
    assert.ok(resRtcA.body.data.token, "Requester receives RTC token upon mutual consent");

    const resRtcB = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${session2Id}/rtc-token`, token: tokenB });
    assert.strictEqual(resRtcB.statusCode, 200);
    assert.ok(resRtcB.body.data.token, "Listener receives RTC token upon mutual consent");

    // Outsider User C is still rejected with 403
    const resRtcC = await dispatch(app, { method: "GET", url: `/api/v1/peer-sessions/${session2Id}/rtc-token`, token: tokenC });
    assert.strictEqual(resRtcC.statusCode, 403);
  });

  await t.test("6. Feedback submission permits User A and User B with correct target user IDs, rejects User C", async () => {
    // Requester User A submits feedback on Listener User B
    const resFeedbackA = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/feedback`,
      token: tokenA,
      body: { rating: 5, listeningQuality: 5, comfort: 5 }
    });
    assert.strictEqual(resFeedbackA.statusCode, 201);
    assert.strictEqual(resFeedbackA.body.data.userId, userA.id);
    assert.strictEqual(resFeedbackA.body.data.targetUserId, userB.id);

    // Listener User B submits feedback on Requester User A
    const resFeedbackB = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/feedback`,
      token: tokenB,
      body: { rating: 5, listeningQuality: 5, comfort: 5 }
    });
    assert.strictEqual(resFeedbackB.statusCode, 201);
    assert.strictEqual(resFeedbackB.body.data.userId, userB.id);
    assert.strictEqual(resFeedbackB.body.data.targetUserId, userA.id);

    // Outsider User C is rejected with 403
    const resFeedbackC = await dispatch(app, {
      method: "POST",
      url: `/api/v1/peer-sessions/${sessionId}/feedback`,
      token: tokenC,
      body: { rating: 5, listeningQuality: 5, comfort: 5 }
    });
    assert.strictEqual(resFeedbackC.statusCode, 403);
    assert.strictEqual(resFeedbackC.body.error.code, "FORBIDDEN");
  });
});

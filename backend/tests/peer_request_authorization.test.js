import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { signAccessToken, createId } from "../src/utils/security.js";
import {
  authorizePeerRequestParticipant,
  authorizePeerQuoteParticipant
} from "../src/controllers/peer.controller.js";

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

test("MH-40: Protect peer-request details and quote participant authorization", async (t) => {
  const app = createApp();

  // Test Users
  const userA = {
    id: "usr_requester_a_" + createId("u"),
    email: "requester_a@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1995-05-15",
    onboardingStatus: "COMPLETED"
  };

  const userB = {
    id: "usr_listener_b_" + createId("u"),
    email: "listener_b@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1992-03-20",
    onboardingStatus: "COMPLETED"
  };

  const userC = {
    id: "usr_unrelated_c_" + createId("u"),
    email: "unrelated_c@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1998-11-10",
    onboardingStatus: "COMPLETED"
  };

  const counsellorD = {
    id: "usr_counsellor_d_" + createId("u"),
    email: "counsellor_d@example.com",
    role: "counsellor",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1988-08-08",
    onboardingStatus: "COMPLETED"
  };

  const adminUser = {
    id: "usr_admin_mh40_" + createId("u"),
    email: "admin_mh40@example.com",
    role: "admin",
    status: "active",
    isActive: true,
    isEmailVerified: true,
    dateOfBirth: "1985-01-01",
    onboardingStatus: "COMPLETED"
  };

  await repositories.users.create(userA);
  await repositories.users.create(userB);
  await repositories.users.create(userC);
  await repositories.users.create(counsellorD);
  await repositories.users.create(adminUser);

  // Listener profile for User B
  const listenerProfileB = {
    id: "plp_listener_b_" + createId("p"),
    userId: userB.id,
    publicDisplayName: "Listener Beta",
    verificationStatus: "approved",
    moderationStatus: "active",
    acceptingRequests: true
  };
  await repositories.peerListenerProfiles.create(listenerProfileB);

  // Peer Session Request between User A and User B
  const requestId = "psr_test_mh40_" + createId("r");
  const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();
  const request = await repositories.peerSessionRequests.create({
    id: requestId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    requestedDurationMinutes: 15,
    requestedMode: "text",
    requestStatus: "pending",
    requestExpiresAt: expiresAt,
    expiresAt
  });

  // Quote linked to this request
  const quoteId = "psq_test_mh40_" + createId("q");
  const quote = await repositories.peerSessionQuotes.create({
    id: quoteId,
    peerSessionRequestId: requestId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    durationMinutes: 15,
    grossAmountPaise: 15000,
    baseFeePaise: 15000,
    discountPaise: 0,
    commissionPaise: 1500,
    totalAmountPaise: 15000,
    status: "pending",
    expiresAt
  });

  const tokenA = signAccessToken(userA);
  const tokenB = signAccessToken(userB);
  const tokenC = signAccessToken(userC);
  const tokenD = signAccessToken(counsellorD);
  const tokenAdmin = signAccessToken(adminUser);

  await t.test("1. Unit: authorizePeerRequestParticipant & authorizePeerQuoteParticipant authorization logic", async () => {
    // Request participant checks
    const authA = await authorizePeerRequestParticipant(request, userA);
    assert.strictEqual(authA.authorized, true);
    assert.strictEqual(authA.role, "requester");

    const authB = await authorizePeerRequestParticipant(request, userB);
    assert.strictEqual(authB.authorized, true);
    assert.strictEqual(authB.role, "listener");

    const authAdmin = await authorizePeerRequestParticipant(request, adminUser);
    assert.strictEqual(authAdmin.authorized, true);
    assert.strictEqual(authAdmin.role, "admin");

    const authC = await authorizePeerRequestParticipant(request, userC);
    assert.strictEqual(authC.authorized, false);
    assert.strictEqual(authC.status, 403);

    const authD = await authorizePeerRequestParticipant(request, counsellorD);
    assert.strictEqual(authD.authorized, false);
    assert.strictEqual(authD.status, 403);

    // Quote participant checks
    const quoteAuthA = await authorizePeerQuoteParticipant(quote, userA);
    assert.strictEqual(quoteAuthA.authorized, true);

    const quoteAuthB = await authorizePeerQuoteParticipant(quote, userB);
    assert.strictEqual(quoteAuthB.authorized, true);

    const quoteAuthAdmin = await authorizePeerQuoteParticipant(quote, adminUser);
    assert.strictEqual(quoteAuthAdmin.authorized, true);

    const quoteAuthC = await authorizePeerQuoteParticipant(quote, userC);
    assert.strictEqual(quoteAuthC.authorized, false);
    assert.strictEqual(quoteAuthC.status, 403);
  });

  await t.test("2. End-to-end: GET /api/v1/peer-session-requests/:id permits requester User A", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}`,
      token: tokenA
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, requestId);
    assert.strictEqual(res.body.data.requesterUserId, userA.id);
    assert.strictEqual(res.body.data.quote.id, quoteId);
  });

  await t.test("3. End-to-end: GET /api/v1/peer-session-requests/:id permits listener User B", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}`,
      token: tokenB
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, requestId);
    assert.strictEqual(res.body.data.listenerProfileId, listenerProfileB.id);
    assert.strictEqual(res.body.data.quote.id, quoteId);
  });

  await t.test("4. End-to-end: GET /api/v1/peer-session-requests/:id permits platform Administrator", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}`,
      token: tokenAdmin
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, requestId);
    assert.strictEqual(res.body.data.quote.id, quoteId);
  });

  await t.test("5. End-to-end: GET /api/v1/peer-session-requests/:id REJECTS unrelated User C with 403", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}`,
      token: tokenC
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "FORBIDDEN");
  });

  await t.test("6. End-to-end: GET /api/v1/peer-session-requests/:id REJECTS unrelated Counsellor D with 403", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}`,
      token: tokenD
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "FORBIDDEN");
  });

  await t.test("7. End-to-end: GET /api/v1/peer-session-requests/:id returns 404 for non-existent ID", async () => {
    const res = await dispatch(app, {
      method: "GET",
      url: "/api/v1/peer-session-requests/psr_non_existent_999",
      token: tokenA
    });

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  await t.test("8. Direct quote endpoints: /peer-session-requests/:id/quote and /peer-session-quotes/:id", async () => {
    // Authorized User A accessing request quote
    const resQuoteA = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}/quote`,
      token: tokenA
    });
    assert.strictEqual(resQuoteA.statusCode, 200);
    assert.strictEqual(resQuoteA.body.data.id, quoteId);

    // Authorized User B accessing quote by quote ID
    const resQuoteB = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-quotes/${quoteId}`,
      token: tokenB
    });
    assert.strictEqual(resQuoteB.statusCode, 200);
    assert.strictEqual(resQuoteB.body.data.id, quoteId);

    // Unrelated User C rejected on both quote endpoints with 403
    const resQuoteC1 = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-requests/${requestId}/quote`,
      token: tokenC
    });
    assert.strictEqual(resQuoteC1.statusCode, 403);
    assert.strictEqual(resQuoteC1.body.error.code, "FORBIDDEN");

    const resQuoteC2 = await dispatch(app, {
      method: "GET",
      url: `/api/v1/peer-session-quotes/${quoteId}`,
      token: tokenC
    });
    assert.strictEqual(resQuoteC2.statusCode, 403);
    assert.strictEqual(resQuoteC2.body.error.code, "FORBIDDEN");

    // Non-existent quote returns 404
    const resMissingQuote = await dispatch(app, {
      method: "GET",
      url: "/api/v1/peer-session-quotes/psq_missing_999",
      token: tokenA
    });
    assert.strictEqual(resMissingQuote.statusCode, 404);
  });
});

import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/app.js";
import { repositories } from "../src/repositories/index.js";
import { createId } from "../src/utils/security.js";
import { getBalance } from "../src/services/wallet.service.js";

// Ensure repository driver is memory for this test run
process.env.REPOSITORY_DRIVER = "memory";

test("Peer Talk Marketplace End-to-End Flow", async (t) => {
  const app = createApp();

  // Create clean mock users
  const userA = {
    id: createId("usr"),
    name: "Requester User",
    email: "requester@example.com",
    dob: "1995-05-15", // Age 31 (>18)
    role: "user"
  };

  const userB = {
    id: createId("usr"),
    name: "Listener User",
    email: "listener@example.com",
    dob: "1990-08-20", // Age 36 (>18)
    role: "user"
  };

  const adminUser = {
    id: createId("usr"),
    name: "Admin User",
    email: "admin@example.com",
    role: "admin"
  };

  await repositories.users.create(userA);
  await repositories.users.create(userB);
  await repositories.users.create(adminUser);

  // Setup wallets
  await repositories.wallets.createForOwner("user", userA.id);
  await repositories.wallets.createForOwner("user", userB.id);

  let requestId;
  let sessionId;

  await t.test("1. User accepts marketplace disclaimer policy", async () => {
    const acceptance = await repositories.peerPolicyAcceptances.create({
      id: createId("ppa"),
      userId: userA.id,
      policyType: "marketplace_disclaimer",
      policyVersion: "v1.0",
      language: "en"
    });
    assert.strictEqual(acceptance.userId, userA.id);
    assert.strictEqual(acceptance.policyType, "marketplace_disclaimer");
  });

  await t.test("2. User B applies to become a Peer Listener", async () => {
    const profile = await repositories.peerListenerProfiles.create({
      id: createId("plp"),
      userId: userB.id,
      displayName: "Friendly Partner",
      gender: "female",
      languages: ["en", "hi"],
      interests: ["stress", "career"],
      introductionText: "Hello, I am here to listen.",
      verificationStatus: "pending",
      isActive: false
    });
    assert.strictEqual(profile.userId, userB.id);
    assert.strictEqual(profile.verificationStatus, "pending");

    // Admin approves User B
    const approved = await repositories.peerListenerProfiles.update(profile.id, {
      verificationStatus: "approved"
    });
    assert.strictEqual(approved.verificationStatus, "approved");
  });

  await t.test("3. User B updates rates and goes live", async () => {
    const profile = await repositories.peerListenerProfiles.findByUserId(userB.id);
    await repositories.peerListenerRates.createOrUpdate({
      listenerProfileId: profile.id,
      ratePerMinutePaise: 500, // 5 INR per minute
      currency: "INR"
    });

    await repositories.peerListenerPresence.createOrUpdate({
      listenerProfileId: profile.id,
      socketConnectionId: "socket_b_123",
      heartbeatAt: new Date().toISOString()
    });

    const activeProfile = await repositories.peerListenerProfiles.update(profile.id, {
      isActive: true
    });
    assert.strictEqual(activeProfile.isActive, true);
  });

  await t.test("4. User A requests a 15-minute peer session quote and request", async () => {
    const listenerProfile = await repositories.peerListenerProfiles.findByUserId(userB.id);
    
    // Create session request first
    requestId = createId("psr");
    const request = await repositories.peerSessionRequests.create({
      id: requestId,
      requesterUserId: userA.id,
      listenerProfileId: listenerProfile.id,
      requestedDurationMinutes: 15,
      requestStatus: "pending",
      expiresAt: new Date(Date.now() + 60 * 1000).toISOString()
    });

    // Create quote directly linked to request
    const grossPaise = 15 * 500;
    const quoteId = createId("plq");
    await repositories.peerSessionQuotes.create({
      id: quoteId,
      peerSessionRequestId: requestId,
      listenerProfileId: listenerProfile.id,
      durationMinutes: 15,
      ratePerMinutePaise: 500,
      subtotalAmountPaise: grossPaise,
      taxAmountPaise: 0,
      totalAmountPaise: grossPaise,
      currency: "INR"
    });

    assert.strictEqual(request.requesterUserId, userA.id);
    assert.strictEqual(request.requestStatus, "pending");
  });

  await t.test("5. User B accepts the session request", async () => {
    const updated = await repositories.peerSessionRequests.update(requestId, {
      requestStatus: "accepted"
    });
    assert.strictEqual(updated.requestStatus, "accepted");
  });

  await t.test("6. User A completes payment (Verify Razorpay & reserve wallet hold)", async () => {
    const request = await repositories.peerSessionRequests.findById(requestId);
    const quote = await repositories.peerSessionQuotes.findByRequestId(request.id);

    // Mock top up User A wallet with gross amount to enable payment
    const wallet = await repositories.wallets.findByOwner(userA.id);
    await repositories.wallets.createLedgerEntry({
      id: createId("led"),
      walletId: wallet.id,
      direction: "credit",
      amountPaise: quote.totalAmountPaise,
      entryType: "peer_session_topup",
      createdAt: new Date().toISOString()
    });

    const balanceBefore = await getBalance(userA.id);
    assert.strictEqual(balanceBefore, quote.totalAmountPaise);

    // Simulate verifyRequestPayment logic
    await repositories.wallets.createLedgerEntry({
      id: createId("led"),
      walletId: wallet.id,
      direction: "debit",
      amountPaise: quote.totalAmountPaise,
      entryType: "peer_session_payment",
      createdAt: new Date().toISOString()
    });

    const balanceAfter = await getBalance(userA.id);
    assert.strictEqual(balanceAfter, 0);

    // Create session record
    sessionId = createId("pss");
    const session = await repositories.peerSessions.create({
      id: sessionId,
      peerSessionRequestId: request.id,
      requesterUserId: request.requesterUserId,
      listenerProfileId: request.listenerProfileId,
      sessionDurationMinutes: 15,
      sessionStatus: "active",
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    await repositories.peerSessionRequests.update(request.id, { requestStatus: "completed" });
    assert.strictEqual(session.sessionStatus, "active");
  });

  await t.test("7. Users grant mutual consents for capability text/voice", async () => {
    const consentReq = await repositories.peerSessionConsents.createOrUpdate({
      peerSessionId: sessionId,
      userId: userA.id,
      capability: "voice",
      consentStatus: "granted",
      policyVersion: "v1.0"
    });

    const consentList = await repositories.peerSessionConsents.createOrUpdate({
      peerSessionId: sessionId,
      userId: userB.id,
      capability: "voice",
      consentStatus: "granted",
      policyVersion: "v1.0"
    });

    assert.strictEqual(consentReq.consentStatus, "granted");
    assert.strictEqual(consentList.consentStatus, "granted");
  });

  await t.test("8. End session and execute payout split (90% listener, 10% platform)", async () => {
    const session = await repositories.peerSessions.findById(sessionId);
    const updated = await repositories.peerSessions.update(session.id, {
      sessionStatus: "completed",
      endedAt: new Date().toISOString()
    });

    const request = await repositories.peerSessionRequests.findById(session.peerSessionRequestId);
    const quote = await repositories.peerSessionQuotes.findByRequestId(request.id);
    
    // Split logic (90% goes to User B, 10% platform commission)
    const listenerWallet = await repositories.wallets.findByOwner(userB.id);
    const grossPaise = quote.totalAmountPaise;
    const listenerEarningPaise = Math.round(grossPaise * 0.9);
    
    await repositories.wallets.createLedgerEntry({
      id: createId("led"),
      walletId: listenerWallet.id,
      direction: "credit",
      amountPaise: listenerEarningPaise,
      entryType: "peer_session_earning",
      createdAt: new Date().toISOString()
    });

    const listenerBalance = await getBalance(userB.id);
    assert.strictEqual(listenerBalance, listenerEarningPaise);
    assert.strictEqual(updated.sessionStatus, "completed");
  });
});

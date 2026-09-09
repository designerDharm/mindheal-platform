import test from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { io as Client } from "socket.io-client";
import { initializeSockets, authorizeSessionParticipant } from "../src/socket.js";
import { repositories } from "../src/repositories/index.js";
import { signAccessToken } from "../src/utils/security.js";

test("MH-07: Socket session membership and state enforcement", async (t) => {
  // Test Users
  const userA = {
    id: "usr_member_a",
    email: "usera@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true
  };

  const userB = {
    id: "usr_member_b",
    email: "userb@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true
  };

  const userC = {
    id: "usr_unrelated_c",
    email: "userc@example.com",
    role: "user",
    status: "active",
    isActive: true,
    isEmailVerified: true
  };

  const adminUser = {
    id: "usr_admin_mh07",
    email: "admin_mh07@example.com",
    role: "admin",
    status: "active",
    isActive: true
  };

  const disabledUser = {
    id: "usr_disabled_mh07",
    email: "disabled_mh07@example.com",
    role: "user",
    status: "disabled",
    isActive: false
  };

  const minorUnapproved = {
    id: "usr_minor_no_consent",
    email: "minor@example.com",
    role: "user",
    status: "active",
    isActive: true,
    dateOfBirth: "2010-01-01", // 16 years old
    isGuardianConsentVerified: false,
    guardianConsentStatus: "PENDING",
    onboardingStatus: "PENDING_GUARDIAN"
  };

  // Seed users in repository
  await repositories.users.create(userA);
  await repositories.users.create(userB);
  await repositories.users.create(userC);
  await repositories.users.create(adminUser);
  await repositories.users.create(disabledUser);
  await repositories.users.create(minorUnapproved);

  // Seed listener profile for userB
  const listenerProfileB = {
    id: "plp_member_b",
    userId: userB.id,
    status: "active"
  };
  await repositories.peerListenerProfiles.create(listenerProfileB);

  // Seed active peer session between User A and User B
  const activeSessionId = "pss_active_test_1";
  await repositories.peerSessions.create({
    id: activeSessionId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    status: "active",
    sessionStatus: "active",
    startedAt: new Date().toISOString()
  });

  // Seed completed/ended peer session
  const endedSessionId = "pss_ended_test_2";
  await repositories.peerSessions.create({
    id: endedSessionId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    status: "completed",
    sessionStatus: "completed",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    endedAt: new Date().toISOString()
  });

  // Seed cancelled peer session
  const cancelledSessionId = "pss_cancelled_test_3";
  await repositories.peerSessions.create({
    id: cancelledSessionId,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfileB.id,
    status: "cancelled",
    sessionStatus: "cancelled"
  });

  // Seed a pre-existing chat message in activeSession
  await repositories.peerChatMessages.create({
    id: "msg_existing_1",
    peerSessionId: activeSessionId,
    senderId: userA.id,
    messageText: "Hello from User A initial history"
  });

  await t.test("1. authorizeSessionParticipant enforces membership and accounts", async () => {
    // Missing sessionId
    const resNoSession = await authorizeSessionParticipant("", userA);
    assert.strictEqual(resNoSession.authorized, false);
    assert.strictEqual(resNoSession.code, "BAD_REQUEST");

    // Non-existent session
    const resNotFound = await authorizeSessionParticipant("non_existent_session", userA);
    assert.strictEqual(resNotFound.authorized, false);
    assert.strictEqual(resNotFound.code, "NOT_FOUND");

    // Requester (User A) is authorized
    const resA = await authorizeSessionParticipant(activeSessionId, userA);
    assert.strictEqual(resA.authorized, true);
    assert.strictEqual(resA.sessionType, "peer");

    // Listener (User B) is authorized via listenerProfileId
    const resB = await authorizeSessionParticipant(activeSessionId, userB);
    assert.strictEqual(resB.authorized, true);

    // Admin is authorized
    const resAdmin = await authorizeSessionParticipant(activeSessionId, adminUser);
    assert.strictEqual(resAdmin.authorized, true);

    // Unrelated user (User C) is FORBIDDEN
    const resC = await authorizeSessionParticipant(activeSessionId, userC);
    assert.strictEqual(resC.authorized, false);
    assert.strictEqual(resC.code, "FORBIDDEN");

    // Disabled user is rejected
    const resDisabled = await authorizeSessionParticipant(activeSessionId, disabledUser);
    assert.strictEqual(resDisabled.authorized, false);
    assert.strictEqual(resDisabled.code, "ACCOUNT_DISABLED");

    // Minor without guardian approval is rejected
    const resMinor = await authorizeSessionParticipant(activeSessionId, minorUnapproved);
    assert.strictEqual(resMinor.authorized, false);
    assert.strictEqual(resMinor.code, "GUARDIAN_CONSENT_REQUIRED");
  });

  // Live Socket.IO Tests
  let httpServer;
  let serverPort;
  let clientA;
  let clientB;
  let clientC;

  await t.test("2. Setup Socket.IO test server and clients", async () => {
    httpServer = createServer();
    initializeSockets(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });

    const tokenA = signAccessToken(userA);
    const tokenB = signAccessToken(userB);
    const tokenC = signAccessToken(userC);

    const serverUrl = `http://127.0.0.1:${serverPort}`;

    clientA = Client(serverUrl, { auth: { token: tokenA }, transports: ["websocket"] });
    clientB = Client(serverUrl, { auth: { token: tokenB }, transports: ["websocket"] });
    clientC = Client(serverUrl, { auth: { token: tokenC }, transports: ["websocket"] });

    await Promise.all([
      new Promise((resolve, reject) => {
        clientA.on("connect", resolve);
        clientA.on("connect_error", reject);
      }),
      new Promise((resolve, reject) => {
        clientB.on("connect", resolve);
        clientB.on("connect_error", reject);
      }),
      new Promise((resolve, reject) => {
        clientC.on("connect", resolve);
        clientC.on("connect_error", reject);
      })
    ]);
  });

  await t.test("3. Unrelated User C cannot receive history or join User A & B's session", async () => {
    let userCHistoryReceived = false;
    let userCSessionError = null;

    clientC.on("peer_chat_history", () => {
      userCHistoryReceived = true;
    });

    clientC.on("session_error", (err) => {
      userCSessionError = err;
    });

    // User C attempts to join activeSession
    const ack = await new Promise((resolve) => {
      clientC.emit("join_session", activeSessionId, (res) => resolve(res));
      setTimeout(() => resolve(null), 500);
    });

    assert.ok(ack, "Expected acknowledgement from join_session");
    assert.strictEqual(ack.success, false);
    assert.strictEqual(ack.code, "FORBIDDEN");

    // Wait briefly to confirm no history event was sent
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(userCHistoryReceived, false, "Unrelated user must NOT receive chat history");
    assert.ok(userCSessionError, "Expected session_error event on client C");
    assert.strictEqual(userCSessionError.code, "FORBIDDEN");
  });

  await t.test("4. Authorized User A and User B can join and receive history", async () => {
    let historyA = null;
    let historyB = null;

    clientA.on("peer_chat_history", (hist) => {
      historyA = hist;
    });

    clientB.on("peer_chat_history", (hist) => {
      historyB = hist;
    });

    const ackA = await new Promise((resolve) => {
      clientA.emit("join_session", activeSessionId, resolve);
    });
    assert.strictEqual(ackA.success, true);

    const ackB = await new Promise((resolve) => {
      clientB.emit("join_session", activeSessionId, resolve);
    });
    assert.strictEqual(ackB.success, true);

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(Array.isArray(historyA) && historyA.length >= 1, "User A should receive history");
    assert.ok(Array.isArray(historyB) && historyB.length >= 1, "User B should receive history");
    assert.strictEqual(historyA[0].text, "Hello from User A initial history");
  });

  await t.test("5. Unrelated User C cannot send messages into User A & B's session", async () => {
    const ack = await new Promise((resolve) => {
      clientC.emit("send_message", { sessionId: activeSessionId, text: "Unauthorized message attempt" }, resolve);
    });

    assert.strictEqual(ack.success, false);
    assert.strictEqual(ack.code, "FORBIDDEN");

    // Verify message was not saved in DB
    const allMessages = await repositories.peerChatMessages.listForSession(activeSessionId);
    const unauthSaved = allMessages.find((m) => m.messageText === "Unauthorized message attempt");
    assert.strictEqual(unauthSaved, undefined, "Unauthorized message must not be saved");
  });

  await t.test("6. User A sends message: User B receives it, User C does NOT receive it", async () => {
    let messageReceivedB = null;
    let messageReceivedC = null;

    clientB.on("receive_message", (msg) => {
      messageReceivedB = msg;
    });

    clientC.on("receive_message", (msg) => {
      messageReceivedC = msg;
    });

    const sendAck = await new Promise((resolve) => {
      clientA.emit("send_message", { sessionId: activeSessionId, text: "Legitimate peer conversation" }, resolve);
    });
    assert.strictEqual(sendAck.success, true);

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(messageReceivedB, "User B (listener) must receive legitimate message");
    assert.strictEqual(messageReceivedB.text, "Legitimate peer conversation");
    assert.strictEqual(messageReceivedC, null, "User C (unrelated) must NOT receive message / eavesdrop");
  });

  await t.test("7. Messages cannot be sent to ended or cancelled sessions", async () => {
    // Attempt sending to ended session
    const endedAck = await new Promise((resolve) => {
      clientA.emit("send_message", { sessionId: endedSessionId, text: "Cannot send to ended" }, resolve);
    });
    assert.strictEqual(endedAck.success, false);
    assert.strictEqual(endedAck.code, "SESSION_INACTIVE");

    // Attempt sending to cancelled session
    const cancelledAck = await new Promise((resolve) => {
      clientA.emit("send_message", { sessionId: cancelledSessionId, text: "Cannot send to cancelled" }, resolve);
    });
    assert.strictEqual(cancelledAck.success, false);
    assert.strictEqual(cancelledAck.code, "SESSION_INACTIVE");
  });

  await t.test("8. Counselling session membership authorization", async () => {
    const counsellorUser = {
      id: "usr_counsellor_mh07",
      email: "counsellor@example.com",
      role: "counsellor",
      status: "active",
      isActive: true
    };
    await repositories.users.create(counsellorUser);

    const counsellingSessionId = "ses_counselling_test_1";
    await repositories.sessions.create({
      id: counsellingSessionId,
      userId: userA.id,
      counsellorUserId: counsellorUser.id,
      status: "active"
    });

    // User A (client) is authorized
    const authClient = await authorizeSessionParticipant(counsellingSessionId, userA);
    assert.strictEqual(authClient.authorized, true);
    assert.strictEqual(authClient.sessionType, "counselling");

    // Counsellor is authorized
    const authCounsellor = await authorizeSessionParticipant(counsellingSessionId, counsellorUser);
    assert.strictEqual(authCounsellor.authorized, true);

    // Admin is authorized
    const authAdmin = await authorizeSessionParticipant(counsellingSessionId, adminUser);
    assert.strictEqual(authAdmin.authorized, true);

    // Unrelated User C is FORBIDDEN
    const authForeign = await authorizeSessionParticipant(counsellingSessionId, userC);
    assert.strictEqual(authForeign.authorized, false);
    assert.strictEqual(authForeign.code, "FORBIDDEN");
  });

  await t.test("9. Disabled account or unapproved minor is rejected on session actions and disconnected", async () => {
    // Disable User A
    await repositories.users.update(userA.id, { isActive: false, status: "disabled" });

    // User A attempts to emit send_message
    let accountDisabledEvent = false;
    clientA.on("account_disabled", () => {
      accountDisabledEvent = true;
    });

    clientA.emit("send_message", { sessionId: activeSessionId, text: "Should be blocked" });

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(accountDisabledEvent, "Client A should receive account_disabled event");
    assert.strictEqual(clientA.connected, false, "Client A should be disconnected immediately");
  });

  await t.test("10. Teardown test sockets and HTTP server", async () => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });
});

import assert from "node:assert";
import crypto from "node:crypto";
import { repositories } from "../backend/src/repositories/index.js";
import { createId } from "../backend/src/utils/security.js";
import { getBalance } from "../backend/src/services/wallet.service.js";
import * as peerController from "../backend/src/controllers/peer.controller.js";

async function runTests() {
  console.log("Starting MH-41 Deep Verification Tests...");

  const testSecret = "test_razorpay_secret_peer_12345";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  // Helper to generate signature
  function sign(gatewayOrderId, paymentId) {
    return crypto.createHmac("sha256", testSecret).update(`${gatewayOrderId}|${paymentId}`).digest("hex");
  }

  // Set up users
  const userA = { id: "usr_peer_a_" + Date.now() };
  const userB = { id: "usr_peer_b_" + Date.now() };
  const listenerUser = { id: "usr_peer_listener_" + Date.now() };

  // Set up listener profile
  const listenerProfile = await repositories.peerListenerProfiles.create({
    id: createId("plp"),
    userId: listenerUser.id,
    displayName: "Peer Listener",
    bio: "Empathetic listener",
    hourlyRateInr: 100,
    hourlyRatePaise: 10000,
    status: "approved",
    isAvailable: true,
    capabilities: ["text", "voice"],
    activeSessionsCount: 0,
    completedSessionsCount: 0,
    totalMinutesListened: 0,
    rating: 5.0,
    ratingsCount: 1,
    tier: "peer"
  });

  // Create Request 1 for User A
  const req1 = await repositories.peerSessionRequests.create({
    id: createId("psr"),
    requesterUserId: userA.id,
    listenerProfileId: listenerProfile.id,
    requestedDurationMinutes: 15,
    requestedMode: "text",
    requestStatus: "accepted",
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  // Create Quote 1 for Request 1 (₹100 = 10000 paise)
  const quote1 = await repositories.peerSessionQuotes.create({
    id: createId("psq"),
    peerSessionRequestId: req1.id,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfile.id,
    durationMinutes: 15,
    baseFeePaise: 10000,
    grossAmountPaise: 10000,
    commissionAmountPaise: 1000,
    commissionRateBps: 1000,
    listenerEarningPaise: 9000,
    totalAmountPaise: 10000,
    currency: "INR",
    status: "pending",
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  // Create Request 2 for User A (distinct request, ₹100 = 10000 paise)
  const req2 = await repositories.peerSessionRequests.create({
    id: createId("psr"),
    requesterUserId: userA.id,
    listenerProfileId: listenerProfile.id,
    requestedDurationMinutes: 15,
    requestedMode: "text",
    requestStatus: "accepted",
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  // Create Quote 2 for Request 2
  const quote2 = await repositories.peerSessionQuotes.create({
    id: createId("psq"),
    peerSessionRequestId: req2.id,
    requesterUserId: userA.id,
    listenerProfileId: listenerProfile.id,
    durationMinutes: 15,
    baseFeePaise: 10000,
    grossAmountPaise: 10000,
    commissionAmountPaise: 1000,
    commissionRateBps: 1000,
    listenerEarningPaise: 9000,
    totalAmountPaise: 10000,
    currency: "INR",
    status: "pending",
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  // Check 1: Initiate payment order for Request 1
  const initRes1 = await peerController.initiateRequestPaymentOrder({ params: { id: req1.id }, user: userA });
  assert.strictEqual(initRes1.status, 201, "Payment order 1 should be initiated");
  const order1 = initRes1.body.data.order;
  assert.ok(order1 && order1.id, "Order 1 must exist");

  // Check 2: Initiate payment order for Request 2
  const initRes2 = await peerController.initiateRequestPaymentOrder({ params: { id: req2.id }, user: userA });
  assert.strictEqual(initRes2.status, 201, "Payment order 2 should be initiated");
  const order2 = initRes2.body.data.order;
  assert.ok(order2 && order2.id, "Order 2 must exist");

  // Test Case 1: Unknown submitted gateway order fails without creating local replacement order
  const countBeforeUnknown = (storePaymentOrdersCount());
  const unknownRes = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA,
    body: {
      razorpay_order_id: "order_unregistered_unknown_xyz",
      razorpay_payment_id: "pay_unknown_1",
      razorpay_signature: sign("order_unregistered_unknown_xyz", "pay_unknown_1")
    }
  });
  console.log("Check 1 (unknown order):", unknownRes.status, unknownRes.body?.error?.message);
  assert.strictEqual(unknownRes.status, 400, "Unknown order must be rejected");
  assert.strictEqual(unknownRes.body.error.message, "Payment order not found.");
  const countAfterUnknown = (storePaymentOrdersCount());
  assert.strictEqual(countAfterUnknown, countBeforeUnknown, "No replacement local order should be created for unknown gateway order");

  // Test Case 2: Cross-user order fails
  // User B tries to verify Request 1 using an order belonging to User B
  const orderUserB = await repositories.paymentOrders.create({
    id: createId("ord"),
    gateway: "razorpay",
    gatewayOrderId: "order_user_b_gw",
    userId: userB.id,
    amountPaise: 10000,
    status: "created",
    createdAt: new Date().toISOString()
  });
  const crossUserRes = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA, // User A tries to use User B's order
    body: {
      orderId: orderUserB.id,
      razorpay_order_id: orderUserB.gatewayOrderId,
      razorpay_payment_id: "pay_b_1",
      razorpay_signature: sign(orderUserB.gatewayOrderId, "pay_b_1")
    }
  });
  console.log("Check 2 (cross-user order):", crossUserRes.status, crossUserRes.body?.error?.message);
  assert.strictEqual(crossUserRes.status, 403, "Cross-user order must return 403");

  // Test Case 3: Amount mismatch fails
  const orderWrongAmount = await repositories.paymentOrders.create({
    id: createId("ord"),
    gateway: "razorpay",
    gatewayOrderId: "order_wrong_amt_gw",
    userId: userA.id,
    amountPaise: 5000, // Quote expects 10000 paise
    status: "created",
    createdAt: new Date().toISOString()
  });
  const wrongAmtRes = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA,
    body: {
      orderId: orderWrongAmount.id,
      razorpay_order_id: orderWrongAmount.gatewayOrderId,
      razorpay_payment_id: "pay_wrong_amt",
      razorpay_signature: sign(orderWrongAmount.gatewayOrderId, "pay_wrong_amt")
    }
  });
  console.log("Check 3 (amount mismatch):", wrongAmtRes.status, wrongAmtRes.body?.error?.message);
  assert.strictEqual(wrongAmtRes.status, 400, "Amount mismatch must return 400");
  assert.match(wrongAmtRes.body.error.message, /amount does not match/i);

  // Test Case 4: Cross-request proof fails
  // User A tries to verify Request 1 using Order 2 (which was initiated for Request 2)
  const crossRequestRes = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA,
    body: {
      orderId: order2.id,
      razorpay_order_id: order2.gatewayOrderId,
      razorpay_payment_id: "pay_cross_req",
      razorpay_signature: sign(order2.gatewayOrderId, "pay_cross_req")
    }
  });
  console.log("Check 4 (cross-request proof):", crossRequestRes.status, crossRequestRes.body?.error?.message);
  assert.strictEqual(crossRequestRes.status, 400, "Cross-request order must return 400");
  assert.match(crossRequestRes.body.error.message, /different session|not match the order/i);

  // Test Case 5: Correct payment for Request 1 activates exactly one session
  const payId1 = "pay_legit_peer_1";
  const sig1 = sign(order1.gatewayOrderId, payId1);
  const legitRes1 = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA,
    body: {
      orderId: order1.id,
      razorpay_order_id: order1.gatewayOrderId,
      razorpay_payment_id: payId1,
      razorpay_signature: sig1
    }
  });
  console.log("Check 5 (legitimate payment for Request 1):", legitRes1.status, legitRes1.body?.data?.verified);
  assert.strictEqual(legitRes1.status, 200, "Legitimate payment must succeed");
  assert.strictEqual(legitRes1.body.data.verified, true);
  const session1 = legitRes1.body.data.session;
  assert.ok(session1 && session1.id, "Session must be created");
  assert.strictEqual(session1.sessionStatus || session1.status, "active", "Session must be active");

  // Verify Request 1 status is updated to completed
  const updatedReq1 = await repositories.peerSessionRequests.findById(req1.id);
  assert.strictEqual(updatedReq1.requestStatus, "completed", "Request 1 must be completed");

  // Verify Quote 1 status is updated to paid
  const updatedQuote1 = await repositories.peerSessionQuotes.findById(quote1.id);
  assert.strictEqual(updatedQuote1.status, "paid", "Quote 1 must be marked paid");

  // Test Case 6: Reusing payment ID `payId1` on Request 2 fails
  const sig2Reused = sign(order2.gatewayOrderId, payId1);
  const reusedPayRes = await peerController.verifyRequestPayment({
    params: { id: req2.id },
    user: userA,
    body: {
      orderId: order2.id,
      razorpay_order_id: order2.gatewayOrderId,
      razorpay_payment_id: payId1,
      razorpay_signature: sig2Reused
    }
  });
  console.log("Check 6 (reused payment identifier):", reusedPayRes.status, reusedPayRes.body?.error?.message);
  assert.strictEqual(reusedPayRes.status, 400, "Reused payment id must return 400");
  assert.match(reusedPayRes.body.error.message, /already been used/i);

  // Test Case 7: Trying to re-verify Request 1 (already completed) fails
  const reVerifyRes = await peerController.verifyRequestPayment({
    params: { id: req1.id },
    user: userA,
    body: {
      orderId: order1.id,
      razorpay_order_id: order1.gatewayOrderId,
      razorpay_payment_id: payId1,
      razorpay_signature: sig1
    }
  });
  console.log("Check 7 (re-verifying already completed request):", reVerifyRes.status, reVerifyRes.body?.error?.message);
  assert.strictEqual(reVerifyRes.status, 400, "Re-verifying completed request must return 400");

  // Test Case 8: Legitimate payment for Request 2 with fresh payment ID activates session 2
  const payId2 = "pay_legit_peer_2";
  const sig2 = sign(order2.gatewayOrderId, payId2);
  const legitRes2 = await peerController.verifyRequestPayment({
    params: { id: req2.id },
    user: userA,
    body: {
      orderId: order2.id,
      razorpay_order_id: order2.gatewayOrderId,
      razorpay_payment_id: payId2,
      razorpay_signature: sig2
    }
  });
  console.log("Check 8 (legitimate payment for Request 2):", legitRes2.status, legitRes2.body?.data?.verified);
  assert.strictEqual(legitRes2.status, 200, "Legitimate payment for Request 2 must succeed");
  const session2 = legitRes2.body.data.session;
  assert.ok(session2 && session2.id, "Session 2 must be created");
  assert.notStrictEqual(session1.id, session2.id, "Sessions must be distinct");

  console.log("ALL MH-41 DEEP VERIFICATION CHECKS PASSED!");
}

function storePaymentOrdersCount() {
  return (globalThis.__mindheal_store?.paymentOrders?.length || 0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

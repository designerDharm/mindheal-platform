import assert from "node:assert";
import crypto from "node:crypto";
import { repositories } from "../backend/src/repositories/index.js";
import { createId } from "../backend/src/utils/security.js";
import { getBalance, settlePaidPaymentOrder } from "../backend/src/services/wallet.service.js";
import { initiateTopup, verifyTopup, paymentWebhook } from "../backend/src/controllers/wallet.controller.js";

async function runTests() {
  console.log("Starting MH-19 Deep Verification Tests (Concurrent & Repeated Payment Settlement)...");

  const testSecret = "test_razorpay_secret_mh19";
  const webhookSecret = "test_webhook_secret_mh19";
  process.env.RAZORPAY_KEY_SECRET = testSecret;
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  function sign(gatewayOrderId, paymentId) {
    return crypto.createHmac("sha256", testSecret).update(`${gatewayOrderId}|${paymentId}`).digest("hex");
  }

  function signWebhook(rawPayload) {
    return crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
  }

  // -------------------------------------------------------------
  // Test 1: In-Memory Simultaneous verifyTopup + paymentWebhook race
  // -------------------------------------------------------------
  console.log("\n--- Test 1: In-Memory Simultaneous verifyTopup + paymentWebhook race ---");
  const user1 = { id: "usr_simul_" + Date.now() };
  const initRes1 = await initiateTopup({ body: { amountInr: 250 }, user: user1 });
  assert.strictEqual(initRes1.status, 201);
  const order1 = initRes1.body.data;
  const payId1 = "pay_race_" + Date.now();
  const sig1 = sign(order1.gatewayOrderId, payId1);

  const webhookPayload1 = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: payId1,
          order_id: order1.gatewayOrderId,
          amount: 25000,
          currency: "INR",
          status: "captured"
        }
      }
    }
  };
  const rawBody1 = JSON.stringify(webhookPayload1);
  const webhookSig1 = signWebhook(rawBody1);

  // Fire 10 simultaneous requests in parallel (5 browser verifies + 5 webhooks)
  const concurrentCalls = [
    verifyTopup({ user: user1, body: { orderId: order1.id, razorpay_order_id: order1.gatewayOrderId, razorpay_payment_id: payId1, razorpay_signature: sig1 } }),
    paymentWebhook({ body: webhookPayload1, req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } } }),
    verifyTopup({ user: user1, body: { orderId: order1.id, razorpay_order_id: order1.gatewayOrderId, razorpay_payment_id: payId1, razorpay_signature: sig1 } }),
    paymentWebhook({ body: webhookPayload1, req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } } }),
    verifyTopup({ user: user1, body: { orderId: order1.id, razorpay_order_id: order1.gatewayOrderId, razorpay_payment_id: payId1, razorpay_signature: sig1 } }),
    paymentWebhook({ body: webhookPayload1, req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } } }),
    verifyTopup({ user: user1, body: { orderId: order1.id, razorpay_order_id: order1.gatewayOrderId, razorpay_payment_id: payId1, razorpay_signature: sig1 } }),
    paymentWebhook({ body: webhookPayload1, req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } } }),
    verifyTopup({ user: user1, body: { orderId: order1.id, razorpay_order_id: order1.gatewayOrderId, razorpay_payment_id: payId1, razorpay_signature: sig1 } }),
    paymentWebhook({ body: webhookPayload1, req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } } })
  ];

  const results = await Promise.all(concurrentCalls);
  for (let i = 0; i < results.length; i++) {
    assert.strictEqual(results[i].status, 200, `Call ${i} must return HTTP 200`);
  }

  // Check wallet balance
  const balance1 = await getBalance(user1.id);
  console.log("User balance after 10 simultaneous requests:", balance1, "paise (expected: 25000)");
  assert.strictEqual(balance1, 25000, "Wallet balance must be credited exactly once (25000 paise)");

  // Check ledger entries for this user
  const wallet1 = await repositories.wallets.findByOwner(user1.id);
  const entries1 = await repositories.wallets.ledgerEntries(wallet1.id);
  const creditEntries1 = entries1.filter(e => e.referenceId === order1.id);
  console.log("Ledger credit entries count for order:", creditEntries1.length);
  assert.strictEqual(creditEntries1.length, 1, "Exactly one ledger credit entry must exist for the payment order");

  // -------------------------------------------------------------
  // Test 2: Repeated Webhook Deliveries
  // -------------------------------------------------------------
  console.log("\n--- Test 2: Repeated Webhook Deliveries ---");
  for (let repeat = 1; repeat <= 5; repeat++) {
    const repeatRes = await paymentWebhook({
      body: webhookPayload1,
      req: { rawBody: rawBody1, headers: { "x-razorpay-signature": webhookSig1 } }
    });
    assert.strictEqual(repeatRes.status, 200);
  }
  const balanceAfterRepeats = await getBalance(user1.id);
  assert.strictEqual(balanceAfterRepeats, 25000, "Balance must remain unchanged after 5 repeated webhooks");

  console.log("\nALL IN-MEMORY MH-19 VERIFICATION CHECKS PASSED!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

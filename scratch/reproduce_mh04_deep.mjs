import assert from "node:assert";
import crypto from "node:crypto";
import { repositories } from "../backend/src/repositories/index.js";
import { verifyTopup, initiateTopup } from "../backend/src/controllers/wallet.controller.js";
import { getBalance } from "../backend/src/services/wallet.service.js";

async function runTests() {
  console.log("Starting MH-04 Deep Verification Tests...");

  const testSecret = "test_razorpay_secret_12345";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  // Create two distinct users
  const userA = { id: "usr_alice_" + Date.now() };
  const userB = { id: "usr_bob_" + Date.now() };

  // Helper to generate a valid signature for a given gatewayOrderId and paymentId
  function sign(gatewayOrderId, paymentId) {
    return crypto.createHmac("sha256", testSecret).update(`${gatewayOrderId}|${paymentId}`).digest("hex");
  }

  // 1. User A initiates topup
  const orderARes = await initiateTopup({ body: { amountInr: 100 }, user: userA });
  const orderA = orderARes.body.data;
  assert.ok(orderA && orderA.id, "Order A must be created");

  // 2. User B initiates topup
  const orderBRes = await initiateTopup({ body: { amountInr: 50 }, user: userB });
  const orderB = orderBRes.body.data;
  assert.ok(orderB && orderB.id, "Order B must be created");

  console.log("Order A created:", orderA.id, "GatewayOrder:", orderA.gatewayOrderId);
  console.log("Order B created:", orderB.id, "GatewayOrder:", orderB.gatewayOrderId);

  // Test Case 1: Unrelated order proof attack
  // Attacker (User B) tries to credit Order B using Order A's gateway order ID and signature
  const payIdA = "pay_proof_alice_01";
  const sigA = sign(orderA.gatewayOrderId, payIdA);

  const attack1 = await verifyTopup({
    user: userB,
    body: {
      orderId: orderB.id,
      razorpay_order_id: orderA.gatewayOrderId, // mismatch with Order B's stored gatewayOrderId
      razorpay_payment_id: payIdA,
      razorpay_signature: sigA
    }
  });
  console.log("Attack 1 (mismatched gateway_order_id):", attack1.status, attack1.body?.error?.message);
  assert.strictEqual(attack1.status, 400, "Must reject mismatched gateway order id");
  assert.match(attack1.body.error.message, /match this order's gateway order/i);

  // Test Case 2: Cross-user attack without orderId (passing only Order A's gateway_order_id as User B)
  const attack2 = await verifyTopup({
    user: userB,
    body: {
      razorpay_order_id: orderA.gatewayOrderId,
      razorpay_payment_id: payIdA,
      razorpay_signature: sigA
    }
  });
  console.log("Attack 2 (verifying another user's order):", attack2.status, attack2.body?.error?.message);
  assert.strictEqual(attack2.status, 403, "Must return 403 when order belongs to different user");

  // Test Case 3: Legitimate payment for Order A succeeds
  const legitA = await verifyTopup({
    user: userA,
    body: {
      orderId: orderA.id,
      razorpay_order_id: orderA.gatewayOrderId,
      razorpay_payment_id: payIdA,
      razorpay_signature: sigA
    }
  });
  console.log("Legitimate Order A verification:", legitA.status, legitA.body?.data?.verified);
  assert.strictEqual(legitA.status, 200, "Legitimate verification must succeed");
  assert.strictEqual(legitA.body.data.verified, true);
  const balanceA = await getBalance(userA.id);
  assert.strictEqual(balanceA, 10000, "Alice's wallet balance must be 10000 paise (Rs 100)");

  // Test Case 4: Replay attack (reusing payment ID `payIdA` on Order B)
  // Even if attacker generates a signature for (Order B, payIdA), payIdA is already used by Order A!
  const sigBReplay = sign(orderB.gatewayOrderId, payIdA);
  const attack4 = await verifyTopup({
    user: userB,
    body: {
      orderId: orderB.id,
      razorpay_order_id: orderB.gatewayOrderId,
      razorpay_payment_id: payIdA,
      razorpay_signature: sigBReplay
    }
  });
  console.log("Attack 4 (reused payment identifier):", attack4.status, attack4.body?.error?.message);
  assert.strictEqual(attack4.status, 400, "Must reject already used payment identifier");
  assert.match(attack4.body.error.message, /already been used/i);
  const balanceBAfterAttack = await getBalance(userB.id);
  assert.strictEqual(balanceBAfterAttack, 0, "Bob's balance must remain 0 after failed attack");

  // Test Case 5: Forged / Invalid signature on Order B
  const attack5 = await verifyTopup({
    user: userB,
    body: {
      orderId: orderB.id,
      razorpay_order_id: orderB.gatewayOrderId,
      razorpay_payment_id: "pay_fresh_bob_01",
      razorpay_signature: "invalid_tampered_signature"
    }
  });
  console.log("Attack 5 (invalid signature):", attack5.status, attack5.body?.error?.message);
  assert.strictEqual(attack5.status, 400, "Must reject invalid signature");
  assert.match(attack5.body.error.message, /invalid payment signature/i);

  // Test Case 6: Legitimate payment for Order B with fresh payment id succeeds
  const payIdB = "pay_fresh_bob_02";
  const sigB = sign(orderB.gatewayOrderId, payIdB);
  const legitB = await verifyTopup({
    user: userB,
    body: {
      orderId: orderB.id,
      razorpay_order_id: orderB.gatewayOrderId,
      razorpay_payment_id: payIdB,
      razorpay_signature: sigB
    }
  });
  console.log("Legitimate Order B verification:", legitB.status, legitB.body?.data?.verified);
  assert.strictEqual(legitB.status, 200, "Legitimate verification for Bob must succeed");
  const balanceB = await getBalance(userB.id);
  assert.strictEqual(balanceB, 5000, "Bob's wallet balance must be 5000 paise (Rs 50)");

  // Test Case 7: Double spend on already paid Order A with a different payment ID
  const attack7 = await verifyTopup({
    user: userA,
    body: {
      orderId: orderA.id,
      razorpay_order_id: orderA.gatewayOrderId,
      razorpay_payment_id: "pay_fresh_alice_02",
      razorpay_signature: sign(orderA.gatewayOrderId, "pay_fresh_alice_02")
    }
  });
  console.log("Attack 7 (double-settle already paid order with new payment id):", attack7.status, attack7.body?.error?.message);
  assert.strictEqual(attack7.status, 400, "Must reject settling already paid order with different payment id");

  // Test Case 8: Idempotent re-verify of Order A with same payment ID returns ok without double crediting
  const idempA = await verifyTopup({
    user: userA,
    body: {
      orderId: orderA.id,
      razorpay_order_id: orderA.gatewayOrderId,
      razorpay_payment_id: payIdA,
      razorpay_signature: sigA
    }
  });
  console.log("Idempotent re-verification Order A:", idempA.status, idempA.body?.data?.alreadyPaid);
  assert.strictEqual(idempA.status, 200);
  const balanceAFinal = await getBalance(userA.id);
  assert.strictEqual(balanceAFinal, 10000, "Alice's balance must NOT be credited twice");

  console.log("ALL MH-04 DEEP VERIFICATION CHECKS PASSED!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

import assert from "node:assert";
import crypto from "node:crypto";
import pg from "../backend/node_modules/pg/lib/index.js";

process.env.REPOSITORY_DRIVER = "postgres";
process.env.DATABASE_URL = "postgresql:///mindheal?host=/tmp";
process.env.RAZORPAY_KEY_SECRET = "test_pg_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_pg_webhook_secret";

const { repositories } = await import("../backend/src/repositories/index.js");
const { initiateTopup, verifyTopup, paymentWebhook } = await import("../backend/src/controllers/wallet.controller.js");
const { getBalance } = await import("../backend/src/services/wallet.service.js");
const { createId } = await import("../backend/src/utils/security.js");

async function runPgTest() {
  console.log("Running MH-19 PostgreSQL Concurrency Test...");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const userId = createId("usr_pg_conc");
  const email = `test_pg_${Date.now()}@example.com`;

  // Insert user into PostgreSQL
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId, email, "hash_dummy", "Postgres Concurrency User", "user", true]
  );

  const user = { id: userId };

  function sign(gatewayOrderId, paymentId) {
    return crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${gatewayOrderId}|${paymentId}`).digest("hex");
  }

  function signWebhook(rawPayload) {
    return crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawPayload).digest("hex");
  }

  // 1. Initiate Top-up for ₹150 (15000 paise)
  const initRes = await initiateTopup({ body: { amountInr: 150 }, user });
  assert.strictEqual(initRes.status, 201);
  const order = initRes.body.data;
  assert.ok(order && order.id);

  const paymentId = "pay_pg_race_" + Date.now();
  const signature = sign(order.gatewayOrderId, paymentId);

  const webhookPayload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: order.gatewayOrderId,
          amount: 15000,
          currency: "INR",
          status: "captured"
        }
      }
    }
  };
  const rawBody = JSON.stringify(webhookPayload);
  const webhookSig = signWebhook(rawBody);

  // 2. Fire 10 simultaneous requests against PostgreSQL concurrently
  console.log("Firing 10 simultaneous requests against PostgreSQL...");
  const parallelCalls = [
    verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
    paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
    verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
    paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
    verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
    paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
    verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
    paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
    verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
    paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } })
  ];

  const results = await Promise.all(parallelCalls);
  for (let i = 0; i < results.length; i++) {
    assert.strictEqual(results[i].status, 200, `Call ${i} failed with status ${results[i].status}`);
  }

  // 3. Verify in PostgreSQL directly:
  // Check ledger_entries count for this order
  const ledgerQuery = await pool.query(
    "SELECT * FROM ledger_entries WHERE reference_id = $1",
    [order.id]
  );
  console.log("PostgreSQL ledger_entries rows for order:", ledgerQuery.rows.length);
  assert.strictEqual(ledgerQuery.rows.length, 1, "Exactly ONE ledger entry must exist in PostgreSQL");
  assert.strictEqual(Number(ledgerQuery.rows[0].amount_paise), 15000);

  // Check user wallet balance in PostgreSQL
  const balance = await getBalance(userId);
  console.log("PostgreSQL balance for user:", balance, "paise (expected: 15000)");
  assert.strictEqual(balance, 15000, "Balance must be exactly 15000 paise in PostgreSQL");

  // 4. Repeated webhooks against PostgreSQL
  for (let repeat = 1; repeat <= 3; repeat++) {
    const repeatRes = await paymentWebhook({
      body: webhookPayload,
      req: { rawBody, headers: { "x-razorpay-signature": webhookSig } }
    });
    assert.strictEqual(repeatRes.status, 200);
  }

  const finalBalance = await getBalance(userId);
  assert.strictEqual(finalBalance, 15000, "Balance must remain 15000 after repeated webhooks in PostgreSQL");

  const finalLedgerQuery = await pool.query(
    "SELECT COUNT(*) FROM ledger_entries WHERE reference_id = $1",
    [order.id]
  );
  assert.strictEqual(Number(finalLedgerQuery.rows[0].count), 1, "Row count must remain 1 in PostgreSQL");

  await pool.end();
  console.log("MH-19 POSTGRESQL CONCURRENCY TEST PASSED!");
}

runPgTest().catch(err => {
  console.error("PostgreSQL test failed:", err);
  process.exit(1);
});

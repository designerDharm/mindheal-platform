import test from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature } from "../src/services/wallet.service.js";
import { appConfig } from "../src/config/app.js";

test("wallet service payment gateway", async (t) => {
  await t.test("uses Razorpay mock mode outside production when keys are missing", async () => {
    const previousEnv = appConfig.env;
    appConfig.env = "development";

    try {
      const order = await createRazorpayOrder(50000, "receipt_1");
      assert.match(order.id, /^order_mock_/);
      assert.strictEqual(verifyRazorpaySignature("order_1", "pay_1", "bad-signature"), true);
      assert.strictEqual(verifyWebhookSignature("{}", "bad-signature"), true);
    } finally {
      appConfig.env = previousEnv;
    }
  });

  await t.test("fails closed in production when Razorpay is not configured", async () => {
    const previousEnv = appConfig.env;
    appConfig.env = "production";

    try {
      await assert.rejects(
        () => createRazorpayOrder(50000, "receipt_1"),
        /Razorpay is not configured/
      );
      assert.strictEqual(verifyRazorpaySignature("order_1", "pay_1", "bad-signature"), false);
      assert.strictEqual(verifyWebhookSignature("{}", "bad-signature"), false);
    } finally {
      appConfig.env = previousEnv;
    }
  });

  await t.test("verifies webhook HMAC when a webhook secret is configured", async () => {
    const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const secret = "webhook_secret_for_service_tests";
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    try {
      assert.strictEqual(verifyWebhookSignature(rawBody, validSignature), true);
      assert.strictEqual(verifyWebhookSignature(rawBody, "bad-signature"), false);
      assert.strictEqual(verifyWebhookSignature(JSON.stringify({ event: "payment.failed" }), validSignature), false);
    } finally {
      if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
    }
  });

  await t.test("settlePaidPaymentOrder is idempotent and creates exactly one credit under concurrent execution", async () => {
    const { repositories } = await import("../src/repositories/index.js");
    const { settlePaidPaymentOrder, getBalance } = await import("../src/services/wallet.service.js");
    const userId = "usr_concurrent_test_" + Date.now();
    const orderId = "ord_concurrent_test_" + Date.now();
    const paymentId = "pay_concurrent_test_" + Date.now();

    const order = {
      id: orderId,
      gateway: "razorpay",
      gatewayOrderId: "order_gw_" + Date.now(),
      userId,
      amountPaise: 50000,
      status: "created",
      createdAt: new Date().toISOString()
    };

    await repositories.paymentOrders.create(order);

    // Fire 5 concurrent settlements for the exact same order
    const results = await Promise.all([
      settlePaidPaymentOrder(order, paymentId),
      settlePaidPaymentOrder(order, paymentId),
      settlePaidPaymentOrder(order, paymentId),
      settlePaidPaymentOrder(order, paymentId),
      settlePaidPaymentOrder(order, paymentId)
    ]);

    // All must complete successfully
    assert.strictEqual(results.length, 5);

    // Balance must be exactly 50000 paise
    const balance = await getBalance(userId);
    assert.strictEqual(balance, 50000);

    // Exactly one call had alreadyPaid: false; all others had alreadyPaid: true
    const paidNew = results.filter(r => r.alreadyPaid === false);
    const paidExisting = results.filter(r => r.alreadyPaid === true);
    assert.strictEqual(paidNew.length, 1);
    assert.strictEqual(paidExisting.length, 4);
  });
});

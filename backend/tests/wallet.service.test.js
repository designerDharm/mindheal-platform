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
});

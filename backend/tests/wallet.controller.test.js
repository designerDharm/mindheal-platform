import test from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { initiateTopup, paymentWebhook } from "../src/controllers/wallet.controller.js";
import { appConfig } from "../src/config/app.js";
import { repositories } from "../src/repositories/index.js";

test("wallet controller", async (t) => {
  await t.test("returns a controlled error when production Razorpay setup is missing", async () => {
    const previousEnv = appConfig.env;
    appConfig.env = "production";

    try {
      const response = await initiateTopup({
        body: { amountInr: 500 },
        user: { id: "usr_payments" }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.match(response.body.error.message, /Razorpay is not configured/);
    } finally {
      appConfig.env = previousEnv;
    }
  });

  await t.test("rejects payment webhooks when the raw request body is unavailable", async () => {
    const originalAuditLogs = repositories.auditLogs;
    const auditEntries = [];
    repositories.auditLogs = {
      create: async (entry) => {
        auditEntries.push(entry);
        return entry;
      }
    };

    try {
      const response = await paymentWebhook({
        body: { event: "payment.captured" },
        req: { headers: { "x-razorpay-signature": "anything" } }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Missing raw webhook body.");
      assert.strictEqual(auditEntries.length, 1);
      assert.strictEqual(auditEntries[0].action, "payment_webhook_rejected");
      assert.strictEqual(auditEntries[0].newValue.reason, "missing_raw_body");
    } finally {
      repositories.auditLogs = originalAuditLogs;
    }
  });

  await t.test("settles captured payment webhooks using the exact raw body signature", async () => {
    const previousRazorpay = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    const previousWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const originalAuditLogs = repositories.auditLogs;
    const originalPaymentOrders = repositories.paymentOrders;
    const originalWallets = repositories.wallets;
    const originalTransactions = repositories.transactions;
    const secret = "webhook_secret_for_tests";
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test",
            order_id: "order_gateway_test",
            amount: 50000
          }
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const auditEntries = [];
    const ledgerEntries = [];
    const transactionEvents = [];

    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "payment_secret_for_tests";
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    repositories.auditLogs = {
      create: async (entry) => {
        auditEntries.push(entry);
        return entry;
      }
    };
    repositories.paymentOrders = {
      find: async (id) => {
        assert.ok(id === "order_gateway_test" || id === "ord_test");
        return {
          id: "ord_test",
          userId: "usr_payments",
          amountPaise: 50000,
          status: "created"
        };
      },
      update: async (id, patch) => ({ id, userId: "usr_payments", amountPaise: 50000, ...patch })
    };
    repositories.wallets = {
      findByOwner: async () => ({ id: "wal_payments", ownerId: "usr_payments", currency: "INR" }),
      createLedgerEntry: async (entry) => {
        ledgerEntries.push(entry);
        return entry;
      }
    };
    repositories.transactions = {
      withTransaction: async (callback) => {
        transactionEvents.push("begin");
        const result = await callback();
        transactionEvents.push("commit");
        return result;
      }
    };

    try {
      const response = await paymentWebhook({
        body: payload,
        req: { rawBody, headers: { "x-razorpay-signature": signature } }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.received, true);
      assert.strictEqual(response.body.data.settled, true);
      assert.strictEqual(ledgerEntries.length, 1);
      assert.strictEqual(ledgerEntries[0].entryType, "wallet_topup_webhook");
      assert.strictEqual(ledgerEntries[0].amountPaise, 50000);
      assert.strictEqual(auditEntries.at(-1).action, "payment_webhook_received");
      assert.deepStrictEqual(transactionEvents, ["begin", "commit"]);
    } finally {
      if (previousRazorpay === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousRazorpay;
      if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousSecret;
      if (previousWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previousWebhookSecret;
      repositories.auditLogs = originalAuditLogs;
      repositories.paymentOrders = originalPaymentOrders;
      repositories.wallets = originalWallets;
      repositories.transactions = originalTransactions;
    }
  });

  await t.test("verifyTopup rejects payment proof when razorpay_order_id does not match order gatewayOrderId", async () => {
    const originalPaymentOrders = repositories.paymentOrders;
    repositories.paymentOrders = {
      find: async (id) => {
        if (id === "ord_100") {
          return {
            id: "ord_100",
            gatewayOrderId: "order_target_expected",
            userId: "usr_1",
            amountPaise: 10000,
            status: "created"
          };
        }
        return null;
      }
    };

    try {
      const { verifyTopup } = await import("../src/controllers/wallet.controller.js");
      const response = await verifyTopup({
        user: { id: "usr_1" },
        body: {
          orderId: "ord_100",
          razorpay_order_id: "order_mismatched_attacker",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "sig_1"
        }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Payment proof does not match this order's gateway order identifier.");
    } finally {
      repositories.paymentOrders = originalPaymentOrders;
    }
  });

  await t.test("verifyTopup rejects proof when order belongs to another user (403)", async () => {
    const originalPaymentOrders = repositories.paymentOrders;
    repositories.paymentOrders = {
      find: async (id) => {
        if (id === "ord_200") {
          return {
            id: "ord_200",
            gatewayOrderId: "order_gateway_200",
            userId: "usr_legit_owner",
            amountPaise: 10000,
            status: "created"
          };
        }
        return null;
      }
    };

    try {
      const { verifyTopup } = await import("../src/controllers/wallet.controller.js");
      const response = await verifyTopup({
        user: { id: "usr_attacker" },
        body: {
          orderId: "ord_200",
          razorpay_order_id: "order_gateway_200",
          razorpay_payment_id: "pay_200",
          razorpay_signature: "sig_200"
        }
      });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.error.code, "FORBIDDEN");
    } finally {
      repositories.paymentOrders = originalPaymentOrders;
    }
  });

  await t.test("verifyTopup rejects reused payment identifier", async () => {
    const originalPaymentOrders = repositories.paymentOrders;
    repositories.paymentOrders = {
      find: async (id) => {
        if (id === "ord_300") {
          return {
            id: "ord_300",
            gatewayOrderId: "order_gateway_300",
            userId: "usr_3",
            amountPaise: 10000,
            status: "created"
          };
        }
        return null;
      },
      findByPaymentId: async (paymentId) => {
        if (paymentId === "pay_already_used") {
          return { id: "ord_earlier", gatewayPaymentId: "pay_already_used", status: "paid" };
        }
        return null;
      }
    };

    try {
      const { verifyTopup } = await import("../src/controllers/wallet.controller.js");
      const response = await verifyTopup({
        user: { id: "usr_3" },
        body: {
          orderId: "ord_300",
          razorpay_order_id: "order_gateway_300",
          razorpay_payment_id: "pay_already_used",
          razorpay_signature: "sig_300"
        }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Payment identifier has already been used for another order.");
    } finally {
      repositories.paymentOrders = originalPaymentOrders;
    }
  });

  await t.test("verifyTopup validates gateway payment state, order_id, amount, and currency", async () => {
    const { setPaymentFetcherForTesting } = await import("../src/services/wallet.service.js");
    const { verifyTopup } = await import("../src/controllers/wallet.controller.js");
    const originalPaymentOrders = repositories.paymentOrders;
    const testSecret = "test_key_secret_for_gateway_validation";
    process.env.RAZORPAY_KEY_SECRET = testSecret;

    const testOrder = {
      id: "ord_gateway_chk",
      gatewayOrderId: "order_gateway_expected_123",
      userId: "usr_valid",
      amountPaise: 25000,
      status: "created"
    };

    repositories.paymentOrders = {
      find: async () => testOrder,
      findByPaymentId: async () => null
    };

    const validSig = crypto.createHmac("sha256", testSecret)
      .update(`${testOrder.gatewayOrderId}|pay_test_state`)
      .digest("hex");

    try {
      // 1. Gateway status not captured
      setPaymentFetcherForTesting(async () => ({
        order_id: testOrder.gatewayOrderId,
        amount: 25000,
        currency: "INR",
        status: "failed"
      }));

      const resNotCaptured = await verifyTopup({
        user: { id: "usr_valid" },
        body: {
          orderId: testOrder.id,
          razorpay_order_id: testOrder.gatewayOrderId,
          razorpay_payment_id: "pay_test_state",
          razorpay_signature: validSig
        }
      });
      assert.strictEqual(resNotCaptured.status, 400);
      assert.match(resNotCaptured.body.error.message, /not captured/);

      // 2. Gateway amount mismatch
      setPaymentFetcherForTesting(async () => ({
        order_id: testOrder.gatewayOrderId,
        amount: 10000,
        currency: "INR",
        status: "captured"
      }));

      const resAmountMismatch = await verifyTopup({
        user: { id: "usr_valid" },
        body: {
          orderId: testOrder.id,
          razorpay_order_id: testOrder.gatewayOrderId,
          razorpay_payment_id: "pay_test_state",
          razorpay_signature: validSig
        }
      });
      assert.strictEqual(resAmountMismatch.status, 400);
      assert.match(resAmountMismatch.body.error.message, /amount does not match/);

      // 3. Gateway currency mismatch
      setPaymentFetcherForTesting(async () => ({
        order_id: testOrder.gatewayOrderId,
        amount: 25000,
        currency: "USD",
        status: "captured"
      }));

      const resCurrencyMismatch = await verifyTopup({
        user: { id: "usr_valid" },
        body: {
          orderId: testOrder.id,
          razorpay_order_id: testOrder.gatewayOrderId,
          razorpay_payment_id: "pay_test_state",
          razorpay_signature: validSig
        }
      });
      assert.strictEqual(resCurrencyMismatch.status, 400);
      assert.match(resCurrencyMismatch.body.error.message, /currency mismatch/);

      // 4. Gateway order_id mismatch
      setPaymentFetcherForTesting(async () => ({
        order_id: "order_gateway_different",
        amount: 25000,
        currency: "INR",
        status: "captured"
      }));

      const resOrderMismatch = await verifyTopup({
        user: { id: "usr_valid" },
        body: {
          orderId: testOrder.id,
          razorpay_order_id: testOrder.gatewayOrderId,
          razorpay_payment_id: "pay_test_state",
          razorpay_signature: validSig
        }
      });
      assert.strictEqual(resOrderMismatch.status, 400);
      assert.match(resOrderMismatch.body.error.message, /order ID does not match/);
    } finally {
      setPaymentFetcherForTesting(null);
      repositories.paymentOrders = originalPaymentOrders;
    }
  });
});


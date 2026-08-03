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
        assert.strictEqual(id, "order_gateway_test");
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
});

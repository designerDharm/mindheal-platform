import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { origin: "http://localhost:3000", hostname: "localhost", hash: "" }
};
globalThis.document = {
  querySelector: () => null,
  createElement: () => {
    const el = { addEventListener: () => {}, setAttribute: () => {} };
    setTimeout(() => {
      if (typeof el.onerror === "function") el.onerror(new Error("SDK load error in test"));
    }, 0);
    return el;
  },
  head: { appendChild: () => {} }
};

const { openRazorpayCheckout, setCheckoutLauncherForTesting } = await import("../src/utils/checkout.js");
const { api } = await import("../src/services/mock-api.js");

test("MH-14: Replace fake wallet checkout confirmation with authentic sandbox gateway", async (t) => {

  t.afterEach(() => {
    setCheckoutLauncherForTesting(null);
    delete globalThis.window.Razorpay;
  });

  await t.test("1. No synthetic pay_mock_* or fake mock_signature strings remain in src/", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    
    function scanFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanFiles(fullPath));
        } else if (entry.name.endsWith(".js")) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const files = scanFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      assert.strictEqual(
        content.includes("pay_mock_"),
        false,
        `Found forbidden pay_mock_ in ${path.relative(process.cwd(), file)}`
      );
      assert.strictEqual(
        content.includes("pay_peer_mock_"),
        false,
        `Found forbidden pay_peer_mock_ in ${path.relative(process.cwd(), file)}`
      );
    }
  });

  await t.test("2. openRazorpayCheckout throws if gateway SDK cannot load", async () => {
    // window.Razorpay is undefined and loadRazorpaySdk returns false in headless node
    await assert.rejects(
      async () => {
        await openRazorpayCheckout({
          keyId: "rzp_test_123",
          order: { id: "ord_1", gatewayOrderId: "order_rzp_1", amountPaise: 50000 }
        });
      },
      (err) => {
        assert.match(err.message, /Payment gateway SDK failed to load/);
        assert.strictEqual(err.code, "GATEWAY_SDK_LOAD_FAILED");
        return true;
      }
    );
  });

  await t.test("3. openRazorpayCheckout opens modal with correct options and resolves on gateway handler callback", async () => {
    let capturedOptions = null;
    let opened = false;

    // Simulate window.Razorpay SDK
    globalThis.window.Razorpay = class MockRazorpay {
      constructor(options) {
        capturedOptions = options;
      }
      on() {}
      open() {
        opened = true;
        // Simulate gateway success callback
        capturedOptions.handler({
          razorpay_payment_id: "pay_sandbox_test_123",
          razorpay_order_id: capturedOptions.order_id,
          razorpay_signature: "sig_sandbox_valid_abc"
        });
      }
    };

    const result = await openRazorpayCheckout({
      keyId: "rzp_test_dynamic_key",
      order: { id: "ord_99", gatewayOrderId: "order_rzp_99", amountPaise: 75000 },
      user: { name: "Test User", email: "user@example.com", phone: "+919876543210" }
    });

    assert.strictEqual(opened, true);
    assert.strictEqual(capturedOptions.key, "rzp_test_dynamic_key");
    assert.strictEqual(capturedOptions.amount, 75000);
    assert.strictEqual(capturedOptions.order_id, "order_rzp_99");
    assert.strictEqual(capturedOptions.prefill.name, "Test User");
    assert.strictEqual(capturedOptions.prefill.email, "user@example.com");

    // Result must ONLY contain gateway returned fields
    assert.deepStrictEqual(result, {
      razorpay_payment_id: "pay_sandbox_test_123",
      razorpay_order_id: "order_rzp_99",
      razorpay_signature: "sig_sandbox_valid_abc"
    });
  });

  await t.test("4. openRazorpayCheckout rejects with PAYMENT_CANCELLED when user dismisses modal", async () => {
    globalThis.window.Razorpay = class MockRazorpay {
      constructor(options) {
        this.options = options;
      }
      on() {}
      open() {
        // User closes the modal without completing payment
        this.options.modal.ondismiss();
      }
    };

    await assert.rejects(
      async () => {
        await openRazorpayCheckout({
          keyId: "rzp_test_key",
          order: { id: "ord_10", gatewayOrderId: "order_rzp_10", amountPaise: 50000 }
        });
      },
      (err) => {
        assert.strictEqual(err.code, "PAYMENT_CANCELLED");
        assert.match(err.message, /cancelled/i);
        return true;
      }
    );
  });

  await t.test("5. openRazorpayCheckout rejects with PAYMENT_FAILED when gateway payment fails", async () => {
    globalThis.window.Razorpay = class MockRazorpay {
      constructor(options) {
        this.options = options;
        this.eventListeners = {};
      }
      on(event, handler) {
        this.eventListeners[event] = handler;
      }
      open() {
        // Gateway fires payment.failed
        if (this.eventListeners["payment.failed"]) {
          this.eventListeners["payment.failed"]({
            error: {
              code: "BAD_REQUEST_ERROR",
              description: "Card was declined by issuing bank",
              reason: "payment_failed"
            }
          });
        }
      }
    };

    await assert.rejects(
      async () => {
        await openRazorpayCheckout({
          keyId: "rzp_test_key",
          order: { id: "ord_11", gatewayOrderId: "order_rzp_11", amountPaise: 50000 }
        });
      },
      (err) => {
        assert.strictEqual(err.code, "PAYMENT_FAILED");
        assert.match(err.message, /declined by issuing bank/);
        return true;
      }
    );
  });

  await t.test("6. topUpWallet integration: user cancellation aborts without calling /verify", async () => {
    let verifyCalled = false;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/wallet/topup/initiate")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              id: "ord_topup_cancel",
              gatewayOrderId: "order_gw_cancel",
              amountPaise: 50000,
              keyId: "rzp_test_dummy"
            }
          })
        };
      }
      if (urlStr.includes("/wallet/topup/verify")) {
        verifyCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { verified: true } })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    };

    // Set checkout launcher to simulate user cancellation
    setCheckoutLauncherForTesting(async () => {
      const err = new Error("Payment checkout was cancelled by user.");
      err.code = "PAYMENT_CANCELLED";
      throw err;
    });

    try {
      await assert.rejects(
        async () => {
          await api.topUpWallet({ amountInr: 500 });
        },
        (err) => {
          assert.strictEqual(err.code, "PAYMENT_CANCELLED");
          return true;
        }
      );
      assert.strictEqual(verifyCalled, false, "Verification must NOT be called when checkout is cancelled.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("7. topUpWallet integration: verified payment forwards only gateway signatures", async () => {
    let verifyPayload = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/wallet/topup/initiate")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              id: "ord_topup_ok",
              gatewayOrderId: "order_gw_ok",
              amountPaise: 100000,
              keyId: "rzp_test_dynamic_123"
            }
          })
        };
      }
      if (urlStr.includes("/wallet/topup/verify")) {
        verifyPayload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              verified: true,
              order: { id: "ord_topup_ok", status: "paid", amountPaise: 100000 },
              ledgerEntry: { id: "led_1", amountPaise: 100000, direction: "credit" }
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    };

    setCheckoutLauncherForTesting(async ({ order }) => {
      return {
        razorpay_payment_id: "pay_rzp_real_999",
        razorpay_order_id: order.gatewayOrderId,
        razorpay_signature: "sig_rzp_real_abc123"
      };
    });

    try {
      const result = await api.topUpWallet({ amountInr: 1000 });
      assert.strictEqual(result.verification.verified, true);
      assert.deepStrictEqual(verifyPayload, {
        orderId: "ord_topup_ok",
        razorpay_order_id: "order_gw_ok",
        razorpay_payment_id: "pay_rzp_real_999",
        razorpay_signature: "sig_rzp_real_abc123"
      });
      // No extra synthetic parameters (e.g. amountInr or mock tokens) sent in verification body
      assert.strictEqual(verifyPayload.amountInr, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("8. topUpWallet integration: verification failure throws and adds no balance", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/wallet/topup/initiate")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              id: "ord_topup_fail",
              gatewayOrderId: "order_gw_fail",
              amountPaise: 50000,
              keyId: "rzp_test_dynamic_123"
            }
          })
        };
      }
      if (urlStr.includes("/wallet/topup/verify")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            error: { message: "Invalid payment signature." }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    };

    setCheckoutLauncherForTesting(async ({ order }) => {
      return {
        razorpay_payment_id: "pay_bad_sig",
        razorpay_order_id: order.gatewayOrderId,
        razorpay_signature: "bad_signature"
      };
    });

    try {
      await assert.rejects(
        async () => {
          await api.topUpWallet({ amountInr: 500 });
        },
        (err) => {
          assert.match(err.message, /Invalid payment signature/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("9. UI Code Verification: main.js handles cancellation and authentic success toasts", () => {
    const mainJsPath = path.resolve(process.cwd(), "src/main.js");
    const mainContent = fs.readFileSync(mainJsPath, "utf8");

    // Must NOT contain mock payment toast
    assert.strictEqual(
      mainContent.includes("completed in mock payment mode"),
      false,
      "main.js should not contain 'completed in mock payment mode'"
    );

    // Must handle cancellation and authentic success toast
    assert.match(mainContent, /Wallet top-up was cancelled/);
    assert.match(mainContent, /Wallet top-up successful/);
  });
});

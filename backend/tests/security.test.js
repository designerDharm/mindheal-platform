import test from "node:test";
import assert from "node:assert";
import { maskSecret } from "../src/utils/security.js";

test("security utils", async (t) => {
  await t.test("maskSecret should mask all but first 4 and last 4 characters", () => {
    const secret = "sk_live_1234567890abcdef";
    const masked = maskSecret(secret);
    assert.strictEqual(masked, "sk_l••••cdef");
  });

  await t.test("maskSecret should handle short secrets", () => {
    const secret = "short";
    const masked = maskSecret(secret);
    assert.strictEqual(masked, "••••"); // If <= 8, just returns dots
  });

  await t.test("maskSecret should handle null or undefined", () => {
    assert.strictEqual(maskSecret(null), "");
    assert.strictEqual(maskSecret(undefined), "");
  });
});

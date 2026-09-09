import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("MH-13: Removal of fabricated social-login accounts", async (t) => {
  const mainJsPath = path.resolve("src/main.js");
  const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");

  await t.test("1. Verify no invented credentials or OAuth password patterns exist in codebase", () => {
    // Check that random account fabrication patterns were completely removed
    assert.strictEqual(
      mainJsContent.includes("OAuth-${provider}"),
      false,
      "Invented OAuth password pattern must not exist in src/main.js"
    );
    assert.strictEqual(
      mainJsContent.includes("@example.com`"),
      false,
      "Invented email pattern must not exist in src/main.js"
    );
    assert.strictEqual(
      mainJsContent.includes("Math.floor(10000000 + Math.random()"),
      false,
      "Invented phone number generator must not exist in src/main.js"
    );
    assert.strictEqual(
      mainJsContent.includes("socialPayload"),
      false,
      "Fabricated socialPayload must not exist in src/main.js"
    );
  });

  await t.test("2. Verify clear error is displayed when Google / Firebase is unavailable", () => {
    // Verify that Google provider checks for Firebase availability before attempting OAuth
    assert.match(
      mainJsContent,
      /if \(provider === "Google"\) \{\s*if \(typeof firebase === "undefined" \|\| !firebase\.apps \|\| !firebase\.apps\.length\) \{/
    );
    assert.match(
      mainJsContent,
      /Google authentication service is currently unavailable\. Please sign in with your email or mobile\./
    );
  });

  await t.test("3. Verify unconfigured providers (Facebook, Apple) display clear error and do not fall back to signup", () => {
    assert.match(
      mainJsContent,
      /\$\{provider\} authentication service is currently unavailable\. Please sign in with your email or mobile\./
    );
    // Ensure that after showing the error, it does not call api.signUp or api.login
    const socialHandlerBlock = mainJsContent.slice(
      mainJsContent.indexOf('document.querySelectorAll(".social-btn")'),
      mainJsContent.indexOf('document.querySelectorAll("[data-action=\'toggle-password\']")')
    );
    assert.strictEqual(
      socialHandlerBlock.includes("api.signUp"),
      false,
      "Social login handler must never call api.signUp"
    );
    assert.strictEqual(
      socialHandlerBlock.includes("api.login("),
      false,
      "Social login handler must never fall back to ordinary api.login with invented details"
    );
  });
});

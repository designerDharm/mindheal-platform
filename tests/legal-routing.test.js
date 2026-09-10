import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

// Set up browser-like environment in global scope before importing main.js
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

const createMockElement = () => ({
  innerHTML: "",
  innerText: "",
  style: {},
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {},
  removeChild() {},
  setAttribute() {},
  getAttribute: () => null,
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll: () => []
});

const mockApp = createMockElement();

globalThis.NodeFilter = { SHOW_TEXT: 4 };

const mockDocument = {
  querySelector: () => mockApp,
  querySelectorAll: () => [],
  getElementById: () => mockApp,
  createTreeWalker: () => ({ nextNode: () => null }),
  addEventListener: () => {},
  removeEventListener: () => {},
  title: "",
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  documentElement: { setAttribute() {}, getAttribute() {} }
};

globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { hash: "", origin: "http://localhost:3000" },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  document: mockDocument,
  scrollTo: () => {}
};
globalThis.document = mockDocument;
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { legalDocuments } = await import("../src/data/legal-docs.js");
const {
  renderLegalPage,
  legalHeaderNav,
  legalUserTermsPage,
  legalUserPrivacyPage,
  legalProfessionalTermsPage,
  legalProfessionalPrivacyPage,
  legalAiNoticePage,
  legalRefundsPage,
  legalCookiesPage,
  legalSafetyPage,
  legalSubprocessorsPage
} = await import("../src/main.js");

test("MH-27: Correct legal-document routing and eliminate placeholder aliases", async (t) => {
  const mainJsPath = path.resolve("src/main.js");
  const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");

  await t.test("1. All 9 required legal policies are present in SSoT (legalDocuments)", () => {
    const requiredKeys = [
      "user-terms",
      "user-privacy",
      "professional-terms",
      "professional-privacy",
      "ai-notice",
      "refunds",
      "cookies",
      "safety",
      "subprocessors"
    ];

    for (const key of requiredKeys) {
      assert.ok(legalDocuments[key], `legalDocuments must contain key '${key}'`);
      assert.strictEqual(typeof legalDocuments[key].title, "string", `${key} must have a title`);
      assert.strictEqual(typeof legalDocuments[key].navLabel, "string", `${key} must have a navLabel`);
      assert.ok(Array.isArray(legalDocuments[key].sections), `${key} must have sections array`);
      assert.ok(legalDocuments[key].sections.length > 0, `${key} must have at least one section`);
    }
  });

  await t.test("2. No aliasing forwarders exist in main.js (every policy has dedicated content)", () => {
    // None of the functions should simply return legalUserPrivacyPage or legalUserTermsPage
    assert.strictEqual(
      mainJsContent.includes("function legalCookiesPage() { return legalUserPrivacyPage(); }"),
      false,
      "legalCookiesPage must not alias legalUserPrivacyPage"
    );
    assert.strictEqual(
      mainJsContent.includes("function legalRefundsPage() { return legalUserTermsPage(); }"),
      false,
      "legalRefundsPage must not alias legalUserTermsPage"
    );
    assert.strictEqual(
      mainJsContent.includes("function legalSubprocessorsPage() { return legalUserPrivacyPage(); }"),
      false,
      "legalSubprocessorsPage must not alias legalUserPrivacyPage"
    );
    assert.strictEqual(
      mainJsContent.includes("function legalAiNoticePage() { return legalUserTermsPage(); }"),
      false,
      "legalAiNoticePage must not alias legalUserTermsPage"
    );
    assert.strictEqual(
      mainJsContent.includes("function legalSafetyPage() { return legalUserTermsPage(); }"),
      false,
      "legalSafetyPage must not alias legalUserTermsPage"
    );
    assert.strictEqual(
      mainJsContent.includes("function legalProfessionalPrivacyPage() { return legalUserPrivacyPage(); }"),
      false,
      "legalProfessionalPrivacyPage must not alias legalUserPrivacyPage"
    );
  });

  await t.test("3. Each dedicated policy page function renders its matching title and unique content", () => {
    const pages = [
      { fn: legalUserTermsPage, expectedTitle: "User Terms of Use", id: "user-terms" },
      { fn: legalUserPrivacyPage, expectedTitle: "User Privacy Notice", id: "user-privacy" },
      { fn: legalProfessionalTermsPage, expectedTitle: "Counsellor & Professional Terms", id: "professional-terms" },
      { fn: legalProfessionalPrivacyPage, expectedTitle: "Counsellor & Professional Privacy Policy", id: "professional-privacy" },
      { fn: legalAiNoticePage, expectedTitle: "AI Clinical Companion & Algorithm Notice", id: "ai-notice" },
      { fn: legalRefundsPage, expectedTitle: "Cancellation & Refund Policy", id: "refunds" },
      { fn: legalCookiesPage, expectedTitle: "Cookie & Storage Policy", id: "cookies" },
      { fn: legalSafetyPage, expectedTitle: "Clinical Safety Framework & Emergency Policy", id: "safety" },
      { fn: legalSubprocessorsPage, expectedTitle: "Authorized Third-Party Subprocessors", id: "subprocessors" }
    ];

    for (const { fn, expectedTitle, id } of pages) {
      const renderedHtml = fn();
      assert.ok(renderedHtml.includes(expectedTitle), `Page ${id} must include title "${expectedTitle}"`);
      assert.ok(renderedHtml.includes(`href="#/legal/${id}"`), `Page ${id} must link to its own route`);
    }
  });

  await t.test("4. Specific policy content truthfulness: Cookie, Refund, and Subprocessors contain genuine terms", () => {
    // Cookie Policy checks
    const cookieHtml = legalCookiesPage();
    assert.ok(cookieHtml.includes("Cookie & Storage Policy"), "Cookie policy has correct title");
    assert.ok(cookieHtml.includes("mindheal-access-token"), "Cookie policy specifies auth tokens");
    assert.ok(cookieHtml.includes("Zero third-party advertising cookies"), "Cookie policy mentions zero third-party trackers");

    // Refund Policy checks
    const refundHtml = legalRefundsPage();
    assert.ok(refundHtml.includes("Cancellation & Refund Policy"), "Refund policy has correct title");
    assert.ok(refundHtml.includes("Greater than 24 hours"), "Refund policy specifies 24-hour cancellation rule");
    assert.ok(refundHtml.includes("100% full refund"), "Refund policy specifies 100% refund window");

    // Subprocessors checks
    const subprocessorHtml = legalSubprocessorsPage();
    assert.ok(subprocessorHtml.includes("Authorized Third-Party Subprocessors"), "Subprocessors has correct title");
    assert.ok(subprocessorHtml.includes("Razorpay Software Pvt. Ltd."), "Subprocessors includes Razorpay");
    assert.ok(subprocessorHtml.includes("Amazon Web Services"), "Subprocessors includes AWS");
    assert.ok(subprocessorHtml.includes("Vercel Inc."), "Subprocessors includes Vercel");

    // AI Notice checks
    const aiHtml = legalAiNoticePage();
    assert.ok(aiHtml.includes("AI Clinical Companion & Algorithm Notice"), "AI notice has correct title");
    assert.ok(aiHtml.includes("NOT licensed medical diagnostic devices"), "AI notice has clinical boundary disclaimer");

    // Clinical Safety checks
    const safetyHtml = legalSafetyPage();
    assert.ok(safetyHtml.includes("Clinical Safety Framework & Emergency Policy"), "Safety has correct title");
    assert.ok(safetyHtml.includes("14416"), "Safety includes Tele-MANAS helpline 14416");
    assert.ok(safetyHtml.includes("9820466726"), "Safety includes AASRA helpline");
  });

  await t.test("5. legalHeaderNav highlights active tab and contains all 9 legal links", () => {
    const navHtml = legalHeaderNav("refunds");
    assert.ok(navHtml.includes('href="#/legal/refunds" class="btn secondary active"'), "Active link must receive active class");
    assert.ok(navHtml.includes('href="#/legal/cookies"'), "Nav must contain cookies link");
    assert.ok(navHtml.includes('href="#/legal/subprocessors"'), "Nav must contain subprocessors link");
    assert.ok(navHtml.includes('href="#/legal/safety"'), "Nav must contain safety link");
  });

  await t.test("6. SEO metadata includes distinct titles and descriptions for all legal paths", () => {
    assert.ok(mainJsContent.includes('"/legal/refunds": "Cancellation & Refund Policy | MindHeal Legal Centre"'));
    assert.ok(mainJsContent.includes('"/legal/cookies": "Cookie & Storage Policy | MindHeal Legal Centre"'));
    assert.ok(mainJsContent.includes('"/legal/subprocessors": "Authorized Third-Party Subprocessors | MindHeal Legal Centre"'));
    assert.ok(mainJsContent.includes('"/legal/safety": "Clinical Safety Framework & Emergency Policy | MindHeal Legal Centre"'));
  });

  await t.test("7. Footer contains direct links to policies including Refund Policy", () => {
    assert.ok(mainJsContent.includes('href="#/legal/refunds"'), "Footer must contain Refund Policy link");
    assert.ok(mainJsContent.includes('href="#/legal/cookies"'), "Footer must contain Cookie Policy link");
    assert.ok(mainJsContent.includes('href="#/legal/safety"'), "Footer must contain Clinical Safety link");
  });
});

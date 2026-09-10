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
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test("MH-25: Public counsellors page displays offline state during API outage and never sample counsellors", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Extract publicCounsellorsPage function
  const funcMatch = mainCode.match(/function publicCounsellorsPage\(data\)\s*\{([\s\S]*?)\n\}\n\nfunction siteHeader/);
  assert.ok(funcMatch, "publicCounsellorsPage function should exist in main.js");

  // Create isolated evaluator
  const html = (strings, ...values) => strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
  const escapeHtml = (str) => String(str || "");
  const formatInr = (n) => `₹${n}`;
  const counsellorCard = (c) => `<article class="service-card">${c.name}</article>`;

  const evaluator = new Function(
    "html", "escapeHtml", "formatInr", "counsellorCard",
    `return function publicCounsellorsPage(data) { ${funcMatch[1]} }`
  )(html, escapeHtml, formatInr, counsellorCard);

  // Case 1: Outage state
  const outageData = {
    counsellorsOutage: true,
    backendStatus: { isOutage: true },
    counsellors: []
  };
  const outageOutput = evaluator(outageData);

  assert.ok(outageOutput.includes("SERVICE STATUS • TEMPORARILY OFFLINE"), "Outage banner should be present");
  assert.ok(outageOutput.includes("Provider Directory Temporarily Unavailable"), "Title should state directory is unavailable");
  assert.ok(outageOutput.includes('data-action="retry-fetch"'), "Retry action button should be present");
  assert.ok(outageOutput.includes("Tele-MANAS: 14416"), "Crisis helpline should be provided");
  assert.ok(!outageOutput.includes("Dr. Priya Mehta"), "Sample counsellor Priya Mehta must NOT be present in outage");
  assert.ok(!outageOutput.includes("Aarav Sen"), "Sample counsellor Aarav Sen must NOT be present in outage");
  assert.ok(!outageOutput.includes("Request Session"), "No booking buttons should appear during outage");

  // Case 2: Connected but empty state (zero verified counsellors)
  const emptyData = {
    counsellorsOutage: false,
    backendStatus: { isOutage: false },
    counsellors: []
  };
  const emptyOutput = evaluator(emptyData);

  assert.ok(emptyOutput.includes("No Verified Practitioners Currently Listed"), "Should display verified empty state");
  assert.ok(emptyOutput.includes("Explore Self-Help CBT Tools"), "Should provide path to self-help tools");
  assert.ok(!emptyOutput.includes("Dr. Priya Mehta"), "Sample counsellor Priya Mehta must NOT be present in empty state");
  assert.ok(!emptyOutput.includes("Request Session"), "No booking buttons should appear when 0 counsellors");

  // Case 3: Genuine verified counsellors
  const verifiedData = {
    counsellorsOutage: false,
    backendStatus: { isOutage: false },
    counsellors: [
      { id: "c-real-1", name: "Dr. Real Verified", verificationStatus: "approved", rate: 1500 }
    ]
  };
  const verifiedOutput = evaluator(verifiedData);

  assert.ok(verifiedOutput.includes("Dr. Real Verified"), "Verified counsellor should be displayed");
  assert.ok(!verifiedOutput.includes("No Verified Practitioners Currently Listed"), "Empty state should not be displayed");
  assert.ok(!verifiedOutput.includes("Provider Directory Temporarily Unavailable"), "Outage state should not be displayed");
});

test("MH-25: User panel displays truthful outage and empty states without falling back to sample counsellors", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Verify that userPanel does not contain data.counsellors?.length ? data.counsellors : counsellors
  assert.ok(
    !mainCode.includes("data.counsellors?.length ? data.counsellors : counsellors"),
    "userPanel must not silently fall back to mock counsellors"
  );

  // Check section === 'counsellors' in userPanel
  const userPanelSnippet = mainCode.match(/if\s*\(section === "counsellors"\)\s*\{([\s\S]*?)\n\s*if\s*\(section === "cbt"\)/);
  assert.ok(userPanelSnippet, "userPanel counsellors section should exist");
  const code = userPanelSnippet[1];

  assert.ok(code.includes("SERVICE TEMPORARILY OFFLINE"), "Must have outage handling in userPanel");
  assert.ok(code.includes("No Verified Practitioners Currently Listed"), "Must have empty state handling in userPanel");
  assert.ok(code.includes('data-action="retry-fetch"'), "Must have retry button in userPanel");
});

test("MH-25: Admin panel does not inject hardcoded counsellors when database is empty", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Check adminPanel counsellors section
  const adminSnippet = mainCode.match(/if\s*\(section === "counsellors"\)\s*\{([\s\S]*?)\n\s*if\s*\(section === "peer-talk"\)/);
  assert.ok(adminSnippet, "adminPanel counsellors section should exist");
  const code = adminSnippet[1];

  assert.ok(!code.includes(": counsellors"), "adminPanel must not fall back to : counsellors");
  assert.ok(code.includes("Array.isArray(data.counsellors) ? data.counsellors : []"), "adminPanel must only map real data.counsellors");
});

test("MH-25: Homepage Meet Your Match displays verified counsellor cards and pricing buttons", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Check sectionCounsellors
  const counsellorsSnippet = mainCode.match(/function sectionCounsellors\(\)\s*\{([\s\S]*?)\nfunction sectionTestimonials/);
  assert.ok(counsellorsSnippet, "sectionCounsellors should exist");
  const code = counsellorsSnippet[1];

  assert.ok(code.includes("verified-badge"), "Homepage cards must include verified badge");
  assert.ok(code.includes('data-action="open-booking-modal"'), "Cards must include booking modal action");
  assert.ok(code.includes('${t("Book")} ₹${doc.p}'), "Pricing buttons must be present with rate formatting");
});

test("MH-25: Trust claims are substantiated and Indian statutory compliant", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // sectionTrustStrip
  const trustSnippet = mainCode.match(/function sectionTrustStrip\(\)\s*\{([\s\S]*?)\nfunction sectionProblemStatement/);
  assert.ok(trustSnippet, "sectionTrustStrip should exist");
  const trustCode = trustSnippet[1];

  assert.ok(!trustCode.includes("HIPAA Compliant"), "HIPAA claim should be removed from trust strip");
  assert.ok(trustCode.includes("DPDP Act 2023 Compliant"), "DPDP Act 2023 must be present in trust strip");
  assert.ok(trustCode.includes("RCI & NMC Verified Experts"), "RCI & NMC verification must be present");
  assert.ok(trustCode.includes("256-bit TLS & AES Encryption"), "Encryption standards must be specified");
  assert.ok(trustCode.includes("Tele-MANAS Crisis Escalation"), "Tele-MANAS crisis integration must be specified");

  // sectionHero stats
  const heroSnippet = mainCode.match(/function sectionHero\(\)\s*\{([\s\S]*?)\nfunction sectionTrustStrip/);
  assert.ok(heroSnippet, "sectionHero should exist");
  const heroCode = heroSnippet[1];

  assert.ok(!heroCode.includes("+50k"), "Hero must not have unsubstantiated +50k user count");
  assert.ok(!heroCode.includes("500+"), "Hero must not have unsubstantiated 500+ experts count");
  assert.ok(heroCode.includes("DPDP Act 2023"), "Hero must highlight DPDP Act 2023");
  assert.ok(heroCode.includes("RCI & NMC"), "Hero must highlight RCI & NMC verification");

  // sectionTestimonials
  const testSnippet = mainCode.match(/function sectionTestimonials\(\)\s*\{([\s\S]*?)\nfunction sectionCounsellorCTA/);
  assert.ok(testSnippet, "sectionTestimonials should exist");
  const testCode = testSnippet[1];

  assert.ok(!testCode.includes("2M+"), "Testimonials must not claim unsubstantiated 2M+ messages");
  assert.ok(testCode.includes("ILLUSTRATIVE CLIENT EXPERIENCES • CLINICAL DEMONSTRATION"), "Testimonials must be badged as demonstration");
  assert.ok(testCode.includes("RCI & NMC Verified Clinicians"), "Stat 1 must be substantiated RCI & NMC verification");
  assert.ok(testCode.includes("TLS & AES Privacy Architecture"), "Stat 2 must be substantiated encryption");
  assert.ok(testCode.includes("Tele-MANAS Crisis Escalation"), "Stat 3 must be Tele-MANAS");
});

test("MH-25: mock-api exposes counsellorsOutage flag when remote provider request fails", async () => {
  const apiCode = fs.readFileSync(path.resolve("src/services/mock-api.js"), "utf8");

  assert.ok(
    apiCode.includes("counsellorsOutage: !remoteCounsellors.ok || isOutage"),
    "mock-api getState must return counsellorsOutage flag"
  );
});

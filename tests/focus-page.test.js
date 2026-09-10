import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

// Mock minimal browser environment before importing main.js
class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();

const mockApp = {
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
  querySelectorAll: () => [],
  querySelector: () => null,
  contains: () => false,
  focus() {}
};

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

const {
  serviceFocusTools,
  createServiceLandingPage,
  serviceGroupHealing,
  serviceMindGames,
  serviceHealingMap,
  servicePsychologicalTests,
  serviceCBTDiary,
  servicePsychologyCourses
} = await import("../src/main.js");

test("MH-29: Focus page content, safe fallbacks, and navigation contrast", async (t) => {
  await t.test("1. serviceFocusTools renders Pomodoro description and no undefined text", () => {
    const html = serviceFocusTools();
    assert.strictEqual(typeof html, "string");
    
    // Check that Pomodoro Timers description is rendered
    assert.match(
      html,
      /Pomodoro Timers/,
      "Focus page must include Pomodoro Timers title"
    );
    assert.match(
      html,
      /Customizable work\/break intervals to maintain peak productivity without burnout\./,
      "Focus page must render the full Pomodoro timer description"
    );

    // Check that literal "undefined" string never appears in the output
    assert.doesNotMatch(
      html,
      /\bundefined\b/,
      "Focus page HTML must not contain the literal string 'undefined'"
    );
  });

  await t.test("2. createServiceLandingPage provides safe content fallbacks for missing/alternate fields", () => {
    // Test with missing desc, but providing customizable
    const htmlWithCustomizable = createServiceLandingPage({
      title: "Test Service",
      features: [
        { icon: "ph-timer", title: "Customizable Tool", customizable: "Fallback description from customizable" }
      ]
    });
    assert.match(htmlWithCustomizable, /Fallback description from customizable/);
    assert.doesNotMatch(htmlWithCustomizable, /\bundefined\b/);

    // Test with empty feature object
    const htmlWithEmptyFeature = createServiceLandingPage({
      title: "Test Empty",
      features: [{}]
    });
    assert.strictEqual(typeof htmlWithEmptyFeature, "string");
    assert.doesNotMatch(htmlWithEmptyFeature, /\bundefined\b/);

    // Test with undefined config
    const htmlUndefinedConfig = createServiceLandingPage();
    assert.strictEqual(typeof htmlUndefinedConfig, "string");
    assert.doesNotMatch(htmlUndefinedConfig, /\bundefined\b/);
  });

  await t.test("3. All service landing pages render valid non-undefined content", () => {
    const pages = [
      { name: "serviceGroupHealing", fn: serviceGroupHealing },
      { name: "serviceMindGames", fn: serviceMindGames },
      { name: "serviceFocusTools", fn: serviceFocusTools },
      { name: "serviceHealingMap", fn: serviceHealingMap },
      { name: "servicePsychologicalTests", fn: servicePsychologicalTests },
      { name: "serviceCBTDiary", fn: serviceCBTDiary },
      { name: "servicePsychologyCourses", fn: servicePsychologyCourses }
    ];

    for (const { name, fn } of pages) {
      const rendered = fn();
      assert.strictEqual(typeof rendered, "string", `${name} must return string`);
      assert.doesNotMatch(
        rendered,
        /\bundefined\b/,
        `${name} must not render literal 'undefined'`
      );
    }
  });

  await t.test("4. CSS theme rules ensure readable navigation contrast on desktop and mobile", () => {
    const appCss = fs.readFileSync(path.resolve("src/styles/app.css"), "utf-8");

    // Check dark theme header text color
    assert.match(
      appCss,
      /\.site-header\.dark-theme\s*\{[^}]*--header-text-color:\s*white;/,
      "Dark theme header must define --header-text-color: white for contrast"
    );

    // Check dark glass header on scroll
    assert.match(
      appCss,
      /\.site-header\.dark-theme\.glass\s*\{[^}]*background:\s*rgba\(18,\s*18,\s*20/i,
      "Scrolled dark theme header must maintain dark glass background"
    );

    // Check mobile drawer contrast
    assert.match(
      appCss,
      /\.nav-links\.open\s*\{[\s\S]*?--header-text-color:\s*var\(--color-charcoal\)\s*!important;/,
      "Open mobile drawer must force charcoal header text color against white background"
    );

    // Check mobile bottom nav accessibility
    assert.match(
      appCss,
      /\.mob-tab\s*\{[\s\S]*?color:\s*#4a5568\s*!important;/,
      "Mobile bottom tab must use accessible contrast color"
    );
  });
});

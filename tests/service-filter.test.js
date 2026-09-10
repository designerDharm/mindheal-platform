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

const { normalizeCategory, matchesCategory } = await import("../src/main.js");

test("MH-26: Fix service-filter state, standardize category identifiers, and isolate Homepage showcase", async (t) => {
  const mainJsPath = path.resolve("src/main.js");
  const mainJsContent = fs.readFileSync(mainJsPath, "utf-8");

  await t.test("1. normalizeCategory standardizes human titles, slugs, and legacy terms", () => {
    assert.strictEqual(normalizeCategory(""), "all");
    assert.strictEqual(normalizeCategory("all"), "all");
    assert.strictEqual(normalizeCategory("All Services"), "all");
    
    // AI category
    assert.strictEqual(normalizeCategory("AI Support"), "ai-support");
    assert.strictEqual(normalizeCategory("ai"), "ai-support");
    assert.strictEqual(normalizeCategory("ai-support"), "ai-support");
    
    // Human category
    assert.strictEqual(normalizeCategory("Human Counselling"), "human-counselling");
    assert.strictEqual(normalizeCategory("human"), "human-counselling");
    assert.strictEqual(normalizeCategory("human-counselling"), "human-counselling");
    
    // CBT Tools
    assert.strictEqual(normalizeCategory("CBT Tools"), "cbt-tools");
    assert.strictEqual(normalizeCategory("cbt"), "cbt-tools");
    
    // Analysis Reports
    assert.strictEqual(normalizeCategory("Analysis Reports"), "analysis-reports");
    assert.strictEqual(normalizeCategory("Dream Analysis"), "analysis-reports");
    assert.strictEqual(normalizeCategory("Signature & Script"), "analysis-reports");
    
    // Wellness Tools
    assert.strictEqual(normalizeCategory("Wellness Tools"), "wellness-tools");
    assert.strictEqual(normalizeCategory("self-care"), "wellness-tools");
    assert.strictEqual(normalizeCategory("Mood Tracker"), "wellness-tools");

    // Community
    assert.strictEqual(normalizeCategory("Community"), "community");
  });

  await t.test("2. matchesCategory accurately identifies category alignment", () => {
    // 'all' filter matches everything
    assert.strictEqual(matchesCategory("AI Support", "all"), true);
    assert.strictEqual(matchesCategory("Human Counselling", ""), true);
    assert.strictEqual(matchesCategory("Wellness Tools", null), true);

    // Cross matching title and slug
    assert.strictEqual(matchesCategory("AI Support", "ai-support"), true);
    assert.strictEqual(matchesCategory("ai-support", "AI Support"), true);
    assert.strictEqual(matchesCategory("Human Counselling", "human"), true);
    assert.strictEqual(matchesCategory("Wellness Tools", "self-care"), true);
    assert.strictEqual(matchesCategory("Analysis Reports", "dream-analysis"), true);

    // Negative matches
    assert.strictEqual(matchesCategory("Human Counselling", "AI Support"), false);
    assert.strictEqual(matchesCategory("AI Support", "Human Counselling"), false);
    assert.strictEqual(matchesCategory("Wellness Tools", "AI Support"), false);
  });

  await t.test("3. Homepage sectionServices() does NOT hide cards based on serviceFilter", () => {
    // Ensure no conditional display:none in sectionServices
    const sectionServicesMatch = mainJsContent.match(/function sectionServices\(\) \{([\s\S]*?)\nfunction /);
    assert.ok(sectionServicesMatch, "sectionServices function must exist");
    const sectionBody = sectionServicesMatch[1];

    assert.strictEqual(
      sectionBody.includes("filter !== 'all'"),
      false,
      "sectionServices must not contain conditional filter hiding"
    );
    assert.strictEqual(
      sectionBody.includes("display:none"),
      false,
      "sectionServices cards must not have display:none applied from filter state"
    );

    // Check that all 5 showcase cards are present with canonical identifiers
    assert.ok(sectionBody.includes('data-category="ai-support"'), "Card 1 must have data-category='ai-support'");
    assert.ok(sectionBody.includes('data-category="wellness-tools"'), "Card 2 must have data-category='wellness-tools'");
    assert.ok(sectionBody.includes('data-category="analysis-reports"'), "Cards 3A/3B must have data-category='analysis-reports'");
    assert.ok(sectionBody.includes('data-category="human-counselling"'), "Card 4 must have data-category='human-counselling'");
  });

  await t.test("4. Navigation to Home (hash '#/' or '') resets state.serviceFilter to 'all'", () => {
    assert.ok(
      mainJsContent.includes('if (state.route.path === "/") {\n    state.serviceFilter = "all";\n  }'),
      "hashchange listener must reset state.serviceFilter to 'all' when navigating to home ('/')"
    );
  });

  await t.test("5. Services directory and serviceCard support dynamic active filter and normalization", () => {
    // servicesPage has dynamic active class on filter tabs
    assert.ok(
      mainJsContent.includes("currentFilter === 'all' ? 'active' : ''"),
      "All Services tab must dynamically reflect active state"
    );
    assert.ok(
      mainJsContent.includes("matchesCategory(category, currentFilter) && currentFilter !== 'all' ? 'active' : ''"),
      "Category tabs must dynamically reflect active state when selected"
    );

    // serviceCard uses normalized data-category and respects matchesCategory
    assert.ok(
      mainJsContent.includes('data-category="${normalizedCat}"'),
      "serviceCard must output normalized category in data-category"
    );
    assert.ok(
      mainJsContent.includes("const isVisible = matchesCategory(service.category, currentFilter);"),
      "serviceCard must determine initial visibility using matchesCategory"
    );
  });

  await t.test("6. window.filterServices updates both tabs and directory cards correctly", () => {
    assert.ok(
      mainJsContent.includes("window.filterServices = (category = \"all\") => {"),
      "window.filterServices must accept category with default 'all'"
    );
    assert.ok(
      mainJsContent.includes("matchesCategory(itemCat, targetCategory)"),
      "filterServices must use matchesCategory to toggle card display"
    );
  });
});

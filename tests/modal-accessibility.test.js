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

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.innerHTML = "";
    this.innerText = "";
    this.style = {};
    this.dataset = {};
    this.attributes = new Map();
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c) => {
        if (this.classList._classes.has(c)) {
          this.classList._classes.delete(c);
          return false;
        } else {
          this.classList._classes.add(c);
          return true;
        }
      },
      contains: (c) => this.classList._classes.has(c)
    };
    this.children = [];
    this.parentElement = null;
    this._listeners = new Map();
  }

  querySelector(sel) {
    return null;
  }

  querySelectorAll(sel) {
    return [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
    if (name === "role") this.role = String(value);
  }

  getAttribute(name) {
    if (name === "id") return this.id || this.attributes.get("id") || null;
    if (name === "role") return this.role || this.attributes.get("role") || null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    if (!this._listeners.has(type)) return;
    const filtered = this._listeners.get(type).filter(h => h !== handler);
    this._listeners.set(type, filtered);
  }

  dispatchEvent(event) {
    event.target = this;
    const handlers = this._listeners.get(event.type) || [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  focus() {
    globalThis.document.activeElement = this;
  }

  contains(child) {
    if (!child) return false;
    if (child === this) return true;
    let curr = child.parentElement;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  matches(sel) {
    if (sel.includes('[role="tab"]')) return this.getAttribute("role") === "tab";
    if (sel.includes("input")) return this.tagName === "INPUT";
    if (sel.includes("button")) return this.tagName === "BUTTON";
    return false;
  }
}

const mockApp = new MockElement("div");

globalThis.NodeFilter = { SHOW_TEXT: 4 };

const mockDocument = {
  activeElement: null,
  body: new MockElement("body"),
  _customQuery: null,
  querySelector: (sel) => {
    if (sel === "#app") return mockApp;
    if (mockDocument._customQuery) {
      return mockDocument._customQuery(sel);
    }
    return mockApp;
  },
  querySelectorAll: (sel) => [],
  getElementById: (id) => (id === "app" ? mockApp : null),
  createTreeWalker: () => ({ nextNode: () => null }),
  addEventListener: () => {},
  removeEventListener: () => {},
  contains: (el) => true,
  title: "",
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
  scrollTo: () => {},
  getComputedStyle: () => ({ display: "block", visibility: "visible" })
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

test("MH-28: Dream auth modal has dialog semantics, accessible names, and labelled controls", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Extract dream modal snippet
  const dreamMatch = mainCode.match(/<!-- GLASSMORPHIC AUTH MODAL overlay -->([\s\S]*?serviceHandwritingAnalysis)/);
  assert.ok(dreamMatch, "Dream auth modal template should exist in main.js");
  const dreamModalHtml = dreamMatch[1];

  // 1. Dialog semantics
  assert.ok(dreamModalHtml.includes('role="dialog"'), 'Must have role="dialog"');
  assert.ok(dreamModalHtml.includes('aria-modal="true"'), 'Must have aria-modal="true"');
  assert.ok(dreamModalHtml.includes('aria-labelledby="dream-auth-modal-title"'), 'Must have aria-labelledby');
  assert.ok(dreamModalHtml.includes('aria-describedby="dream-auth-modal-desc"'), 'Must have aria-describedby');
  assert.ok(dreamModalHtml.includes('id="dream-auth-modal-title"'), 'Title element must have matching id');
  assert.ok(dreamModalHtml.includes('id="dream-auth-modal-desc"'), 'Description element must have matching id');

  // 2. Accessible names on controls
  assert.ok(
    dreamModalHtml.includes('aria-label="Close authentication dialog"'),
    'Close button must have descriptive aria-label'
  );
  assert.ok(dreamModalHtml.includes('role="tablist"'), 'Tabs must be in role="tablist"');
  assert.ok(dreamModalHtml.includes('role="tab"'), 'Tab buttons must have role="tab"');
  assert.ok(dreamModalHtml.includes('aria-selected='), 'Tab buttons must declare aria-selected state');

  // 3. Form input association
  assert.ok(dreamModalHtml.includes('for="modal-name"'), 'Full name label must have matching for attribute');
  assert.ok(dreamModalHtml.includes('id="modal-name"'), 'Full name input must have matching id');
  assert.ok(dreamModalHtml.includes('for="modal-email"'), 'Email label must have matching for attribute');
  assert.ok(dreamModalHtml.includes('id="modal-email"'), 'Email input must have matching id');
  assert.ok(dreamModalHtml.includes('for="modal-password"'), 'Password label must have matching for attribute');
  assert.ok(dreamModalHtml.includes('id="modal-password"'), 'Password input must have matching id');
});

test("MH-28: Booking, Link Account, and Daily Diary modals have dialog semantics and accessible names", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Booking Modal
  const bookingMatch = mainCode.match(/function renderBookingModal\(\)\s*\{([\s\S]*?)\n(?:async\s+)?function openBookingForCounsellor/);
  assert.ok(bookingMatch, "renderBookingModal should exist");
  const bookingHtml = bookingMatch[1];
  assert.ok(bookingHtml.includes('role="dialog"'), 'Booking modal must have role="dialog"');
  assert.ok(bookingHtml.includes('aria-modal="true"'), 'Booking modal must have aria-modal="true"');
  assert.ok(bookingHtml.includes('aria-labelledby="booking-modal-title"'), 'Booking modal must have aria-labelledby');
  assert.ok(bookingHtml.includes('id="booking-modal-title"'), 'Booking modal must have matching title id');
  assert.ok(bookingHtml.includes('aria-label="Close booking modal"'), 'Booking close button must have aria-label');

  // Link Google Modal
  const linkMatch = mainCode.match(/function linkGoogleAccountModal\(\)\s*\{([\s\S]*?)\nfunction attachPageHandlers/);
  assert.ok(linkMatch, "linkGoogleAccountModal should exist");
  const linkHtml = linkMatch[1];
  assert.ok(linkHtml.includes('role="dialog"'), 'Link modal must have role="dialog"');
  assert.ok(linkHtml.includes('aria-modal="true"'), 'Link modal must have aria-modal="true"');
  assert.ok(linkHtml.includes('aria-labelledby="link-google-modal-title"'), 'Link modal must have aria-labelledby');
  assert.ok(linkHtml.includes('id="link-google-modal-title"'), 'Link modal must have matching title id');

  // CBT Daily Diary Modal
  const diaryMatch = mainCode.match(/<!-- DAILY DIARY OVERLAY MODAL -->([\s\S]*?Diary Entries)/);
  assert.ok(diaryMatch, "Daily diary modal should exist");
  const diaryHtml = diaryMatch[1];
  assert.ok(diaryHtml.includes('role="dialog"'), 'Diary modal must have role="dialog"');
  assert.ok(diaryHtml.includes('aria-modal="true"'), 'Diary modal must have aria-modal="true"');
  assert.ok(diaryHtml.includes('aria-labelledby="cbt-diary-modal-title"'), 'Diary modal must have aria-labelledby');
  assert.ok(diaryHtml.includes('aria-label="Close daily diary"'), 'Diary close button must have aria-label');
});

test("MH-28: Focus entry moves focus into active modal", async () => {
  const { manageModalAccessibility } = await import("../src/main.js");

  const modalDialog = new MockElement("div");
  modalDialog.setAttribute("role", "dialog");
  modalDialog.setAttribute("aria-modal", "true");

  const closeBtn = new MockElement("button");
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.parentElement = modalDialog;

  const emailInput = new MockElement("input");
  emailInput.setAttribute("type", "email");
  emailInput.parentElement = modalDialog;

  modalDialog.children = [closeBtn, emailInput];
  modalDialog.querySelectorAll = (sel) => [closeBtn, emailInput];

  mockDocument._customQuery = (sel) => {
    if (sel.includes('[role="dialog"]')) return modalDialog;
    return null;
  };
  globalThis.document.activeElement = new MockElement("button"); // Outside trigger button

  manageModalAccessibility();

  // Focus must have entered the modal (preferably first input or close button)
  assert.ok(
    globalThis.document.activeElement === emailInput || globalThis.document.activeElement === closeBtn,
    "Focus must enter modal on open"
  );
  mockDocument._customQuery = null;
});

test("MH-28: Keyboard navigation traps focus inside dialog (Tab and Shift+Tab wrap)", async () => {
  const { handleModalKeydown } = await import("../src/main.js");

  const modalDialog = new MockElement("div");
  modalDialog.setAttribute("role", "dialog");
  modalDialog.setAttribute("aria-modal", "true");

  const firstBtn = new MockElement("button");
  firstBtn.parentElement = modalDialog;

  const inputEl = new MockElement("input");
  inputEl.parentElement = modalDialog;

  const lastBtn = new MockElement("button");
  lastBtn.parentElement = modalDialog;

  modalDialog.querySelectorAll = () => [firstBtn, inputEl, lastBtn];
  mockDocument._customQuery = (sel) => {
    if (sel.includes('[role="dialog"]')) return modalDialog;
    return null;
  };

  // Case 1: Tab on last focusable element wraps to first focusable element
  globalThis.document.activeElement = lastBtn;
  let prevented = false;
  const tabEvent = {
    key: "Tab",
    shiftKey: false,
    preventDefault: () => { prevented = true; }
  };
  handleModalKeydown(tabEvent);

  assert.strictEqual(prevented, true, "Tab on last element must prevent default browser focus leap");
  assert.strictEqual(globalThis.document.activeElement, firstBtn, "Focus must wrap to first element");

  // Case 2: Shift+Tab on first focusable element wraps to last focusable element
  globalThis.document.activeElement = firstBtn;
  let shiftPrevented = false;
  const shiftTabEvent = {
    key: "Tab",
    shiftKey: true,
    preventDefault: () => { shiftPrevented = true; }
  };
  handleModalKeydown(shiftTabEvent);

  assert.strictEqual(shiftPrevented, true, "Shift+Tab on first element must prevent default");
  assert.strictEqual(globalThis.document.activeElement, lastBtn, "Focus must wrap to last element");

  // Case 3: Focus outside modal wraps into modal on Tab
  globalThis.document.activeElement = new MockElement("body");
  let outsidePrevented = false;
  handleModalKeydown({
    key: "Tab",
    shiftKey: false,
    preventDefault: () => { outsidePrevented = true; }
  });
  assert.strictEqual(outsidePrevented, true);
  assert.strictEqual(globalThis.document.activeElement, firstBtn, "Outside focus must enter first element on Tab");

  mockDocument._customQuery = null;
});

test("MH-28: Escape key and close actions dismiss modal and restore focus to trigger element", async () => {
  const { handleModalKeydown, restoreModalFocus, state } = await import("../src/main.js");

  const triggerButton = new MockElement("button");
  triggerButton.id = "launch-dream-analysis-btn";
  triggerButton.parentElement = globalThis.document.body;

  // Open dream auth modal and record trigger element
  state.modalTriggerElement = triggerButton;
  state.showDreamAuthModal = true;

  const modalDialog = new MockElement("div");
  modalDialog.setAttribute("role", "dialog");
  modalDialog.setAttribute("aria-modal", "true");

  mockDocument._customQuery = (sel) => {
    if (sel.includes('[role="dialog"]')) return modalDialog;
    return null;
  };

  let escPrevented = false;

  // Simulate Escape key press
  handleModalKeydown({
    key: "Escape",
    preventDefault: () => { escPrevented = true; }
  });

  assert.strictEqual(escPrevented, true, "Escape key must be intercepted");

  // Manually test focus restoration
  restoreModalFocus(triggerButton);
  assert.strictEqual(globalThis.document.activeElement, triggerButton, "Focus must be restored to trigger button");
  assert.strictEqual(state.modalTriggerElement, null, "modalTriggerElement should be cleared after restoration");

  mockDocument._customQuery = null;
});

test("MH-28: Modal backdrop click dismisses modal without trapping user", async () => {
  const mainCode = fs.readFileSync(path.resolve("src/main.js"), "utf8");

  // Check that backdrop click listeners are wired
  assert.ok(
    mainCode.includes('document.querySelectorAll(".modal-overlay").forEach'),
    "Backdrop overlay click listener must be present"
  );
  assert.ok(
    mainCode.includes("closeAnyOpenModal()"),
    "Backdrop click must call closeAnyOpenModal()"
  );
});

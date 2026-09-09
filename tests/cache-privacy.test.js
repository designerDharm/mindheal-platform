import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

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
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

// Setup global mock storage
globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.IntersectionObserver = class {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.ResizeObserver = class {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { origin: "http://localhost:3000", hash: "" },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  scrollTo: () => {},
  scroll: () => {},
  IntersectionObserver: globalThis.IntersectionObserver,
  ResizeObserver: globalThis.ResizeObserver
};
globalThis.document = {
  documentElement: { setAttribute: () => {}, getAttribute: () => null },
  querySelector: () => ({ addEventListener: () => {}, appendChild: () => {}, setAttribute: () => {}, querySelectorAll: () => [] }),
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  createTreeWalker: () => ({ nextNode: () => null }),
  createElement: () => ({
    appendChild: () => {},
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} },
    style: {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

const {
  clearPrivateUserData,
  clearAuthSession,
  saveAuthSession,
  SENSITIVE_STORAGE_KEYS,
  api
} = await import("../src/services/mock-api.js");

const {
  getDefaultAiMessages,
  getDefaultExposures,
  getDefaultActivities,
  getAccountScopedStorageKey,
  loadUserData,
  saveUserData,
  resetAccountState,
  loadUserPrivateState,
  performLogout
} = await import("../src/main.js");

test("MH-18: Protect private browser caches on logout and account switching", async (t) => {

  t.beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    resetAccountState();
  });

  await t.test("1. SENSITIVE_STORAGE_KEYS includes all chat, diary, and wellness storage items", () => {
    const requiredKeys = [
      "cbt-daily-diary",
      "cbt-thought-diary",
      "cbt-exposure-hierarchy",
      "cbt-behavioral-activation",
      "cbt-worry-time",
      "mindheal-ai-chat",
      "mindheal-thought-mirror-sessions",
      "mindheal-unsent-letters",
      "mindheal-grounding-sessions"
    ];

    for (const key of requiredKeys) {
      assert.ok(
        SENSITIVE_STORAGE_KEYS.includes(key),
        `SENSITIVE_STORAGE_KEYS must include ${key}`
      );
    }
  });

  await t.test("2. clearPrivateUserData purges both scoped and unscoped sensitive caches", () => {
    // Populate legacy unscoped and account-scoped sensitive data
    globalThis.localStorage.setItem("cbt-daily-diary", JSON.stringify([{ id: 1, text: "Secret Diary A" }]));
    globalThis.localStorage.setItem("cbt-thought-diary", JSON.stringify([{ id: 2, text: "Secret Thought A" }]));
    globalThis.localStorage.setItem("mindheal-ai-chat", JSON.stringify([{ text: "Secret Chat A" }]));
    globalThis.localStorage.setItem("cbt-daily-diary:usr_account_a", JSON.stringify([{ id: 3, text: "Scoped Diary A" }]));
    globalThis.localStorage.setItem("mindheal-unsent-letters:usr_account_a", JSON.stringify([{ id: 4, text: "Private Letter A" }]));
    globalThis.localStorage.setItem("mindheal-grounding-sessions:usr_account_a", JSON.stringify([{ id: 5 }]));
    
    // Also in sessionStorage
    globalThis.sessionStorage.setItem("cbt-daily-diary", JSON.stringify([{ id: 6 }]));
    globalThis.sessionStorage.setItem("cbt-daily-diary:usr_account_a", JSON.stringify([{ id: 7 }]));

    // Preserve non-sensitive preference
    globalThis.localStorage.setItem("mindheal-language", "en");
    globalThis.localStorage.setItem("sidebar-collapsed", "true");

    clearPrivateUserData("usr_account_a");

    // All sensitive items must be gone
    assert.strictEqual(globalThis.localStorage.getItem("cbt-daily-diary"), null);
    assert.strictEqual(globalThis.localStorage.getItem("cbt-thought-diary"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-ai-chat"), null);
    assert.strictEqual(globalThis.localStorage.getItem("cbt-daily-diary:usr_account_a"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-unsent-letters:usr_account_a"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-grounding-sessions:usr_account_a"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("cbt-daily-diary"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("cbt-daily-diary:usr_account_a"), null);

    // Non-sensitive preferences remain intact
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-language"), "en");
    assert.strictEqual(globalThis.localStorage.getItem("sidebar-collapsed"), "true");
  });

  await t.test("3. Account B cannot see Account A's data after Account A logs out and Account B logs in", async () => {
    const userA_id = "usr_patient_alice";
    const userB_id = "usr_patient_bob";

    // 1. Account A logs in
    saveAuthSession({ accessToken: "token_a", user: { id: userA_id, fullName: "Alice" } }, false);
    loadUserPrivateState(userA_id);

    // 2. Account A writes private wellness data
    const aliceDiary = [{ id: "d1", notes: "Alice's deepest personal reflection", createdAt: "2026-09-09" }];
    const aliceThoughts = [{ id: "t1", automaticThought: "Alice's negative thought", distortion: "Catastrophizing" }];
    const aliceChat = [{ role: "user", text: "Alice asking for therapy guidance on family trauma" }];
    const aliceLetters = [{ id: "l1", recipient: "Former Boss", body: "Private unsent letter from Alice" }];

    saveUserData("cbt-daily-diary", aliceDiary, userA_id);
    saveUserData("cbt-thought-diary", aliceThoughts, userA_id);
    saveUserData("mindheal-ai-chat", aliceChat, userA_id);
    saveUserData("mindheal-unsent-letters", aliceLetters, userA_id);

    // Verify Alice can see her data
    assert.deepStrictEqual(loadUserData("cbt-daily-diary", [], userA_id), aliceDiary);
    assert.deepStrictEqual(loadUserData("cbt-thought-diary", [], userA_id), aliceThoughts);
    assert.deepStrictEqual(loadUserData("mindheal-ai-chat", [], userA_id), aliceChat);
    assert.deepStrictEqual(loadUserData("mindheal-unsent-letters", [], userA_id), aliceLetters);

    // 3. Account A logs out
    await performLogout();

    // Verify in-memory state was completely reset
    assert.deepStrictEqual(loadUserData("cbt-daily-diary", [], null), []);
    assert.deepStrictEqual(loadUserData("cbt-thought-diary", [], null), []);
    assert.deepStrictEqual(loadUserData("mindheal-unsent-letters", [], null), []);

    // 4. Account B logs in on the exact same browser
    saveAuthSession({ accessToken: "token_b", user: { id: userB_id, fullName: "Bob" } }, false);
    loadUserPrivateState(userB_id);

    // Verify Account B has completely empty/default state with ZERO trace of Alice's data
    const bobDiary = loadUserData("cbt-daily-diary", [], userB_id);
    const bobThoughts = loadUserData("cbt-thought-diary", [], userB_id);
    const bobChat = loadUserData("mindheal-ai-chat", null, userB_id);
    const bobLetters = loadUserData("mindheal-unsent-letters", [], userB_id);

    assert.deepStrictEqual(bobDiary, [], "Bob must not see Alice's daily diary entries");
    assert.deepStrictEqual(bobThoughts, [], "Bob must not see Alice's thought diary entries");
    assert.strictEqual(bobChat, null, "Bob must not see Alice's AI therapy chat history");
    assert.deepStrictEqual(bobLetters, [], "Bob must not see Alice's unsent letters");

    // 5. Account B writes their own data
    const bobOwnDiary = [{ id: "d2", notes: "Bob's work anxiety reflection" }];
    saveUserData("cbt-daily-diary", bobOwnDiary, userB_id);

    assert.deepStrictEqual(loadUserData("cbt-daily-diary", [], userB_id), bobOwnDiary);
    // Alice's partition must still be absent
    assert.deepStrictEqual(loadUserData("cbt-daily-diary", [], userA_id), []);
  });

  await t.test("4. Account switching directly resets in-memory state and reloads fresh partition", () => {
    const userA_id = "usr_switch_a";
    const userB_id = "usr_switch_b";

    // Setup User A
    loadUserPrivateState(userA_id);
    saveUserData("cbt-worry-time", [{ id: "w1", thought: "Alice worry" }], userA_id);

    // Account switch triggered
    resetAccountState(userA_id);
    loadUserPrivateState(userB_id);

    // Bob must see no worry logs
    const bobWorry = loadUserData("cbt-worry-time", [], userB_id);
    assert.deepStrictEqual(bobWorry, []);
  });

  await t.test("5. Verify main.js wires logout buttons and resolvePage to performLogout and resetAccountState", () => {
    const mainJsContent = fs.readFileSync(path.resolve("src/main.js"), "utf-8");

    // Both ob-logout and logout call performLogout
    assert.match(
      mainJsContent,
      /document\.querySelectorAll\(["']\[data-action=['"]ob-logout['"]\]["']\)\.forEach\([^)]*\)\s*=>\s*\{[^}]*await performLogout\(\)/
    );
    assert.match(
      mainJsContent,
      /document\.querySelectorAll\(["']\[data-action=['"]logout['"]\]["']\)\.forEach\([^)]*\)\s*=>\s*\{[^}]*await performLogout\(\)/
    );

    // resolvePage handles /auth/logout
    assert.match(mainJsContent, /if \(path === ["']\/auth\/logout["']\) \{\s*await performLogout\(\);/);

    // resolvePage detects account switch and resets account state
    assert.match(mainJsContent, /if \(currentUserId !== newUserId\) \{\s*if \(currentUserId !== null\) \{\s*resetAccountState\(currentUserId\);/);
  });
});

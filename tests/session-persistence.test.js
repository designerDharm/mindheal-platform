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
}

// Set up browser-like environment in global scope before importing mock-api
globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { origin: "http://localhost:3000" }
};

const {
  getAccessToken,
  getRefreshToken,
  isSessionPersistent,
  saveAuthSession,
  clearAuthSession,
  refreshAuthSession,
  api
} = await import("../src/services/mock-api.js");

test("MH-31: Session-only and persistent login behavior", async (t) => {

  t.beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  await t.test("1. Session-only login (stayLogged: false) isolates tokens in sessionStorage", () => {
    const mockSession = {
      accessToken: "session_access_123",
      refreshToken: "session_refresh_123"
    };

    saveAuthSession(mockSession, false);

    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), "session_access_123");
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-refresh-token"), "session_refresh_123");
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(isSessionPersistent(), false);
    assert.strictEqual(getAccessToken(), "session_access_123");
    assert.strictEqual(getRefreshToken(), "session_refresh_123");
  });

  await t.test("2. Persistent login (stayLogged: true) stores tokens in localStorage", () => {
    const mockSession = {
      accessToken: "persistent_access_456",
      refreshToken: "persistent_refresh_456"
    };

    saveAuthSession(mockSession, true);

    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), "persistent_access_456");
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-refresh-token"), "persistent_refresh_456");
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-auth-storage"), "local");
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(isSessionPersistent(), true);
    assert.strictEqual(getAccessToken(), "persistent_access_456");
    assert.strictEqual(getRefreshToken(), "persistent_refresh_456");
  });

  await t.test("3. Closing and reopening browser terminates session-only login", () => {
    // 1. User logs in with stayLogged: false
    saveAuthSession({ accessToken: "temp_access", refreshToken: "temp_refresh" }, false);
    assert.strictEqual(getAccessToken(), "temp_access");

    // 2. User closes browser -> sessionStorage is destroyed by the browser
    globalThis.sessionStorage.clear();

    // 3. Reopening browser -> user is no longer logged in
    assert.strictEqual(getAccessToken(), null);
    assert.strictEqual(getRefreshToken(), null);
    assert.strictEqual(isSessionPersistent(), false);
  });

  await t.test("4. Closing and reopening browser preserves persistent login", () => {
    // 1. User logs in with stayLogged: true
    saveAuthSession({ accessToken: "saved_access", refreshToken: "saved_refresh" }, true);
    assert.strictEqual(getAccessToken(), "saved_access");

    // 2. User closes browser -> sessionStorage is cleared, but localStorage persists
    globalThis.sessionStorage.clear();

    // 3. Reopening browser -> persistent tokens are intact
    assert.strictEqual(getAccessToken(), "saved_access");
    assert.strictEqual(getRefreshToken(), "saved_refresh");
    assert.strictEqual(isSessionPersistent(), true);
  });

  await t.test("5. Switching login mode purges opposite storage completely", () => {
    // Start with persistent login
    saveAuthSession({ accessToken: "access_p", refreshToken: "refresh_p" }, true);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), "access_p");

    // Re-login as session-only
    saveAuthSession({ accessToken: "access_s", refreshToken: "refresh_s" }, false);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), "access_s");
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-refresh-token"), "refresh_s");
    assert.strictEqual(isSessionPersistent(), false);

    // Switch back to persistent
    saveAuthSession({ accessToken: "access_p2", refreshToken: "refresh_p2" }, true);
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), "access_p2");
    assert.strictEqual(isSessionPersistent(), true);
  });

  await t.test("6. clearAuthSession removes all tokens and storage flags from both storages", () => {
    globalThis.sessionStorage.setItem("mindheal-access-token", "s1");
    globalThis.sessionStorage.setItem("mindheal-refresh-token", "s2");
    globalThis.localStorage.setItem("mindheal-access-token", "l1");
    globalThis.localStorage.setItem("mindheal-refresh-token", "l2");
    globalThis.localStorage.setItem("mindheal-auth-storage", "local");

    clearAuthSession();

    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-refresh-token"), null);
    assert.strictEqual(globalThis.localStorage.getItem("mindheal-auth-storage"), null);
    assert.strictEqual(getAccessToken(), null);
    assert.strictEqual(getRefreshToken(), null);
  });

  await t.test("7. Token refresh retains session persistence mode", async () => {
    const originalFetch = globalThis.fetch;
    try {
      // 1. Setup persistent session
      saveAuthSession({ accessToken: "old_access", refreshToken: "old_refresh" }, true);
      assert.strictEqual(isSessionPersistent(), true);

      // 2. Mock fetch to return refreshed tokens
      globalThis.fetch = async (url, opts) => {
        if (url.includes("/auth/refresh")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                accessToken: "new_access",
                refreshToken: "new_refresh",
                user: { id: "u1" }
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const refreshed = await refreshAuthSession();
      assert.ok(refreshed);
      assert.strictEqual(refreshed.accessToken, "new_access");
      // Must still be persistent in localStorage
      assert.strictEqual(globalThis.localStorage.getItem("mindheal-access-token"), "new_access");
      assert.strictEqual(globalThis.localStorage.getItem("mindheal-refresh-token"), "new_refresh");
      assert.strictEqual(globalThis.sessionStorage.getItem("mindheal-access-token"), null);
      assert.strictEqual(isSessionPersistent(), true);

      // 3. Test failed refresh clears storage
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: "Token expired" })
      });

      const failedRefresh = await refreshAuthSession();
      assert.strictEqual(failedRefresh, null);
      assert.strictEqual(getAccessToken(), null);
      assert.strictEqual(getRefreshToken(), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("8. Verify UI code wiring for stayLogged in main.js and i18n.js", () => {
    const mainJsContent = fs.readFileSync(path.resolve("src/main.js"), "utf-8");
    const i18nJsContent = fs.readFileSync(path.resolve("src/utils/i18n.js"), "utf-8");

    // main.js reads #stay-logged checkbox on submit
    assert.match(mainJsContent, /const\s+stayLogged\s*=\s*!!form\.querySelector\(["']#stay-logged["']\)\?\.checked;/);
    // Google social auth reads #stay-logged and passes to api.loginWithFirebase
    assert.match(mainJsContent, /api\.loginWithFirebase\(role,\s*idToken,\s*mode,\s*stayLogged\)/);
    // Onboarding and linking forward stayLogged
    assert.match(mainJsContent, /api\.completeProfile\(state\.onboardingToken,\s*\{[^}]*\},\s*stayLogged\)/);
    assert.match(mainJsContent, /api\.linkGoogle\(state\.linkModal\.email,\s*payload\.password,\s*state\.linkModal\.idToken,\s*state\.linkModal\.role,\s*stayLogged\)/);

    // i18n.js uses api.getAccessToken or checks both sessionStorage and localStorage
    assert.match(i18nJsContent, /sessionStorage\.getItem\(["']mindheal-access-token["']\)\s*\|\|\s*localStorage\.getItem\(["']mindheal-access-token["']\)/);
  });
});

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

// Global mocks
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
  location: { origin: "http://localhost:3000", hostname: "localhost", hash: "" },
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
  api,
  saveAuthSession,
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getCachedAuthUser,
  saveCachedAuthUser,
  refreshAuthSession,
  request
} = await import("../src/services/mock-api.js");

test("MH-22: Global fetching and outage handling", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    sessionStorage.clear();
  });

  await t.test("1. Public pages avoid unnecessary admin and private requests", async () => {
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      };
    };

    // Unauthenticated user navigating to public pages
    localStorage.clear();
    sessionStorage.clear();

    const publicState = await api.getState({ path: "/" });

    assert.strictEqual(publicState.auth, null, "Guest user has null auth");
    // Assert NO admin endpoints were hit
    const adminRequests = requestedUrls.filter(u => u.includes("/admin/"));
    assert.strictEqual(adminRequests.length, 0, `Expected 0 admin requests on public page, got: ${adminRequests.join(", ")}`);
    
    // Assert NO private endpoints were hit for guest
    const privateRequests = requestedUrls.filter(u => u.includes("/wallet") || u.includes("/user/me") || u.includes("/analysis/reports"));
    assert.strictEqual(privateRequests.length, 0, `Expected 0 private requests for unauthenticated visitor, got: ${privateRequests.join(", ")}`);
  });

  await t.test("2. Admin requests are strictly scoped to admin panel for admin role", async () => {
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      const u = String(url);
      requestedUrls.push(u);
      if (u.includes("/user/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: "usr_admin", role: "admin", name: "Admin" } })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      };
    };

    saveAuthSession({
      accessToken: "valid_admin_token",
      refreshToken: "valid_admin_refresh",
      user: { id: "usr_admin", role: "admin", name: "Admin" }
    }, true);

    requestedUrls.length = 0;
    // Logged in as admin, but browsing public services page
    await api.getState({ path: "/services" });
    const publicAdminRequests = requestedUrls.filter(u => u.includes("/admin/"));
    assert.strictEqual(publicAdminRequests.length, 0, "Admin on public page does not trigger admin requests");

    requestedUrls.length = 0;
    // Navigating to admin panel
    await api.getState({ path: "/panel/admin" });
    const panelAdminRequests = requestedUrls.filter(u => u.includes("/admin/"));
    assert.ok(panelAdminRequests.length > 0, "Navigating to admin panel triggers admin endpoints");
  });

  await t.test("3. Preserves valid session during network drop or 503 outage", async () => {
    saveAuthSession({
      accessToken: "active_user_token",
      refreshToken: "active_user_refresh",
      user: { id: "usr_client_1", role: "user", name: "Client One" }
    }, true);

    // Verify initial stored tokens
    assert.strictEqual(getAccessToken(), "active_user_token");
    assert.strictEqual(getRefreshToken(), "active_user_refresh");

    // Simulate 503 Service Unavailable outage
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 503,
        json: async () => ({ success: false, error: "Service Unavailable" })
      };
    };

    const outageState = await api.getState({ path: "/panel/user" });

    // Assert session is NOT destroyed
    assert.strictEqual(getAccessToken(), "active_user_token", "Access token preserved during 503 outage");
    assert.strictEqual(getRefreshToken(), "active_user_refresh", "Refresh token preserved during 503 outage");
    assert.strictEqual(outageState.backendStatus, "outage", "Backend status marked as outage");
    assert.ok(outageState.auth, "User auth preserved from cache during outage");
    assert.strictEqual(outageState.auth.id, "usr_client_1");
  });

  await t.test("4. Preserves session when fetch throws network error", async () => {
    saveAuthSession({
      accessToken: "active_user_token",
      refreshToken: "active_user_refresh",
      user: { id: "usr_client_1", role: "user", name: "Client One" }
    }, true);

    // Simulate complete network failure (offline / DNS drop)
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const networkDropState = await api.getState({ path: "/panel/user" });

    assert.strictEqual(getAccessToken(), "active_user_token", "Access token preserved during network drop");
    assert.strictEqual(networkDropState.backendStatus, "outage");
    assert.ok(networkDropState.auth, "Cached user preserved during offline state");

    // Also verify refreshAuthSession does not wipe tokens on network drop
    const refreshResult = await refreshAuthSession();
    assert.strictEqual(refreshResult, null);
    assert.strictEqual(getAccessToken(), "active_user_token", "Tokens still intact after failed refresh due to network drop");
  });

  await t.test("5. Explicit 401 with invalid refresh token clears session", async () => {
    saveAuthSession({
      accessToken: "expired_token",
      refreshToken: "revoked_refresh",
      user: { id: "usr_client_1", role: "user" }
    }, true);

    // Simulate 401 Unauthorized for both user/me and auth/refresh
    globalThis.fetch = async (url) => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: { message: "Token expired or revoked", code: "TOKEN_EXPIRED" } })
      };
    };

    const state = await api.getState({ path: "/panel/user" });

    assert.strictEqual(getAccessToken(), null, "Access token cleared on genuine 401");
    assert.strictEqual(getRefreshToken(), null, "Refresh token cleared on genuine 401");
    assert.strictEqual(state.auth, null, "Auth reset to null on genuine 401");
  });

  await t.test("6. Request deadline aborts hanging requests cleanly", async () => {
    let wasAborted = false;
    globalThis.fetch = async (url, options) => {
      return new Promise((resolve, reject) => {
        if (options.signal) {
          options.signal.addEventListener("abort", () => {
            wasAborted = true;
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    };

    // Fast 50ms deadline
    const res = await request("/hung-endpoint", { timeoutMs: 50 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.isTimeout, true);
    assert.strictEqual(res.error.code, "DEADLINE_EXCEEDED");
    assert.strictEqual(wasAborted, true, "Fetch signal received abort event");
  });

  await t.test("7. UI code wiring: main.js includes recoverable outage banner and retry action", () => {
    const mainJs = fs.readFileSync(path.resolve("src/main.js"), "utf-8");
    assert.ok(mainJs.includes('outage-banner'), "panelShell renders outage-banner");
    assert.ok(mainJs.includes('data-action="retry-fetch"'), "Outage banner has retry-fetch button");
    assert.ok(mainJs.includes("[data-action='retry-fetch']"), "Global event handler listens for retry-fetch");
    assert.ok(mainJs.includes('api.getState({ path })'), "resolvePage passes path to getState");
  });
});

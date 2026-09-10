import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

// Mock minimal browser environment
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

globalThis.NodeFilter = { SHOW_TEXT: 4 };

globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { hash: "", origin: "http://localhost:3000", hostname: "localhost" },
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

const { getApiBaseUrl, setApiBaseUrl, request } = await import("../src/services/mock-api.js");
const { appConfig: clientAppConfig } = await import("../src/data/mindheal-data.js");
const { createApp } = await import("../backend/src/app.js");

test("MH-34: Align deployed frontend and API, reverse proxy, CORS, and prevent HTML fallthrough", async (t) => {
  await t.test("1. Intended backend origin resolution and dynamic precedence", () => {
    // 1a. Localhost detection
    window.location.hostname = "localhost";
    localStorage.clear();
    delete window.__MINDHEAL_API_URL__;
    assert.strictEqual(getApiBaseUrl(), "http://localhost:4000/api/v1");

    // 1b. Production origin fallback when on non-localhost domain
    window.location.hostname = "mindheal.in";
    const originalApiBaseUrl = clientAppConfig.apiBaseUrl;
    clientAppConfig.apiBaseUrl = "";
    assert.strictEqual(getApiBaseUrl(), "https://mindheal-platform.onrender.com/api/v1");
    clientAppConfig.apiBaseUrl = originalApiBaseUrl;

    // 1c. setApiBaseUrl overrides via localStorage
    setApiBaseUrl("https://staging-api.mindheal.in/api/v1/");
    assert.strictEqual(getApiBaseUrl(), "https://staging-api.mindheal.in/api/v1");
    setApiBaseUrl(null); // reset

    // 1d. Runtime window.__MINDHEAL_API_URL__ takes highest precedence
    window.__MINDHEAL_API_URL__ = "https://custom-api.mindheal.in/api/v1/";
    assert.strictEqual(getApiBaseUrl(), "https://custom-api.mindheal.in/api/v1");
    delete window.__MINDHEAL_API_URL__;

    // Restore localhost for remaining tests
    window.location.hostname = "localhost";
  });

  await t.test("2. Frontend request() rejects 200 HTML fallthrough on API routes", async () => {
    // Mock fetch that simulates an SPA server returning index.html 200 on an API route
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (header) => header.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null
        },
        text: async () => "<!DOCTYPE html><html><head><title>MindHeal</title></head><body><div id='app'></div></body></html>",
        json: async () => { throw new SyntaxError("Unexpected token '<'"); }
      };
    };

    try {
      const result = await request("/invalid-endpoint");
      assert.strictEqual(result.ok, false, "Request must not succeed when receiving HTML");
      assert.strictEqual(result.error.code, "API_HTML_FALLTHROUGH");
      assert.strictEqual(result.status, 404, "Must map 200 HTML fallthrough to an error status (404)");
      assert.strictEqual(result.data, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("3. Backend returns JSON 404 (never HTML) for unmapped API routes", async () => {
    const backendApp = createApp();

    const mockReq = {
      method: "GET",
      url: "/api/v1/nonexistent-route-for-testing",
      headers: {
        origin: "http://localhost:4173",
        "content-type": "application/json"
      },
      socket: { remoteAddress: "127.0.0.1" }
    };

    let statusCode = 0;
    let headers = {};
    let responseBody = "";

    const mockRes = {
      writeHead(code, h) {
        statusCode = code;
        if (h) Object.assign(headers, h);
      },
      setHeader(name, val) {
        headers[name.toLowerCase()] = val;
      },
      end(body) {
        responseBody = body;
      }
    };

    await backendApp.handle(mockReq, mockRes);

    assert.strictEqual(statusCode, 404, "Unmapped API route must return status 404");
    assert.strictEqual(headers["content-type"], "application/json", "Content-Type must be application/json");
    assert.strictEqual(headers["access-control-allow-origin"], "http://localhost:4173", "CORS header must be present");
    assert.strictEqual(headers["x-content-type-options"], "nosniff", "Security header x-content-type-options must be present");

    const parsed = JSON.parse(responseBody);
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, "NOT_FOUND");
    assert.strictEqual(parsed.error.message, "Route not found.");
  });

  await t.test("4. Backend returns JSON 200 for health checks and root endpoint", async () => {
    const backendApp = createApp();

    const endpoints = ["/api/v1/health", "/health", "/"];

    for (const ep of endpoints) {
      let statusCode = 0;
      let headers = {};
      let responseBody = "";

      const mockReq = {
        method: "GET",
        url: ep,
        headers: { origin: "http://localhost:4173" },
        socket: { remoteAddress: "127.0.0.1" }
      };

      const mockRes = {
        writeHead(code, h) {
          statusCode = code;
          if (h) Object.assign(headers, h);
        },
        setHeader(name, val) {
          headers[name.toLowerCase()] = val;
        },
        end(body) {
          responseBody = body;
        }
      };

      await backendApp.handle(mockReq, mockRes);

      assert.strictEqual(statusCode, 200, `${ep} must return 200`);
      assert.strictEqual(headers["content-type"], "application/json", `${ep} must return application/json`);
      const parsed = JSON.parse(responseBody);
      assert.strictEqual(parsed.success, true, `${ep} must return success: true`);
    }
  });

  await t.test("5. Reverse proxy configurations isolate API routes and prevent homepage fallthrough", () => {
    // 5a. vercel.json
    const vercelJson = JSON.parse(fs.readFileSync(path.resolve("vercel.json"), "utf-8"));
    const apiRewrite = vercelJson.rewrites.find(r => r.source.startsWith("/api"));
    const spaFallback = vercelJson.rewrites.find(r => r.destination === "/index.html");
    assert.ok(apiRewrite, "vercel.json must configure API reverse proxy rewrite");
    assert.match(apiRewrite.destination, /https:\/\/mindheal-platform\.onrender\.com\/api/);
    assert.ok(spaFallback, "vercel.json must have SPA fallback");
    assert.match(spaFallback.source, /\(\?!api\/\)/, "SPA fallback must exclude /api/ paths");

    // 5b. serve.json
    const serveJson = JSON.parse(fs.readFileSync(path.resolve("serve.json"), "utf-8"));
    const serveRewrite = serveJson.rewrites.find(r => r.destination === "/index.html");
    assert.ok(serveRewrite, "serve.json must configure SPA rewrite");
    assert.strictEqual(serveRewrite.source, "!/api/**", "serve.json rewrite must strictly exclude /api/** paths");

    // 5c. _redirects
    const redirectsContent = fs.readFileSync(path.resolve("_redirects"), "utf-8");
    assert.match(redirectsContent, /\/api\/\*\s+https:\/\/mindheal-platform\.onrender\.com\/api\/:splat\s+200!/);
    assert.match(redirectsContent, /\/\*\s+\/index\.html\s+200/);

    // 5d. netlify.toml
    const netlifyToml = fs.readFileSync(path.resolve("netlify.toml"), "utf-8");
    assert.match(netlifyToml, /from = "\/api\/\*"/);
    assert.match(netlifyToml, /to = "https:\/\/mindheal-platform\.onrender\.com\/api\/:splat"/);

    // 5e. nginx.conf
    const nginxConf = fs.readFileSync(path.resolve("nginx.conf"), "utf-8");
    assert.match(nginxConf, /location \/api\/ \{[\s\S]*?proxy_pass https:\/\/mindheal-platform\.onrender\.com;/);
    assert.match(nginxConf, /location \/ \{[\s\S]*?try_files \$uri \$uri\/ \/index\.html;/);
  });
});

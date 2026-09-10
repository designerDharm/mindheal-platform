import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createApp, resetMemoryRateLimits } from "../backend/src/app.js";
import { appConfig } from "../backend/src/config/app.js";
import { StorageService } from "../backend/src/services/storage.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function executeRequest(method, pathUrl, { body, headers = {}, ip } = {}) {
  const reqBody = body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = pathUrl;
  req.headers = {
    "content-type": "application/json",
    ...headers
  };
  req.socket = { remoteAddress: ip || `10.201.${Math.floor(Math.random() * 200) + 1}.1` };

  const res = {
    statusCode: 0,
    headers: {},
    payload: "",
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headersToSet = {}) {
      this.statusCode = status;
      Object.entries(headersToSet).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.payload = payload;
      this.writableEnded = true;
    }
  };

  await createApp().handle(req, res);

  let parsedBody = null;
  if (res.payload) {
    try {
      parsedBody = JSON.parse(res.payload);
    } catch {
      parsedBody = res.payload;
    }
  }

  return {
    status: res.statusCode,
    headers: res.headers,
    body: parsedBody
  };
}

test("MH-33: Establish a working HTTPS deployment", async (t) => {
  const prevEnv = appConfig.env;
  const prevHttps = appConfig.enforceHttps;

  t.afterEach(() => {
    appConfig.env = prevEnv;
    appConfig.enforceHttps = prevHttps;
    resetMemoryRateLimits();
  });

  await t.test("1. Production HTTP requests are redirected to HTTPS with 301 and HSTS preload", async () => {
    appConfig.env = "production";
    appConfig.enforceHttps = true;

    const res = await executeRequest("GET", "/api/v1/counsellors", {
      headers: {
        "x-forwarded-proto": "http",
        host: "mindheal-platform.onrender.com"
      }
    });

    assert.strictEqual(res.status, 301, "HTTP request in production must receive 301 redirect");
    assert.strictEqual(res.headers.location, "https://mindheal-platform.onrender.com/api/v1/counsellors");
    assert.ok(
      res.headers["strict-transport-security"]?.includes("preload"),
      "Redirect response must include HSTS preload"
    );
  });

  await t.test("2. ACME challenge requests are exempt from HTTP redirection for certificate verification", async () => {
    appConfig.env = "production";
    appConfig.enforceHttps = true;

    const res = await executeRequest("GET", "/.well-known/acme-challenge/test-token-12345", {
      headers: {
        "x-forwarded-proto": "http",
        host: "mindheal-platform.onrender.com"
      }
    });

    // Should NOT be redirected (should be handled/routed without 301)
    assert.notStrictEqual(res.status, 301, "ACME challenge must not be redirected to HTTPS");
  });

  await t.test("3. Health and readiness endpoints are exempt from HTTP redirection for load-balancer probes", async () => {
    appConfig.env = "production";
    appConfig.enforceHttps = true;

    const healthRes = await executeRequest("GET", "/health", {
      headers: {
        "x-forwarded-proto": "http",
        host: "mindheal-platform.onrender.com"
      }
    });
    assert.strictEqual(healthRes.status, 200, "/health probe over HTTP must return 200 without redirect");

    const apiHealthRes = await executeRequest("GET", "/api/v1/health", {
      headers: {
        "x-forwarded-proto": "http",
        host: "mindheal-platform.onrender.com"
      }
    });
    assert.strictEqual(apiHealthRes.status, 200, "/api/v1/health probe over HTTP must return 200 without redirect");
  });

  await t.test("4. Production HTTPS requests execute without redirection and enforce comprehensive security headers", async () => {
    appConfig.env = "production";
    appConfig.enforceHttps = true;

    const res = await executeRequest("GET", "/api/v1/counsellors", {
      headers: {
        "x-forwarded-proto": "https",
        host: "mindheal-platform.onrender.com"
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["strict-transport-security"]?.includes("max-age=31536000"));
    assert.ok(res.headers["strict-transport-security"]?.includes("includeSubDomains"));
    assert.ok(res.headers["strict-transport-security"]?.includes("preload"));
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(res.headers["x-frame-options"], "DENY");
    assert.ok(
      res.headers["content-security-policy"]?.includes("upgrade-insecure-requests"),
      "CSP must contain upgrade-insecure-requests"
    );
  });

  await t.test("5. Approved canonical HTTPS origins receive matching CORS credentials", async () => {
    const approvedOrigins = [
      "https://mindheal-platform.onrender.com",
      "https://mindheal.in",
      "https://www.mindheal.in"
    ];

    for (const origin of approvedOrigins) {
      const res = await executeRequest("GET", "/api/v1/health", {
        headers: {
          origin,
          "x-forwarded-proto": "https"
        }
      });

      assert.strictEqual(res.headers["access-control-allow-origin"], origin);
      assert.strictEqual(res.headers["access-control-allow-credentials"], "true");
    }
  });

  await t.test("6. Media StorageService outputs secure HTTPS URLs for file uploads", async () => {
    const fakeBuffer = Buffer.from("dummy file content");
    const result = await StorageService.uploadFile(fakeBuffer, "test-doc.pdf", "application/pdf");

    assert.ok(result.url, "Must return an upload URL");
    assert.ok(result.url.startsWith("https://"), `Upload URL must be HTTPS: ${result.url}`);
  });

  await t.test("7. Static metadata and server configurations comply with HTTPS deployment standards", () => {
    // index.html
    const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf-8");
    assert.ok(
      indexHtml.includes('<link rel="canonical" href="https://mindheal-platform.onrender.com/"'),
      "index.html must specify canonical HTTPS link"
    );
    assert.ok(
      indexHtml.includes('content="upgrade-insecure-requests"'),
      "index.html must include CSP upgrade-insecure-requests"
    );
    assert.ok(
      indexHtml.includes('<meta property="og:url" content="https://mindheal-platform.onrender.com/"'),
      "index.html must specify og:url with HTTPS"
    );

    // nginx.conf
    const nginxConf = fs.readFileSync(path.join(rootDir, "nginx.conf"), "utf-8");
    assert.ok(nginxConf.includes("listen 80;"), "nginx.conf must listen on port 80");
    assert.ok(nginxConf.includes("listen 443 ssl"), "nginx.conf must listen on port 443 ssl");
    assert.ok(nginxConf.includes("return 301 https://$host$request_uri;"), "nginx.conf must redirect HTTP to HTTPS");
    assert.ok(nginxConf.includes("ssl_protocols TLSv1.2 TLSv1.3;"), "nginx.conf must enforce modern TLS");
    assert.ok(nginxConf.includes("location /.well-known/acme-challenge/"), "nginx.conf must handle ACME challenges");

    // vercel.json
    const vercelJson = JSON.parse(fs.readFileSync(path.join(rootDir, "vercel.json"), "utf-8"));
    const rootHeaderConfig = vercelJson.headers.find((h) => h.source === "/(.*)");
    const hsts = rootHeaderConfig.headers.find((h) => h.key === "Strict-Transport-Security");
    assert.ok(hsts.value.includes("preload"), "vercel.json must include preload in HSTS");
    const csp = rootHeaderConfig.headers.find((h) => h.key === "Content-Security-Policy");
    assert.ok(csp.value.includes("upgrade-insecure-requests"), "vercel.json must include upgrade-insecure-requests");
  });
});

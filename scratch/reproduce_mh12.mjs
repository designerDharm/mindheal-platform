import { createApp } from "../backend/src/app.js";
import { repositories } from "../backend/src/repositories/index.js";
import { hashPassword, signAccessToken, signRefreshToken } from "../backend/src/utils/security.js";
import { Readable } from "node:stream";

const app = createApp();

async function request(method, path, { body, token, headers = {} } = {}) {
  const reqBody = body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...headers
  };
  req.socket = { remoteAddress: "127.0.0.1" };

  const res = {
    statusCode: 0,
    headers: {},
    payload: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.payload = payload;
    }
  };

  await app.handle(req, res);

  return {
    status: res.statusCode,
    body: res.payload ? JSON.parse(res.payload) : null
  };
}

async function run() {
  console.log("=== Reproducing MH-12: Disabled Account Access Vulnerabilities ===");

  const disabledUserId = `usr_disabled_test_${Date.now()}`;
  const email = `disabled_${Date.now()}@example.com`;
  const password = "Password123!";
  const passwordHash = hashPassword(password);

  // 1. Create a disabled user in DB
  await repositories.users.create({
    id: disabledUserId,
    email,
    fullName: "Disabled User",
    passwordHash,
    role: "user",
    isActive: false,
    createdAt: new Date().toISOString()
  });

  // Test 1: Password login with disabled account
  console.log("\n[Test 1] Password login with disabled account");
  const loginRes = await request("POST", "/api/v1/auth/login", {
    body: { email, password, role: "user" }
  });
  console.log(`Login response status: ${loginRes.status}`);
  if (loginRes.status === 200) {
    console.error("❌ VULNERABILITY REPRODUCED: Disabled user successfully logged in with password!");
  } else {
    console.log(`✔ Blocked as expected: ${JSON.stringify(loginRes.body?.error)}`);
  }

  // Test 2: Authenticated API access with valid access token after account is disabled
  console.log("\n[Test 2] Authenticated API access with valid access token for disabled account");
  const token = signAccessToken({ id: disabledUserId, email, role: "user" });
  const apiRes = await request("GET", "/api/v1/user/me", { token });
  console.log(`API response status: ${apiRes.status}`);
  if (apiRes.status === 200) {
    console.error("❌ VULNERABILITY REPRODUCED: Disabled user accessed /api/v1/user/me with access token!");
  } else {
    console.log(`✔ Blocked as expected: ${JSON.stringify(apiRes.body?.error)}`);
  }

  // Test 3: Token refresh for disabled account
  console.log("\n[Test 3] Token refresh for disabled account");
  const refreshToken = signRefreshToken({ id: disabledUserId, email, role: "user" });
  const refreshRes = await request("POST", "/api/v1/auth/refresh", {
    body: { refreshToken }
  });
  console.log(`Refresh response status: ${refreshRes.status}`);
  if (refreshRes.status === 200) {
    console.error("❌ VULNERABILITY REPRODUCED: Disabled user refreshed session!");
  } else {
    console.log(`✔ Blocked as expected: ${JSON.stringify(refreshRes.body?.error)}`);
  }
}

run().catch(console.error);

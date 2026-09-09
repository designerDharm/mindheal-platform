import http from "node:http";
import { io as Client } from "../backend/node_modules/socket.io-client/build/esm/index.js";
import { createApp } from "../backend/src/app.js";
import { initializeSockets } from "../backend/src/socket.js";
import { repositories } from "../backend/src/repositories/index.js";
import { hashPassword, signAccessToken, signRefreshToken, generateTotp } from "../backend/src/utils/security.js";
import { loginWithFirebase } from "../backend/src/services/auth.service.js";
import { appConfig } from "../backend/src/config/app.js";

async function runSuite() {
  console.log("=== Comprehensive MH-12 Verification Suite ===");

  const app = createApp();
  const server = http.createServer((req, res) => app.handle(req, res));
  const io = initializeSockets(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function apiRequest(method, path, { body, token } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }

  try {
    const adminEmail = `admin_mh12_${Date.now()}@example.com`;
    const adminPassword = "AdminPassword123!";
    const adminSecret = "JBSWY3DPEHPK3PXP";
    const adminUser = await repositories.users.create({
      id: `usr_admin_mh12_${Date.now()}`,
      email: adminEmail,
      fullName: "Admin MH12",
      passwordHash: hashPassword(adminPassword),
      role: "admin",
      totpSecret: adminSecret,
      isTotpEnabled: true,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    const adminLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: {
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        totp: generateTotp(adminSecret)
      }
    });
    if (adminLogin.status !== 200 || !adminLogin.body.data?.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    const adminToken = adminLogin.body.data.accessToken;

    // Test Subject: Regular user
    const testEmail = `user_mh12_${Date.now()}@example.com`;
    const testPassword = "UserPassword123!";
    const user = await repositories.users.create({
      id: `usr_test_mh12_${Date.now()}`,
      email: testEmail,
      fullName: "Target Test User",
      passwordHash: hashPassword(testPassword),
      role: "user",
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // 1. User logs in successfully while active
    const initialLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: testEmail, password: testPassword, role: "user" }
    });
    if (initialLogin.status !== 200) {
      throw new Error(`Initial active login failed: ${JSON.stringify(initialLogin.body)}`);
    }
    const userAccessToken = initialLogin.body.data.accessToken;
    const userRefreshToken = initialLogin.body.data.refreshToken;
    console.log("✔ Active user logged in successfully and obtained tokens");

    // 2. Connect to Socket.IO while active
    const socket = Client(baseUrl, {
      auth: { token: userAccessToken },
      transports: ["websocket"]
    });

    await new Promise((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });
    console.log("✔ Active user connected to Socket.IO successfully");

    // Listen for account_disabled event on socket
    let accountDisabledEventReceived = false;
    socket.on("account_disabled", (data) => {
      accountDisabledEventReceived = true;
      console.log("✔ Received account_disabled event on socket:", data);
    });

    // 3. Admin disables the account via PUT /api/v1/admin/users/:id/status
    console.log("\n[Admin Action] Disabling target user account via admin endpoint...");
    const disableRes = await apiRequest("PUT", `/api/v1/admin/users/${user.id}/status`, {
      token: adminToken,
      body: { isActive: false }
    });
    if (disableRes.status !== 200 || disableRes.body.data?.isActive !== false) {
      throw new Error(`Failed to disable user via admin endpoint: ${JSON.stringify(disableRes.body)}`);
    }
    console.log("✔ User account set to isActive: false by administrator");

    // 4. Verify socket disconnection
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!socket.disconnected && !accountDisabledEventReceived) {
      throw new Error("Socket was not disconnected after user account was disabled!");
    }
    console.log("✔ Active socket session was immediately disconnected upon deactivation");

    // 5. Test Password login with disabled account
    console.log("\n[Check 1] Password login with disabled account");
    const disabledLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: testEmail, password: testPassword, role: "user" }
    });
    if (disabledLogin.status !== 403 || disabledLogin.body.error?.message !== "User account is disabled.") {
      throw new Error(`Password login was not blocked properly: status=${disabledLogin.status} body=${JSON.stringify(disabledLogin.body)}`);
    }
    console.log("✔ Password login rejected with HTTP 403: User account is disabled.");

    // 6. Test Authenticated API access using previously issued access token
    console.log("\n[Check 2] Authenticated API access using existing access token");
    const disabledApi = await apiRequest("GET", "/api/v1/user/me", {
      token: userAccessToken
    });
    if (disabledApi.status !== 403 || disabledApi.body.error?.message !== "User account is disabled.") {
      throw new Error(`API access with existing token was not blocked: status=${disabledApi.status} body=${JSON.stringify(disabledApi.body)}`);
    }
    console.log("✔ Existing access token rejected with HTTP 403: User account is disabled.");

    // 7. Test Token refresh using previously issued refresh token
    console.log("\n[Check 3] Token refresh using existing refresh token");
    const disabledRefresh = await apiRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: userRefreshToken }
    });
    if (disabledRefresh.status !== 403 || disabledRefresh.body.error?.message !== "User account is disabled.") {
      throw new Error(`Token refresh was not blocked: status=${disabledRefresh.status} body=${JSON.stringify(disabledRefresh.body)}`);
    }
    console.log("✔ Refresh token rejected with HTTP 403: User account is disabled.");

    // 8. Test Socket.IO connection attempt with disabled account
    console.log("\n[Check 4] New Socket.IO connection attempt with disabled account");
    const newSocket = Client(baseUrl, {
      auth: { token: userAccessToken },
      transports: ["websocket"],
      reconnection: false
    });
    const socketError = await new Promise((resolve) => {
      newSocket.on("connect", () => resolve("CONNECTED_UNEXPECTEDLY"));
      newSocket.on("connect_error", (err) => resolve(err.message));
    });
    if (socketError !== "Account disabled") {
      throw new Error(`Socket connection should fail with 'Account disabled', got: ${socketError}`);
    }
    console.log("✔ New Socket.IO connection rejected: Account disabled");

    // 9. Test Google Sign-In with disabled account
    console.log("\n[Check 5] Google Sign-In with disabled account");
    appConfig.allowFirebaseAuthMock = true;
    const googleResult = await loginWithFirebase(`mock-token-${testEmail}-uid_disabled-DisabledUser`, "user", "signin");
    if (googleResult.status !== "ACCOUNT_RESTRICTED") {
      throw new Error(`Google login should return ACCOUNT_RESTRICTED, got: ${JSON.stringify(googleResult)}`);
    }
    console.log("✔ Google login returned status: ACCOUNT_RESTRICTED without issuing session");

    // 10. Reactivate user and verify restoration
    console.log("\n[Check 6] Reactivate user account via admin endpoint");
    const reactivateRes = await apiRequest("PUT", `/api/v1/admin/users/${user.id}/status`, {
      token: adminToken,
      body: { isActive: true }
    });
    if (reactivateRes.status !== 200 || reactivateRes.body.data?.isActive !== true) {
      throw new Error(`Failed to reactivate user: ${JSON.stringify(reactivateRes.body)}`);
    }

    const reactivatedLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: testEmail, password: testPassword, role: "user" }
    });
    if (reactivatedLogin.status !== 200 || !reactivatedLogin.body.data?.accessToken) {
      throw new Error(`Reactivated login failed: ${JSON.stringify(reactivatedLogin.body)}`);
    }
    console.log("✔ Reactivated user successfully logged in and resumed normal operation");

    console.log("\n=============================================");
    console.log("ALL MH-12 DISABLED ACCOUNT CHECKS PASSED!");
    console.log("=============================================");
  } finally {
    server.close();
  }
}

runSuite().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

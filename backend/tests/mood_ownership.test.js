import test from "node:test";
import assert from "node:assert";
import { logMood, getMoodHistory } from "../src/controllers/user.controller.js";
import { repositories } from "../src/repositories/index.js";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/utils/security.js";

test("MH-21: Mood log ownership enforcement", async (t) => {
  const userA = { id: "usr_mood_a", role: "user", email: "usera@example.com", status: "active", isActive: true };
  const userB = { id: "usr_mood_b", role: "user", email: "userb@example.com", status: "active", isActive: true };
  const adminUser = { id: "usr_mood_admin", role: "admin", email: "admin@example.com", status: "active", isActive: true };

  await repositories.users.create(userA);
  await repositories.users.create(userB);
  await repositories.users.create(adminUser);

  await t.test("1. logMood ignores client-supplied userId and sets authenticated owner", async () => {
    const response = await logMood({
      body: {
        score: 9,
        note: "Feeling great today",
        userId: userB.id, // Attempting to assign ownership to User B
        user_id: userB.id,
        ownerId: userB.id,
        id: "mood_client_supplied_id"
      },
      user: userA
    });

    assert.strictEqual(response.status, 201);
    assert.ok(response.body.success);
    const createdLog = response.body.data;

    // Record MUST be owned strictly by User A
    assert.strictEqual(createdLog.userId, userA.id, "Owner must be authenticated user, not client-supplied userId");
    assert.notStrictEqual(createdLog.id, "mood_client_supplied_id", "Record ID must be server-generated");
    assert.strictEqual(createdLog.score, 9);
    assert.strictEqual(createdLog.note, "Feeling great today");

    // Verify in repository: User B must have NO logs
    const logsB = await repositories.moodLogs.listByUser(userB.id);
    assert.strictEqual(logsB.length, 0, "Supplying User B ID must not create any record for User B");

    // Verify in repository: User A has the log
    const logsA = await repositories.moodLogs.listByUser(userA.id);
    assert.strictEqual(logsA.length, 1);
    assert.strictEqual(logsA[0].id, createdLog.id);
    assert.strictEqual(logsA[0].userId, userA.id);
  });

  await t.test("2. End-to-end dispatch: POST /api/v1/user/mood/log and /api/v1/user/mood-logs", async () => {
    const app = createApp();

    async function dispatch({ method, url, token, body }) {
      const { createServer } = await import("node:http");
      // Use internal app.handle directly
      let resHeaders = {};
      let resStatusCode = 200;
      let resBody = "";

      const req = {
        method,
        url,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        socket: { remoteAddress: "127.0.0.1" },
        [Symbol.asyncIterator]: async function* () {
          if (body) yield Buffer.from(JSON.stringify(body));
        }
      };

      const res = {
        writeHead: (code, headers) => {
          resStatusCode = code;
          if (headers) resHeaders = { ...resHeaders, ...headers };
        },
        setHeader: (k, v) => {
          resHeaders[k] = v;
        },
        getHeader: (k) => resHeaders[k],
        end: (chunk) => {
          if (chunk) resBody += chunk;
        }
      };

      await app.handle(req, res);
      return {
        status: resStatusCode,
        headers: resHeaders,
        body: resBody ? JSON.parse(resBody) : null
      };
    }

    const tokenA = signAccessToken(userA);

    // Call POST /api/v1/user/mood-logs with foreign userId
    const res1 = await dispatch({
      method: "POST",
      url: "/api/v1/user/mood-logs",
      token: tokenA,
      body: {
        score: 7,
        note: "Testing mood-logs alias with foreign owner",
        userId: "usr_mood_b"
      }
    });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.body.data.userId, userA.id, "Must be created strictly for user A");

    // Call POST /api/v1/user/mood/log with foreign userId
    const res2 = await dispatch({
      method: "POST",
      url: "/api/v1/user/mood/log",
      token: tokenA,
      body: {
        score: 8,
        note: "Testing /user/mood/log with foreign owner",
        userId: "usr_mood_b"
      }
    });

    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res2.body.data.userId, userA.id, "Must be created strictly for user A");

    // Confirm User B still has 0 mood logs
    const logsB = await repositories.moodLogs.listByUser(userB.id);
    assert.strictEqual(logsB.length, 0, "User B must not have any records created by User A");
  });

  await t.test("3. getMoodHistory scopes history to requesting user unless admin", async () => {
    // User B calls getMoodHistory
    const histB = await getMoodHistory({ user: userB });
    assert.strictEqual(histB.status, 200);
    assert.strictEqual(histB.body.data.length, 0);

    // User A calls getMoodHistory
    const histA = await getMoodHistory({ user: userA });
    assert.strictEqual(histA.status, 200);
    assert.strictEqual(histA.body.data.length >= 3, true);
    for (const log of histA.body.data) {
      assert.strictEqual(log.userId, userA.id);
    }

    // User B attempts to view User A's history via query param -> ignored for non-admin
    const histBAttempt = await getMoodHistory({ query: { userId: userA.id }, user: userB });
    assert.strictEqual(histBAttempt.status, 200);
    assert.strictEqual(histBAttempt.body.data.length, 0, "Non-admin cannot inspect another user's logs via query");

    // Admin can view User A's logs via query param
    const histAdmin = await getMoodHistory({ query: { userId: userA.id }, user: adminUser });
    assert.strictEqual(histAdmin.status, 200);
    assert.strictEqual(histAdmin.body.data.length >= 3, true);
  });
});

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const disposableDbName = `mindheal_disposable_int_test_${Date.now()}`;
const rootDbUrl = "postgresql:///mindheal?host=/tmp";
const disposableDbUrl = `postgresql:///${disposableDbName}?host=/tmp`;

// Configure environment for PostgreSQL testing
process.env.NODE_ENV = "test";
process.env.REPOSITORY_DRIVER = "postgres";
process.env.DATABASE_URL = disposableDbUrl;
process.env.RAZORPAY_KEY_SECRET = "test_pg_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_pg_webhook_secret";
delete process.env.RAZORPAY_KEY_ID;

let testPool = null;
let rootPool = null;
let repositories = null;
let memoryRepositories = null;
let walletController = null;
let walletService = null;
let dbModule = null;
let securityUtils = null;
let canConnect = false;

test("Complete PostgreSQL Integration Testing", async (t) => {
  t.before(async () => {
    try {
      rootPool = new pg.Pool({ connectionString: rootDbUrl });
      await rootPool.query("SELECT 1");
      canConnect = true;
    } catch (err) {
      console.warn(`[PG-TEST] PostgreSQL not accessible (${err.message}). Integration tests will skip.`);
      return;
    }

    // 1. Create Disposable Database
    await rootPool.query(`DROP DATABASE IF EXISTS ${disposableDbName} WITH (FORCE)`);
    await rootPool.query(`CREATE DATABASE ${disposableDbName}`);
    console.log(`[PG-TEST] Created disposable database: ${disposableDbName}`);

    testPool = new pg.Pool({ connectionString: disposableDbUrl });

    // 2. Run all migrations against disposable database
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version varchar(255) PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      );
    `);

    const migrationsDir = path.join(backendRoot, "migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of migrationFiles) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      const client = await testPool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sqlContent);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Failed to apply migration ${file}: ${err.message}`);
      } finally {
        client.release();
      }
    }
    console.log(`[PG-TEST] Successfully applied ${migrationFiles.length} migrations to ${disposableDbName}`);

    // Dynamic imports after database exists
    const reposMod = await import("../src/repositories/index.js");
    repositories = reposMod.repositories;
    const memMod = await import("../src/repositories/memory/index.js");
    memoryRepositories = memMod.memoryRepositories;
    walletController = await import("../src/controllers/wallet.controller.js");
    walletService = await import("../src/services/wallet.service.js");
    dbModule = await import("../src/data/db.js");
    securityUtils = await import("../src/utils/security.js");
  });

  t.after(async () => {
    if (dbModule?.pool) {
      dbModule.pool.removeAllListeners("error");
      await dbModule.pool.end();
    }
    if (testPool) {
      testPool.removeAllListeners("error");
      await testPool.end();
    }
    if (rootPool && canConnect) {
      await rootPool.query(`DROP DATABASE IF EXISTS ${disposableDbName} WITH (FORCE)`);
      console.log(`[PG-TEST] Dropped disposable database: ${disposableDbName}`);
      rootPool.removeAllListeners("error");
      await rootPool.end();
    }
  });

  await t.test("1. Migration Integrity: Schema migrations and tables are complete", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const migs = await testPool.query("SELECT version FROM schema_migrations ORDER BY version");
    assert.strictEqual(migs.rows.length, 16, "All 16 migrations must be recorded in schema_migrations");

    const tables = await testPool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    assert.ok(tables.rows.length >= 45, `Expected at least 45 tables, found ${tables.rows.length}`);

    // Verify key tables exist
    const tableNames = new Set(tables.rows.map(r => r.table_name));
    const requiredTables = [
      "users", "counsellors", "availability_slots", "sessions", 
      "payment_orders", "ledger_entries", "mood_logs", "screenings",
      "peer_sessions", "analysis_reports", "schema_migrations", "payout_records"
    ];
    for (const reqTable of requiredTables) {
      assert.ok(tableNames.has(reqTable), `Required table '${reqTable}' must exist in PostgreSQL`);
    }
  });

  await t.test("2. Transaction & Rollback Integrity: Atomicity across multi-table operations", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const userId = securityUtils.createId("usr_tx");
    const email = `tx_${Date.now()}@example.com`;

    // Case A: Successful transaction commits
    await dbModule.withTransaction(async () => {
      await dbModule.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
         VALUES ($1, $2, 'hash123', 'Tx User', 'user', true, NOW())`,
        [userId, email]
      );
      await dbModule.query(
        `INSERT INTO mood_logs (id, user_id, score, note, created_at)
         VALUES ($1, $2, 8, 'Feeling energetic', NOW())`,
        [securityUtils.createId("mood_tx"), userId]
      );
    });

    const userCheck = await testPool.query("SELECT * FROM users WHERE id = $1", [userId]);
    assert.strictEqual(userCheck.rows.length, 1, "Committed user must exist");
    const moodCheck = await testPool.query("SELECT * FROM mood_logs WHERE user_id = $1", [userId]);
    assert.strictEqual(moodCheck.rows.length, 1, "Committed mood log must exist");

    // Case B: Failed transaction completely rolls back
    const failUserId = securityUtils.createId("usr_fail");
    const failEmail = `fail_${Date.now()}@example.com`;

    await assert.rejects(async () => {
      await dbModule.withTransaction(async () => {
        await dbModule.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
           VALUES ($1, $2, 'hash123', 'Fail User', 'user', true, NOW())`,
          [failUserId, failEmail]
        );
        // Simulate an unhandled error inside transaction block
        throw new Error("Simulated database failure mid-transaction");
      });
    }, /Simulated database failure mid-transaction/);

    const failUserCheck = await testPool.query("SELECT * FROM users WHERE id = $1", [failUserId]);
    assert.strictEqual(failUserCheck.rows.length, 0, "Rolled-back user must NOT exist in database");
  });

  await t.test("3. Uniqueness Constraints: Enforces duplicate email, mobile, and idempotency rejection", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const dupEmail = `dup_${Date.now()}@example.com`;
    const origUserId = securityUtils.createId("usr_orig");

    // Insert original record
    await testPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
       VALUES ($1, $2, 'hash123', 'Original User', 'user', true, NOW())`,
      [origUserId, dupEmail]
    );

    // Attempt duplicate (email, role) insert -> throws 23505
    await assert.rejects(async () => {
      await testPool.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
         VALUES ($1, $2, 'hash123', 'Dup Email User', 'user', true, NOW())`,
        [securityUtils.createId("usr_dup_email"), dupEmail]
      );
    }, (err) => {
      assert.strictEqual(err.code, "23505", "PostgreSQL error code must be 23505 (unique_violation)");
      assert.ok(err.constraint?.includes("users_email") || err.message?.includes("users_email") || err.detail?.includes("email"));
      return true;
    });

    // Attempt duplicate firebase_uid insert -> throws 23505
    const sharedUid = `fb_${Date.now()}`;
    await testPool.query(
      `INSERT INTO users (id, firebase_uid, email, password_hash, full_name, role, is_active, created_at)
       VALUES ($1, $2, $3, 'hash123', 'Firebase User 1', 'user', true, NOW())`,
      [securityUtils.createId("usr_fb1"), sharedUid, `fb1_${Date.now()}@example.com`]
    );

    await assert.rejects(async () => {
      await testPool.query(
        `INSERT INTO users (id, firebase_uid, email, password_hash, full_name, role, is_active, created_at)
         VALUES ($1, $2, $3, 'hash123', 'Firebase User 2', 'user', true, NOW())`,
        [securityUtils.createId("usr_fb2"), sharedUid, `fb2_${Date.now()}@example.com`]
      );
    }, (err) => {
      assert.strictEqual(err.code, "23505", "PostgreSQL error code must be 23505 (unique_violation)");
      assert.ok(err.constraint?.includes("firebase_uid") || err.message?.includes("firebase_uid") || err.detail?.includes("firebase_uid"));
      return true;
    });

    // Payment order unique gateway_payment_id constraint
    const orderId1 = securityUtils.createId("ord_dup1");
    const orderId2 = securityUtils.createId("ord_dup2");
    const sharedPaymentId = `pay_shared_${Date.now()}`;

    await testPool.query(
      `INSERT INTO payment_orders (id, gateway, gateway_order_id, gateway_payment_id, user_id, amount_paise, status, created_at)
       VALUES ($1, 'razorpay', 'order_shared_1', $2, $3, 10000, 'paid', NOW())`,
      [orderId1, sharedPaymentId, origUserId]
    );

    await assert.rejects(async () => {
      await testPool.query(
        `INSERT INTO payment_orders (id, gateway, gateway_order_id, gateway_payment_id, user_id, amount_paise, status, created_at)
         VALUES ($1, 'razorpay', 'order_shared_2', $2, $3, 10000, 'paid', NOW())`,
        [orderId2, sharedPaymentId, origUserId]
      );
    }, (err) => {
      assert.strictEqual(err.code, "23505");
      return true;
    });

    // Ledger entry unique idempotency_key constraint
    const wallet = await testPool.query(
      `INSERT INTO wallets (id, owner_type, owner_id, currency, status, created_at)
       VALUES ($1, 'user', $2, 'INR', 'active', NOW()) RETURNING id`,
      [securityUtils.createId("wal_dup"), origUserId]
    );
    const walletId = wallet.rows[0].id;
    const sharedKey = `idemp_${Date.now()}`;

    await testPool.query(
      `INSERT INTO ledger_entries (id, wallet_id, direction, amount_paise, entry_type, idempotency_key, created_at)
       VALUES ($1, $2, 'credit', 5000, 'topup', $3, NOW())`,
      [securityUtils.createId("led1"), walletId, sharedKey]
    );

    await assert.rejects(async () => {
      await testPool.query(
        `INSERT INTO ledger_entries (id, wallet_id, direction, amount_paise, entry_type, idempotency_key, created_at)
         VALUES ($1, $2, 'credit', 5000, 'topup', $3, NOW())`,
        [securityUtils.createId("led2"), walletId, sharedKey]
      );
    }, (err) => {
      assert.strictEqual(err.code, "23505");
      return true;
    });
  });

  await t.test("4. Ownership & Access Control Queries: Tenant isolation in PostgreSQL", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const userA = securityUtils.createId("usr_tenant_a");
    const userB = securityUtils.createId("usr_tenant_b");

    await testPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
       VALUES ($1, $2, 'hash', 'User A', 'user', true, NOW()),
              ($3, $4, 'hash', 'User B', 'user', true, NOW())`,
      [userA, `usera_${Date.now()}@example.com`, userB, `userb_${Date.now()}@example.com`]
    );

    // Insert User A's private mood log and screening using repositories
    const moodA = await repositories.moodLogs.create({
      userId: userA,
      score: 5,
      note: "Private User A Note"
    });

    const screeningA = await repositories.screenings.create({
      userId: userA,
      screeningType: "anxiety",
      status: "completed",
      score: 12,
      responsesJson: { q1: 3, q2: 3 }
    });

    // Query mood logs for User B -> must be empty
    const userBMoods = await repositories.moodLogs.listByUser(userB);
    assert.strictEqual(userBMoods.length, 0, "User B must see 0 mood logs from User A");

    // Query mood logs for User A -> returns exactly User A's mood log
    const userAMoods = await repositories.moodLogs.listByUser(userA);
    assert.strictEqual(userAMoods.length, 1);
    assert.strictEqual(userAMoods[0].id, moodA.id);

    // Query screenings for User B -> must be empty
    const userBScreenings = await repositories.screenings.listForUser(userB);
    assert.strictEqual(userBScreenings.length, 0, "User B must see 0 screenings from User A");

    // Query screenings for User A -> returns exactly User A's screening
    const userAScreenings = await repositories.screenings.listForUser(userA);
    assert.strictEqual(userAScreenings.length, 1);
    assert.strictEqual(userAScreenings[0].id, screeningA.id);

    // Counsellor status isolation
    const approvedCounsellorId = securityUtils.createId("cns_appr");
    const pendingCounsellorId = securityUtils.createId("cns_pend");

    await testPool.query(
      `INSERT INTO counsellors (id, user_id, display_name, verification_status, status, created_at)
       VALUES ($1, $2, 'Approved Dr. Smith', 'approved', 'online', NOW()),
              ($3, $4, 'Pending Dr. Jones', 'pending', 'offline', NOW())`,
      [approvedCounsellorId, userA, pendingCounsellorId, userB]
    );

    const approvedList = await repositories.counsellors.listApproved();
    const approvedIds = approvedList.map(c => c.id);
    assert.ok(approvedIds.includes(approvedCounsellorId), "Approved counsellor must be listed");
    assert.ok(!approvedIds.includes(pendingCounsellorId), "Pending counsellor must NOT be listed");
  });

  await t.test("5. Restart Persistence: Data survives complete pool termination and reconnection", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const testUserId = securityUtils.createId("usr_persist");
    const testEmail = `persist_${Date.now()}@example.com`;

    await testPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
       VALUES ($1, $2, 'hash', 'Persistent User', 'user', true, NOW())`,
      [testUserId, testEmail]
    );

    const counsellorId = securityUtils.createId("cns_persist");
    await testPool.query(
      `INSERT INTO counsellors (id, user_id, display_name, verification_status, status, created_at)
       VALUES ($1, $2, 'Persistent Counsellor', 'approved', 'online', NOW())`,
      [counsellorId, testUserId]
    );

    const slotId = securityUtils.createId("slot_persist");
    await testPool.query(
      `INSERT INTO availability_slots (id, counsellor_id, slot_date, start_time, end_time, session_type, is_booked)
       VALUES ($1, $2, '2026-10-15', '10:00', '11:00', 'video', false)`,
      [slotId, counsellorId]
    );

    // Simulate complete process termination by ending the active pool
    await testPool.end();

    // Reconnect with a fresh pool instance
    const newPool = new pg.Pool({ connectionString: disposableDbUrl });
    testPool = newPool; // update handle for subsequent tests and cleanup

    const userRes = await newPool.query("SELECT * FROM users WHERE id = $1", [testUserId]);
    assert.strictEqual(userRes.rows.length, 1, "User record must survive pool restart");
    assert.strictEqual(userRes.rows[0].email, testEmail);

    const slotRes = await newPool.query("SELECT id, slot_date::text AS slot_date FROM availability_slots WHERE id = $1", [slotId]);
    assert.strictEqual(slotRes.rows.length, 1, "Slot record must survive pool restart");
    assert.strictEqual(slotRes.rows[0].slot_date, "2026-10-15");
  });

  await t.test("6. Financial Concurrency: PostgreSQL transactional locks prevent double crediting under race condition", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    const concUserId = securityUtils.createId("usr_conc");
    const concEmail = `conc_${Date.now()}@example.com`;

    await testPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
       VALUES ($1, $2, 'hash', 'Concurrency User', 'user', true, NOW())`,
      [concUserId, concEmail]
    );

    const user = { id: concUserId };

    function signOrder(gatewayOrderId, paymentId) {
      return crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${gatewayOrderId}|${paymentId}`)
        .digest("hex");
    }

    function signWebhook(rawPayload) {
      return crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest("hex");
    }

    // Initiate top-up for ₹250 (25000 paise)
    const initRes = await walletController.initiateTopup({ body: { amountInr: 250 }, user });
    assert.strictEqual(initRes.status, 201);
    const order = initRes.body.data;
    assert.ok(order?.id);

    const paymentId = `pay_race_${Date.now()}`;
    const signature = signOrder(order.gatewayOrderId, paymentId);

    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: order.gatewayOrderId,
            amount: 25000,
            currency: "INR",
            status: "captured"
          }
        }
      }
    };
    const rawBody = JSON.stringify(webhookPayload);
    const webhookSig = signWebhook(rawBody);

    // Fire 10 simultaneous verification and webhook requests concurrently
    const parallelCalls = [
      walletController.verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
      walletController.paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
      walletController.verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
      walletController.paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
      walletController.verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
      walletController.paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
      walletController.verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
      walletController.paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } }),
      walletController.verifyTopup({ user, body: { orderId: order.id, razorpay_order_id: order.gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } }),
      walletController.paymentWebhook({ body: webhookPayload, req: { rawBody, headers: { "x-razorpay-signature": webhookSig } } })
    ];

    const results = await Promise.all(parallelCalls);
    for (const res of results) {
      assert.strictEqual(res.status, 200, "All parallel requests must resolve with 200 OK without unhandled crashes");
    }

    // Assert exactly ONE ledger entry was created in PostgreSQL
    const ledgerCheck = await testPool.query(
      "SELECT * FROM ledger_entries WHERE reference_id = $1",
      [order.id]
    );
    assert.strictEqual(ledgerCheck.rows.length, 1, "Exactly ONE ledger entry must exist in PostgreSQL");
    assert.strictEqual(Number(ledgerCheck.rows[0].amount_paise), 25000);

    // Assert user wallet balance is credited exactly once (25000 paise = ₹250)
    const balance = await walletService.getBalance(concUserId);
    assert.strictEqual(balance, 25000, "User wallet balance must be exactly 25000 paise (no double credit)");

    // Replay webhooks 3 additional times (idempotency check)
    for (let r = 1; r <= 3; r++) {
      const replayRes = await walletController.paymentWebhook({
        body: webhookPayload,
        req: { rawBody, headers: { "x-razorpay-signature": webhookSig } }
      });
      assert.strictEqual(replayRes.status, 200);
    }

    const finalBalance = await walletService.getBalance(concUserId);
    assert.strictEqual(finalBalance, 25000, "Balance must remain exactly 25000 paise after repeated webhook deliveries");

    const finalLedgerCount = await testPool.query(
      "SELECT COUNT(*) FROM ledger_entries WHERE reference_id = $1",
      [order.id]
    );
    assert.strictEqual(Number(finalLedgerCount.rows[0].count), 1, "Ledger row count must strictly remain 1");
  });

  await t.test("7. Memory Fixtures vs PostgreSQL Parity: Identical repository contract and entity mapping", async (st) => {
    if (!canConnect) { st.skip("PostgreSQL socket not accessible in this environment"); return; }
    // Check that every namespace on memory repository exists on postgres repository
    const memNamespaces = Object.keys(memoryRepositories);
    const pgNamespaces = Object.keys(repositories);

    for (const ns of memNamespaces) {
      assert.ok(pgNamespaces.includes(ns), `PostgreSQL repositories must implement namespace: ${ns}`);
      const memMethods = Object.keys(memoryRepositories[ns]);
      for (const method of memMethods) {
        if (typeof memoryRepositories[ns][method] === "function") {
          assert.strictEqual(
            typeof repositories[ns][method],
            "function",
            `PostgreSQL repository '${ns}' must implement method: ${method}`
          );
        }
      }
    }
  });
});

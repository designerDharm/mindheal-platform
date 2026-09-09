# MindHeal Production Bug Tracker & Remediation Matrix

> **Lifecycle Statuses:** `Open` → `Reproduced` → `Source fixed` → `Staging verified` → `Production verified`  
> **Strict Verification Rule:** No issue is marked fixed merely because its code was edited. Every status advance requires an isolated reproducer test script, execution logs, and automated regression verification.

---

## Controlled Starting Point & Environment Baseline

| Parameter | Recorded Value / State |
| :--- | :--- |
| **Baseline Audit Commit** | `6f15104` (9 September 2026 Audit Retest) |
| **Current Working Commit** | `a4b5df4` |
| **Dedicated Bug-Fix Branch** | `fix/audit-remediation-sep-2026` |
| **Baseline Backup Tag** | `backup-9-sep-4-00-pm` (`f1515db`) |
| **Codebase Tarball Backup** | `MindHeal-backup-9-sep-4.00-PM.tar.gz` (SHA256 verified) |
| **Database Dump Backup** | `MindHeal-db-backup-9-sep-4.00-PM.sql.gz` (393 KB uncompressed, 112 tables verified) |
| **Database Restore Verification** | Verified restoration into `mindheal_restore_test` database (112 tables intact) |
| **Database Migration Version** | `011_promotional_notifications.sql` (all 11 migrations applied in `schema_migrations`) |
| **Backend Environment** | `http://localhost:4000` (Node.js API, PID task `task-4814`, PostgreSQL driver) |
| **Frontend Environment** | `http://localhost:4173` (Vite Preview/Dev server, PID task `task-4842`) |
| **Synthetic Staging Accounts** | `user@example.com` (user), `priya.counsellor@example.com` (counsellor), `admin@example.com` (admin) — Password: `Password123!` |
| **Test Payment Verification** | Live PostgreSQL top-up tested (`ord_d56c574c...` settled to `status: paid`, ledger credited) |
| **Rollback Command** | `git checkout backup-9-sep-4-00-pm && zcat MindHeal-db-backup-9-sep-4.00-PM.sql.gz | psql -h /tmp -d mindheal` |

---

## Bug Tracking Matrix

### Phase 0: Startup & Infrastructure Prerequisites (MH-01 & MH-02)

#### MH-01: Duplicate import in `ai.controller.js` prevents route graph load
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/ai.controller.js`
- **Reproduction Steps:**
  1. Run `node --check backend/src/controllers/ai.controller.js`.
  2. Attempt to load backend router via `import('./backend/src/routes/index.js')`.
- **Expected Result:** Module compiles cleanly; no duplicate identifier declarations.
- **Actual Result (Before Fix):** Crash with `SyntaxError: Identifier 'repositories' has already been declared`.
- **Fix Commit:** `6f15104` (confirmed maintained in `fix/audit-remediation-sep-2026`)
- **Verification Evidence:**
  - `npm run check` in `backend` passed across all `.js` and `.mjs` files without error.
  - `node --check backend/src/controllers/ai.controller.js` and `backend/src/routes/index.js` exit with code 0.
  - Live application starts cleanly against PostgreSQL.

#### MH-02: PostgreSQL repository contract compliance & namespace exposure
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/repositories/postgres/repositories.js`, `backend/src/repositories/index.js`
- **Reproduction Steps:**
  1. Set `REPOSITORY_DRIVER=postgres`.
  2. Load repository root: `node --input-type=module -e 'await import("./backend/src/repositories/index.js")'`.
  3. Run repository contract comparison test suite.
- **Expected Result:** PostgreSQL repository exposes every namespace, entity repository, and interface method present in memory repository.
- **Actual Result (Before Fix):** Missing namespaces and methods, crashing on startup when `REPOSITORY_DRIVER=postgres`.
- **Fix Commit:** `6f15104` (confirmed maintained in `fix/audit-remediation-sep-2026`)
- **Verification Evidence:**
  - Executed `NODE_ENV=test node --test backend/tests/repository-contract.test.js`: Passed (2/2 tests pass).
  - Executed end-to-end disposable PostgreSQL lifecycle test (`mindheal_disposable_test`):
    - Applied all 11 database migrations cleanly (`001_init.sql` to `011_promotional_notifications.sql`).
    - Successfully booted backend on port 4009 with `REPOSITORY_DRIVER=postgres`.
    - Created user and initiated payment order.
    - Stopped backend, restarted backend against the same database.
    - Verified user login, profile fetch, and database record survival across complete restart.

---

### Phase 1: Critical Privilege Escalation & Auth Bypass (P0)

#### MH-03: Public signup creates administrator role
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js`, `backend/tests/onboarding.test.js`
- **Reproduction Steps:**
  1. Send `POST /api/v1/auth/register` or `POST /api/v1/auth/counsellor/register` with `{ role: "admin" }` or protected attributes (`status: "approved"`, `isActive: true`, `isGuardianConsentVerified: true`).
  2. Send Google onboarding profile completion payload with `{ role: "admin" }` or forged onboarding token.
  3. Submit direct counsellor application with `{ status: "approved" }`.
- **Expected Result:**
  - Non-permitted role overrides and privilege injections are rejected with HTTP 400.
  - Server assigns roles exclusively on server (`"user"` for user signup, `"counsellor"` for counsellor signup).
  - Firebase onboarding strictly creates `"user"` or `"counsellor"`, never `"admin"`.
  - Counsellor application status is strictly forced to `"pending"`.
  - Valid user and counsellor registrations work cleanly (HTTP 201).
- **Actual Result (Before Fix):**
  - Controllers accepted client-provided `role` and spread unprotected body fields, allowing creation of administrator accounts and pre-approved counsellor applications.
- **Fix Commits:** `f1515db`, `6911690`
- **Verification Evidence:**
  - Isolated multi-scenario reproducer script passed all 5 edge-case checks with HTTP 400 rejection for tampering.
  - Added regression test 16 in `backend/tests/onboarding.test.js`: all 17 integration tests passing.
  - Full auth test suite (32/32 tests) passing cleanly.

#### MH-35: Mock Firebase identities accepted in production memory mode
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/config/firebase.js`, `backend/src/config/app.js`
- **Reproduction Steps:**
  1. Start fresh production process (`NODE_ENV=production`) under both `REPOSITORY_DRIVER=memory` and `REPOSITORY_DRIVER=postgres`.
  2. Send Bearer/idToken `mock-token-...` to auth/login endpoint.
- **Expected Result:** Server strictly rejects mock tokens in production with both repository drivers (HTTP 400/401).
- **Actual Result (Before Fix):** Mock token handler was enabled whenever `REPOSITORY_DRIVER === "memory"`, even under `NODE_ENV === "production"`.
- **Fix Commit:** `47d9d11`
- **Verification Evidence:**
  - Tested fresh production process with `REPOSITORY_DRIVER=memory`: mock token rejected with HTTP 400 (`Invalid Firebase Token`).
  - Tested fresh production process with `REPOSITORY_DRIVER=postgres`: mock token rejected with HTTP 400 (`Invalid Firebase Token`).
  - Startup fatal guard test: Verified server throws `SECURITY_FATAL` if `FIREBASE_AUTH_MOCK_ENABLED=true` in production.
  - Test suite compatibility: Mock tokens verify cleanly in `NODE_ENV=test`.
  - Audit check `N10` verified.

---

### Phase 2: Financial & Payment Boundary Hardening (P0)

#### MH-04: Wallet top-up verification lacks gateway order binding & replay protection
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/wallet.controller.js`, `backend/src/services/wallet.service.js`, `backend/src/repositories/postgres/repositories.js`, `backend/src/repositories/memory/index.js`, `backend/migrations/012_payment_orders_unique_payment_id.sql`, `backend/tests/wallet.controller.test.js`
- **Reproduction Steps:**
  1. Attempt to settle Order A using proof belonging to Order B (different gateway order ID).
  2. Attempt to verify another user's order without ownership.
  3. Attempt to reuse a previously captured `razorpay_payment_id` on a new order.
  4. Attempt verification with invalid/tampered HMAC signature.
  5. Attempt verification when gateway payment state is not `captured` or amount/currency mismatches.
- **Expected Result:**
  - Gateway order mismatch rejected (HTTP 400).
  - Cross-user verification rejected (HTTP 403).
  - Reused payment identifier rejected (HTTP 400) both at application layer and DB unique index.
  - Gateway payment state, order ID, amountPaise, and currency strictly validated.
  - Legitimate payment settles cleanly (HTTP 200) and credits exact balance.
- **Actual Result (Before Fix):**
  - Allowed unverified gateway order IDs, accepted reused payment IDs, did not verify gateway payment status, and permitted cross-user/cross-order credit substitution.
- **Fix Commits:** `e82efc3`, and comprehensive defense-in-depth hardening
- **Verification Evidence:**
  - Deep multi-vector verification script `scratch/reproduce_mh04_deep.mjs`: all 8 security attacks and legitimate payment checks PASSED.
  - PostgreSQL database migration `012_payment_orders_unique_payment_id.sql` applied cleanly.
  - Repository contract test suite: 2/2 passed.
  - Automated regression test suite `backend/tests/wallet.controller.test.js` and `backend/tests/wallet.service.test.js`: 12/12 subtests passing.

#### MH-41: Peer session payment accepts unrelated valid proof & cross-request substitution
- **Priority:** P0 (Critical)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/peer.controller.js`, `backend/src/repositories/postgres/repositories.js`, `backend/src/repositories/memory/index.js`, `backend/migrations/013_peer_session_quotes_payment_order.sql`, `backend/tests/peer-talk.test.js`
- **Reproduction Steps:**
  1. Create accepted peer session requests X and Y with quotes for user A.
  2. Attempt to verify Request X with an unknown external gateway order ID (`order_unknown_fake`).
  3. Attempt to verify Request X using payment order initiated for Request Y (cross-request substitution).
  4. Attempt to verify Request X using payment order belonging to User B.
  5. Attempt to reuse an already captured `razorpay_payment_id`.
  6. Attempt to verify Request X with mismatched payment order amount.
- **Expected Result:**
  - Unknown submitted gateway order fails with HTTP 400 without creating synthetic replacement order.
  - Cross-request proof rejected with HTTP 400 (`Payment order is associated with a different session quote.`).
  - Cross-user order rejected with HTTP 403.
  - Amount mismatch rejected with HTTP 400.
  - Reused payment identifier rejected with HTTP 400.
  - Gateway payment captured status, amountPaise, and currency verified.
  - Exact matching payment activates exactly one session (HTTP 200).
- **Actual Result (Before Fix):**
  - Created synthetic replacement orders for arbitrary submitted gateway order IDs, accepted cross-request proofs between different session requests, and lacked quote immutability and gateway state checks.
- **Fix Commits:** `a4b5df4`, and comprehensive quote-binding hardening
- **Verification Evidence:**
  - Deep multi-vector verification script `scratch/reproduce_mh41_deep.mjs`: all 8 security checks and legitimate session activations PASSED.
  - Database migration `013_peer_session_quotes_payment_order.sql` applied cleanly to live PostgreSQL.
  - Repository contract test suite: 2/2 passed.
  - Automated integration test suite `backend/tests/peer-talk.test.js`: 11/11 tests passing.

---

### Phase 3: Access Control, Sockets & Data Isolation (P1)

#### MH-06: Private file and report operations lack ownership checks
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/upload.controller.js`, `backend/src/controllers/ai.controller.js`, `backend/src/routes/index.js`, `backend/tests/ownership_access_control.test.js`
- **Reproduction Steps:** Synthetic Account B attempts to generate signed download URL, delete file, read report, or unlock report (including already-unlocked reports) belonging to Synthetic Account A.
- **Expected Result:** HTTP 403 Forbidden on all non-owner access attempts.
- **Actual Result (Before Fix):** Server generated signed URLs, deleted storage paths, and returned unlocked reports without verifying stored owner identity.
- **Fix Commit:** `0c802c2` (`fix(security): enforce stored owner authorization for files and reports (MH-06)`)
- **Verification Evidence:**
  - Updated `uploadFile` to partition user file uploads into `uploads/${currentUser.id}/`.
  - Implemented `authorizeStoragePathAccess` in `upload.controller.js` to authorize that the caller is the stored owner (or admin) before executing `refreshUploadUrl` (signing) or `deleteUpload` (deleting).
  - Enforced stored owner check (`report.userId === user.id || user.role === 'admin'`) in `unlockReport` *before* inspecting `isPdfUnlocked` or modifying credits, protecting both locked and already-unlocked reports.
  - Implemented dedicated `getReport` endpoint with stored owner authorization and registered `GET /api/v1/analysis/reports/:id`.
  - Automated integration test suite `backend/tests/ownership_access_control.test.js` verified 5/5 tests passing: cross-account signed URL generation denied (403), cross-account file deletion denied (403), cross-account report reading and unlocking denied (403) even when report ID is known or already unlocked, and owner/admin access preserved (200).
  - Regression testing: `backend/tests/upload.controller.test.js` (10/10 passed), full frontend test suite (39/39 passed), syntax checks on both frontend and backend (0 errors).

#### MH-07: Socket rooms do not verify session membership
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/socket.js`
- **Reproduction Steps:** Client socket connects with User C credentials and emits `join_session` for session between User A and User B.
- **Expected Result:** Socket is denied entry, cannot receive history, and cannot send or receive session messages.
- **Actual Result (Before Fix):** Socket joined room and received messages without verifying session participant list.
- **Fix Commit:** `d74c617` (`fix(security): enforce socket session membership, state, and account restrictions (MH-07)`)
- **Verification Evidence:**
  - Implemented `authorizeSessionParticipant` in `backend/src/socket.js` to strictly authorize requester, listener (via `listenerProfileId` or `userId`), counselling client/counsellor, or admin.
  - Enforced account status checks (disabled/suspended accounts rejected and disconnected) and minor age checks (age 15-17 requiring approved guardian consent).
  - Enforced session state verification: cancelled sessions reject room join and message sending (`SESSION_CANCELLED`); ended, completed, or expired sessions disallow sending new messages (`SESSION_INACTIVE`) and prevent active room joining.
  - Blocked unauthorized sockets from room join (`socket.join`), chat history emission (`peer_chat_history`), and message broadcasting (`send_message`).
  - Created end-to-end integration test suite `backend/tests/socket_membership.test.js` verifying 11/11 tests passing across real Socket.IO client connections:
    - User C cannot join User A & B's session (FORBIDDEN, `session_error` emitted, no room join).
    - User C does not receive chat history.
    - User C cannot send messages to User A & B's session (FORBIDDEN, rejected before save/broadcast).
    - User A and User B can join and exchange real-time messages, while User C cannot listen or eavesdrop.
    - Sending messages to ended or cancelled sessions is rejected (`SESSION_INACTIVE`).
    - Counselling sessions enforce client and counsellor membership.
    - Account deactivation immediately disconnects active socket connections.
  - Full suite verification: 164/164 backend tests passing, 39/39 frontend tests passing.

#### MH-21: Mood logging accepts client-supplied owner
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/user.controller.js`, `backend/src/routes/index.js`
- **Reproduction Steps:** Send `POST /api/v1/user/mood-logs` with body containing `userId: "other_user"`.
- **Expected Result:** Log is created strictly for the authenticated `req.user.id`. Client-supplied ownership fields are ignored or rejected.
- **Actual Result (Before Fix):** Server accepted client-provided `userId` due to trailing object spread (`...body`).
- **Fix Commit:** `ef5f391` (`fix(security): enforce authenticated ownership for mood logs (MH-21)`)
- **Verification Evidence:**
  - Sanitized `logMood` in `backend/src/controllers/user.controller.js` to strip client-supplied ownership or identifier fields (`userId`, `user_id`, `ownerId`, `owner_id`, `id`, `createdAt`) and enforce ownership from authenticated `user.id`.
  - Updated `getMoodHistory` in `backend/src/controllers/user.controller.js` to scope retrieval strictly to authenticated `user.id` unless the requesting role is administrator.
  - Registered route aliases `POST /api/v1/user/mood-logs` and `GET /api/v1/user/mood-logs` in `backend/src/routes/index.js` alongside `/user/mood/log` and `/user/mood/history`.
  - Created automated test suite `backend/tests/mood_ownership.test.js` (4/4 tests passing):
    - `✔ 1. logMood ignores client-supplied userId and sets authenticated owner`
    - `✔ 2. End-to-end dispatch: POST /api/v1/user/mood/log and /api/v1/user/mood-logs`
    - `✔ 3. getMoodHistory scopes history to requesting user unless admin`
  - Full suite verification: 168/168 backend tests passing, 39/39 frontend tests passing.

#### MH-40: Peer request details lack participant authorization
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/peer.controller.js`, `backend/src/routes/index.js`, `backend/tests/peer_request_authorization.test.js`
- **Reproduction Steps:** User C calls `GET /api/v1/peer-session-requests/:id` for a request between User A and User B.
- **Expected Result:** HTTP 403 Forbidden.
- **Actual Result (Before Fix):** Details returned to any authenticated user.
- **Fix Commit:** Staged
- **Verification Evidence:**
  - Implemented participant authorization helper `authorizePeerRequestParticipant(request, user)` in `peer.controller.js`, allowing access strictly to requester (`request.requesterUserId`), matched listener profile (`request.listenerProfileId`), or platform administrator (`user.role === "admin"`).
  - Implemented quote participant authorization helper `authorizePeerQuoteParticipant(quote, user)` and protected quote endpoints `GET /api/v1/peer-session-requests/:id/quote` and `GET /api/v1/peer-session-quotes/:id`.
  - Updated `createSessionRequest` to explicitly persist `requesterUserId: user.id` and `listenerProfileId: listener.id` with quote records.
  - Automated test suite `backend/tests/peer_request_authorization.test.js` (9/9 tests passing):
    - `✔ 1. Unit: authorizePeerRequestParticipant & authorizePeerQuoteParticipant authorization logic`
    - `✔ 2. End-to-end: GET /api/v1/peer-session-requests/:id permits requester User A`
    - `✔ 3. End-to-end: GET /api/v1/peer-session-requests/:id permits listener User B`
    - `✔ 4. End-to-end: GET /api/v1/peer-session-requests/:id permits platform Administrator`
    - `✔ 5. End-to-end: GET /api/v1/peer-session-requests/:id REJECTS unrelated User C with 403`
    - `✔ 6. End-to-end: GET /api/v1/peer-session-requests/:id REJECTS unrelated Counsellor D with 403`
    - `✔ 7. End-to-end: GET /api/v1/peer-session-requests/:id returns 404 for non-existent ID`
    - `✔ 8. Direct quote endpoints: /peer-session-requests/:id/quote and /peer-session-quotes/:id`
  - Peer Talk regression suite `backend/tests/peer-talk.test.js`: 11/11 tests passing.
  - Frontend test suite: 39/39 tests passing.

---

### Phase 4: Identity, Age, Guardian & Account Governance (P1)

#### MH-09: Signup drops DOB; adult gate allows unknown age
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `src/services/mock-api.js`, `src/main.js`, `backend/src/app.js`, `backend/src/utils/validation.js`, `backend/src/services/auth.service.js`, `backend/src/controllers/ai.controller.js`, `backend/src/controllers/peer.controller.js`, `backend/tests/dob_adult_restrictions.test.js`
- **Reproduction Steps:**
  1. Signup with DOB dropped by frontend service (`mock-api.js`).
  2. Legacy `calculateAge` in `app.js` returns 20 when DOB is missing/null/empty.
  3. User with missing DOB accesses adult generative AI endpoints (`/api/v1/ai/chat`, `/api/v1/analysis/*`) and succeeds.
  4. User with future DOB (e.g. 2040-01-01) treats negative timestamp diff as adult.
  5. User aged 17 years 364 days or minor attempts adult AI features.
- **Expected Result:**
  - DOB is forwarded consistently in registration payloads.
  - DOB is strictly validated and normalized into `YYYY-MM-DD` (calendar validity and rejecting future dates).
  - Insecure adult fallback (`return 20`) removed from `app.js`.
  - Missing, invalid, or future DOB cannot unlock adult-only features. Boundary ages (18th birthday today vs tomorrow) behave with exact precision.
  - Minors aged 15–17 require verified guardian email. Users under 15 and counsellors under 21 are rejected.
- **Fix Commit:** `cc271ad`
- **Verification Evidence:**
  - Unit and route integration test suite `backend/tests/dob_adult_restrictions.test.js`: 5/5 tests passing:
    1. `calculateAgeFromDob` and `calculateExactAge` edge cases (null, empty, invalid format, non-existent calendar date, future dates all return `null`; exact 18 today returns 18, 17y 364d returns 17, 18y 1d returns 18, exact 21 returns 21, turning 21 tomorrow returns 20, exact 15 returns 15, turning 15 tomorrow returns 14).
    2. `createUser` validates and normalizes `dateOfBirth` into `YYYY-MM-DD` (future DOB rejected, invalid date rejected, user under 15 rejected, minor 15-17 without guardian rejected, counsellor under 21 rejected, valid adult 18+ normalized).
    3. Adult generative AI and peer features block missing, invalid, or minor DOB.
    4. `app.js` route-level `requireAdult` middleware strictly enforces verified adult age of 18+ on `/api/v1/ai/chat` (null DOB blocked with 403, future DOB blocked with 403, 17y 364d minor blocked with 403, exactly 18 allowed with 200, 18y 1d allowed with 200).
  - Full onboarding and auth test suites (`tests/onboarding.test.js`, `tests/auth.service.test.js`, `tests/auth.controller.test.js`: 38/38 subtests) passing cleanly.

#### MH-10: Email/mobile verification is optional on backend
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js`, `backend/tests/auth.controller.test.js`, `backend/tests/auth.service.test.js`
- **Reproduction Steps:**
  1. Submit registration without `verificationProof`.
  2. Submit registration with expired or non-existent proof.
  3. Submit registration with destination-mismatched proof (proof for destination A used for destination B).
  4. Submit registration with previously consumed proof.
  5. Fire concurrent registration requests with identical proof.
- **Expected Result:**
  - Mandatory `verificationProof` enforced on public user and counsellor registrations (HTTP 400 if missing).
  - Proof bound strictly to verified destination (`destClean`) with expiration check.
  - Single-use atomic consumption prevents reuse and race conditions.
  - Valid proof succeeds exactly once (HTTP 201).
- **Actual Result (Before Fix):**
  - Verification proof was optional on backend (`if (body.verificationProof)`); accounts could be created without contact channel verification, and proofs lacked atomic single-use guarantees.
- **Fix Commit:** `fix(auth): require completed email/mobile verification proof during registration (MH-10)`
- **Verification Evidence:**
  - Automated deep verification suite `scratch/reproduce_mh10_deep.mjs`: all 8 checks passed:
    1. Missing proof in user registration rejected (HTTP 400).
    2. Missing proof in counsellor registration rejected (HTTP 400).
    3. Destination mismatch rejected (HTTP 400).
    4. Valid proof creates user account (HTTP 201).
    5. Reused proof rejected (HTTP 400).
    6. Expired / invalid proof rejected (HTTP 400).
    7. Counsellor mobile proof verified and single-use enforced.
    8. Concurrent race with identical proof: exactly 1 succeeds (HTTP 201), concurrent attempts fail (HTTP 400).
  - Automated unit and integration suites:
    - `backend/tests/auth.controller.test.js`: 4/4 passed.
    - `backend/tests/auth.service.test.js`: 19/19 passed.
    - `backend/tests/onboarding.test.js`: 17/17 passed.

#### MH-11: Administrator second factor (TOTP) is not enforced
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `src/main.js`, `src/services/mock-api.js`, `backend/src/utils/security.js`, `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js`, `backend/src/repositories/postgres/repositories.js`, `backend/src/repositories/memory/index.js`, `backend/src/data/store.js`, `backend/migrations/015_admin_totp_default_secrets.sql`, `backend/scripts/smoke-test.mjs`, `backend/tests/auth.controller.test.js`, `backend/tests/auth.service.test.js`
- **Reproduction Steps:**
  1. Attempt admin login with correct password but missing TOTP (`totp: undefined`).
  2. Attempt admin login with whitespace-only TOTP (`totp: "   "`).
  3. Attempt admin login with incorrect TOTP code (`totp: "000000"`).
  4. Attempt admin login with wrong password regardless of TOTP code.
  5. Attempt admin login with correct password and valid RFC 6238 6-digit TOTP code.
  6. Attempt standard user login without TOTP.
- **Expected Result:**
  - Missing or empty TOTP rejected with HTTP 401 (`TOTP_REQUIRED`: "Two-factor authentication code is required for administrator login.").
  - Incorrect TOTP rejected with HTTP 401 (`INVALID_TOTP`: "Invalid two-factor authentication code.").
  - Incorrect password rejected with HTTP 401.
  - Valid password + RFC 6238 TOTP succeeds with HTTP 200 and issues session tokens.
  - Non-admin users log in without TOTP requirement.
- **Actual Result (Before Fix):**
  - Frontend stripped or omitted TOTP payload; backend issued administrator session tokens solely on password verification without requiring or validating 2FA.
- **Fix Commit:** `a00ca26`
- **Verification Evidence:**
  - RFC 6238 standard TOTP implementation in `backend/src/utils/security.js` with SHA-1 HMAC, 30s step, dynamic truncation, and constant-time comparison.
  - Frontend `src/services/mock-api.js` and `src/main.js` preserve and forward `totp` in login payload.
  - PostgreSQL migration `015_admin_totp_default_secrets.sql` executed cleanly; `totp_secret` and `is_totp_enabled` mapped in PostgreSQL and memory repositories.
  - Dedicated multi-vector reproducer `scratch/reproduce_mh11_deep.mjs`: all 6 security and authentication test cases PASSED on live PostgreSQL.
  - Test suites: `backend/tests/auth.controller.test.js` (4/4 passed), `backend/tests/auth.service.test.js` (15/15 passed).
  - End-to-end backend smoke tests against live PostgreSQL (`backend/scripts/smoke-test.mjs`): 100% PASSED.


#### MH-12: Disabled accounts retain login and request access
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/services/auth.service.js`, `backend/src/controllers/auth.controller.js`, `backend/src/app.js`, `backend/src/socket.js`, `backend/src/controllers/admin.controller.js`, `backend/src/routes/index.js`, `backend/package.json`
- **Reproduction Steps:**
  1. Create a user with `isActive: false` or update existing user to disabled.
  2. Attempt password login (`POST /api/v1/auth/login`).
  3. Attempt authenticated API request (`GET /api/v1/user/me`) using existing valid access token.
  4. Attempt token refresh (`POST /api/v1/auth/refresh`) using existing refresh token.
  5. Attempt new Socket.IO connection handshake with disabled account token.
  6. Disable active user while connected to Socket.IO via `PUT /api/v1/admin/users/:id/status`.
  7. Attempt Google Sign-In with disabled account.
- **Expected Result:**
  - Password login fails with HTTP 403 (`User account is disabled.`).
  - Authenticated API request fails with HTTP 403 (`User account is disabled.`).
  - Token refresh fails with HTTP 403 (`User account is disabled.`).
  - New Socket.IO connection fails with `Account disabled`.
  - Active Socket.IO session receives `account_disabled` event and is immediately disconnected.
  - Google Sign-In returns `ACCOUNT_RESTRICTED`.
- **Actual Result (Before Fix):**
  - Disabled users could log in with password, use existing access tokens for any authenticated endpoint, and connect to Socket.IO without restriction.
- **Fix Commit:** `fe3af92`
- **Verification Evidence:**
  - Comprehensive multi-vector test suite `scratch/reproduce_mh12_deep.mjs`: all 6 checks PASSED on live PostgreSQL with active Socket.IO disconnection.
  - Test suites: `backend/tests/auth.controller.test.js`, `backend/tests/auth.service.test.js`, `backend/tests/onboarding.test.js`, `backend/tests/repository-contract.test.js` (40/40 passed).

#### MH-42: Password-created minor marked onboarding complete before consent
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/services/auth.service.js`, `backend/src/controllers/auth.controller.js`, `backend/src/controllers/user.controller.js`, `backend/src/app.js`, `backend/src/socket.js`, `backend/src/utils/http.js`, `src/main.js`, `src/services/mock-api.js`, `backend/tests/guardian_minor_onboarding.test.js`
- **Reproduction Steps:** Register 16-year-old user with password.
- **Expected Result:** `onboardingStatus` is `PENDING_GUARDIAN`; adult/general routes blocked until guardian consents. Identical restrictions applied across password and Google flows.
- **Actual Result (Before Fix):** User marked `onboardingStatus: COMPLETED` due to default parameter overriding minor derivation, and password login issued active sessions without guardian consent.
- **Remediation:**
  - In `backend/src/services/auth.service.js`: `createUser` strictly derives `onboardingStatus` as `"PENDING_GUARDIAN"` and `isGuardianConsentVerified` as `false` for minors (15-17) regardless of client parameters.
  - In `backend/src/services/auth.service.js`: `loginUser` and `createSession` fail closed for unverified minors, returning `{ status: "GUARDIAN_CONSENT_REQUIRED", email }` and preventing session token issuance across password, Google, and token refresh (`refreshSession`) flows.
  - In `backend/src/controllers/auth.controller.js` & `backend/src/controllers/user.controller.js`: Explicitly blocked privilege tampering (`onboardingStatus`, `guardianConsentStatus`, `isGuardianConsentVerified`) across public registration, counsellor registration, profile completion, and `/user/me`.
  - In `backend/src/app.js` & `backend/src/socket.js`: Enforced HTTP 403 `code: "GUARDIAN_CONSENT_REQUIRED"` and Socket.IO connection rejection for pending minors on all protected service routes.
  - In `src/main.js` & `src/services/mock-api.js`: Aligned frontend to intercept `GUARDIAN_CONSENT_REQUIRED` across password sign-up, password login, social fallback, and dream analysis modals, redirecting the user to `/auth/guardian-pending`.
- **Verification Evidence:**
  - Automated test suite `backend/tests/guardian_minor_onboarding.test.js` (8/8 PASSED): verified minor registration, tampering prevention, password/Google login restriction, token refresh rejection, HTTP 403 route gating, `/user/me` rejection, and successful unlocking upon guardian approval.
  - Regression suites passed: `dob_adult_restrictions.test.js`, `onboarding.test.js`, `auth.service.test.js`, `auth.controller.test.js` (51/51 PASSED).
  - Client checks passed: `npm run check` (0 errors), root `npm test` (12/12 PASSED).

#### MH-13: Social sign-in fabricated account fallback
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `src/main.js`, `tests/social-auth.test.js`
- **Reproduction Steps:** Click unconfigured social login provider in UI.
- **Expected Result:** Clear error notification that provider is unavailable. An unavailable Google/Facebook flow never falls back to ordinary signup with invented details.
- **Actual Result (Before Fix):** Frontend fabricated `provider_user_*@example.com` with generated phone numbers and `OAuth-*` passwords, auto-calling `api.signUp` and logging in.
- **Remediation:**
  - Removed all invented credential generators (`randomId`, `provider_user_*@example.com`, random mobile numbers, `OAuth-${provider}-${randomId}!`) in `src/main.js`.
  - Preserved genuine configured Google OAuth popup flow (`firebase.auth().signInWithPopup(googleProvider)`) and backend verification (`api.loginWithFirebase`).
  - Added fail-closed checks when Google/Firebase is not initialized or unavailable: displays clear error message `"Google authentication service is currently unavailable. Please sign in with your email or mobile."`, toasts error, and sets `state.authError`.
  - Added clean error handling for any unconfigured provider (Facebook, Apple): displays `"${provider} authentication service is currently unavailable. Please sign in with your email or mobile."` without attempting registration or login.
- **Verification Evidence:**
  - Automated test suite `tests/social-auth.test.js` (3/3 PASSED): verified complete removal of fabricated credential patterns, verified clear error messaging for unavailable Google/Firebase, and verified unconfigured providers never fall back to `api.signUp` or `api.login`.
  - Root test suite: `npm test` (16/16 PASSED).
  - Code check: `npm run check` (0 errors).

---

### Phase 5: Clinical Safety, Helplines & Screening Engine (P1)

#### MH-16: Positive PHQ-9 Item 9 lacks tailored safety guidance
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Complete PHQ-9 with Q1–Q8 = 0, Q9 (self-harm thoughts) = 1 (Total score = 1, "Minimal").
- **Expected Result:** Immediate, prominent crisis banner and helpline drawer rendered due to positive Item 9.
- **Actual Result (Before Fix):** Shows low-risk summary without crisis resources.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-17: Crisis call label and dial target disagree
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Click AASRA crisis call button.
- **Expected Result:** Dial target matches displayed number (`tel:9820466726`).
- **Actual Result (Before Fix):** Displayed AASRA number but link pointed to `tel:9152987821`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-36: Screening completion trusts arbitrary client scores
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/screening.controller.js`
- **Reproduction Steps:** Submit `POST /api/v1/screenings/:id/complete` with `{ score: -999, answers: [] }`.
- **Expected Result:** HTTP 400 Bad Request; server computes score from answers.
- **Actual Result (Before Fix):** Server accepted client-provided score.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-37: Basic screening requires payment despite free-access rule
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/screening.controller.js`, `src/features/insight-lab.js`
- **Reproduction Steps:** New user with zero balance attempts standard self-assessment screening.
- **Expected Result:** Basic screening completes for free (₹0).
- **Actual Result (Before Fix):** Blocked with payment required error.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-38: Screening failure can debit wallet without creating screening
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/screening.controller.js`
- **Reproduction Steps:** Inject failure during screening creation after debit.
- **Expected Result:** Atomic rollback or refund.
- **Actual Result (Before Fix):** Wallet remained debited with no screening record created.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

---

### Phase 6: Booking, Participant Flows & Payout Settlements (P1)

#### MH-08: Booking trusts client ownership, status, and price
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/session.controller.js`
- **Reproduction Steps:** Submit booking payload with `{ amountInr: 1, status: "completed" }`.
- **Expected Result:** Server looks up provider profile rate and forces `status: "pending"`.
- **Actual Result (Before Fix):** Trusted client price and status.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-15: Counsellor booking buttons do not start a booking
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Click "Request Session" on public counsellor card.
- **Expected Result:** Booking drawer opens with counsellor pre-selected.
- **Actual Result (Before Fix):** No click handler; button was inactive.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-19: Concurrent payment settlement duplicates wallet credits
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/services/wallet.service.js`, `backend/src/controllers/wallet.controller.js`, `backend/src/repositories/postgres/repositories.js`, `backend/src/repositories/memory/index.js`, `backend/migrations/014_ledger_entries_payment_order_unique.sql`, `backend/tests/wallet.service.test.js`, `backend/tests/wallet.controller.test.js`
- **Reproduction Steps:**
  1. Send 10 simultaneous webhook and browser verification requests for the same order concurrently.
  2. Send repeated duplicate webhook events for an already settled order.
- **Expected Result:**
  - Database row-level locking (`findForUpdate`), unique index constraint on `ledger_entries (reference_type, reference_id) WHERE reference_type = 'payment_order'`, and in-flight settlement coordination ensure idempotent settlement.
  - Exactly one wallet credit entry created; user balance incremented exactly once.
  - Concurrent and subsequent requests safely return `{ alreadyPaid: true }`.
- **Actual Result (Before Fix):**
  - Race condition without row locking or database uniqueness constraints allowed concurrent requests and repeated webhooks to duplicate wallet credits.
- **Fix Commit:** `fix(payments): coordinate idempotent payment settlement and unique constraints (MH-19)`
- **Verification Evidence:**
  - Migration `014_ledger_entries_payment_order_unique.sql` created partial unique index on PostgreSQL `mindheal`.
  - PostgreSQL live concurrency test (`scratch/test_mh19_postgres.mjs`): 10 simultaneous requests executed against live PostgreSQL created exactly 1 ledger entry row and incremented balance by exactly 150 INR (15,000 paise).
  - In-memory deep concurrency test (`scratch/reproduce_mh19_deep.mjs`): 10 simultaneous requests created exactly 1 credit entry and repeated webhook deliveries remained strictly idempotent.
  - Automated test suites: `backend/tests/wallet.service.test.js` (5/5 passed), `backend/tests/wallet.controller.test.js` (8/8 passed), `backend/tests/repository-contract.test.js` (2/2 passed).

#### MH-20: Weekly payout worker calls missing repository method
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/services/payout.service.js`, `backend/src/repositories/`
- **Reproduction Steps:** Run weekly payout cron job.
- **Expected Result:** Completes batch payout calculations cleanly.
- **Actual Result (Before Fix):** Crashes with `TypeError: peerListenerProfiles.listAll is not a function`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-39: Listener identity confused with listener profile ID
- **Priority:** P1 (High)
- **Status:** `Staging verified`
- **Affected Files:** `backend/src/controllers/peer.controller.js`, `backend/src/repositories/memory/index.js`, `backend/src/repositories/postgres/repositories.js`, `backend/src/routes/index.js`, `backend/tests/peer_listener_identity.test.js`
- **Reproduction Steps:** Listener calls `grantSessionConsent`, lists peer sessions, generates RTC token, or submits peer feedback.
- **Expected Result:** HTTP 200 OK / 201 Created after resolving listener profile to its owning user.
- **Actual Result (Before Fix):** HTTP 403 Forbidden because `session.listenerProfileId` was compared with `user.id`.
- **Fix Commit:** Staged
- **Verification Evidence:**
  - Implemented unified `authorizePeerSessionParticipant(session, user)` in `peer.controller.js` that accurately resolves `session.listenerProfileId` to the underlying listener user account (`profile.userId`) across all drivers.
  - Refactored `grantSessionConsent`, `getSessionConsents`, `generatePeerRtcToken`, `endPeerSession`, and `submitPeerFeedback` to reuse `authorizePeerSessionParticipant`.
  - Registered `GET /api/v1/peer-sessions` and `GET /api/v1/peer-sessions/:id`.
  - Updated `repositories.peerSessions.listForUser` in `memory/index.js` and `postgres/repositories.js` to resolve `listenerProfileId` via `peerListenerProfiles.findByUserId`.
  - Automated test suite `backend/tests/peer_listener_identity.test.js` (7/7 tests passing):
    - `✔ 1. Unit: authorizePeerSessionParticipant resolves listener profile to owning user`
    - `✔ 2. Session listing resolves listener profile and includes session for User A and User B`
    - `✔ 3. GET /api/v1/peer-sessions/:id permits participants, rejects outsider with 403`
    - `✔ 4. Consent granting and viewing permits both User A and User B, rejects User C`
    - `✔ 5. Mutual consent enforcement for RTC token generation`
    - `✔ 6. Feedback submission permits User A and User B with correct target user IDs, rejects User C`
  - Peer Talk regression suite `backend/tests/peer-talk.test.js`: 11/11 tests passing.
  - Peer Request authorization suite `backend/tests/peer_request_authorization.test.js`: 9/9 tests passing.
  - Frontend test suite: 39/39 tests passing.

---

### Phase 7: UI Journeys, State & Accessibility (P2)

#### MH-14: Wallet top-up submits fake mock payment confirmation
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`
- **Reproduction Steps:** Click wallet top-up in client UI.
- **Expected Result:** Opens authentic Razorpay modal; verifies only on gateway callback.
- **Actual Result (Before Fix):** Automatically dispatched synthetic `pay_mock_*` payload.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-18: Logout leaves sensitive chat and diary caches in plaintext
- **Priority:** P2 (Medium)
- **Status:** `Staging verified`
- **Affected Files:** `src/services/mock-api.js`, `src/main.js`, `src/features/insight-lab.js`, `tests/cache-privacy.test.js`
- **Reproduction Steps:** Log in, generate AI chat and thought diary entries, click Logout. Inspect `localStorage` and `sessionStorage`.
- **Expected Result:** All mental health data, diaries, AI conversations, exposures, worry time logs, and wellness data cleared on logout and partitioned cleanly per user so Account B cannot read Account A's cache.
- **Actual Result (Before Fix):** Plaintext notes, CBT tools, and chat history remained unscoped in browser storage and were not purged during logout, leaving sensitive data accessible to subsequent users on the same device.
- **Fix Commit:** `e5ef15c` (`fix(auth): protect private browser caches on logout and isolate account storage (MH-18)`)
- **Verification Evidence:**
  - Defined `SENSITIVE_STORAGE_KEYS` covering all CBT diaries, exposures, worry time, AI chat, and Insight Lab storage keys.
  - Implemented `clearPrivateUserData(userId)` in `src/services/mock-api.js` to purge both unscoped and user-partitioned keys from `localStorage` and `sessionStorage`.
  - Wired `clearAuthSession()` and `api.logout()` to automatically invoke `clearPrivateUserData()`.
  - Scoped storage keys in `src/main.js` and `src/features/insight-lab.js` using `getAccountScopedStorageKey` and `getLabStorageKey` (`${key}_${userId}`).
  - Implemented `resetAccountState(userId)` and `loadUserPrivateState(userId)` to reset in-memory state on logout and account switching.
  - Wired logout UI triggers (`ob-logout`, `logout`, `/auth/logout`) to `performLogout()`.
  - Automated test suite `tests/cache-privacy.test.js` verified 5/5 tests passing (storage key list, purge routine, cross-account isolation, in-memory state reset on account change, UI event wiring).
  - Clean run of full test suite `npm test` (31/31 passed) and `npm run check` (0 errors).

#### MH-22: `getState()` couples rendering to session deletion
- **Priority:** P2 (Medium)
- **Status:** `Staging verified`
- **Affected Files:** `src/services/mock-api.js`, `src/main.js`, `tests/global-fetch-outage.test.js`
- **Reproduction Steps:** Trigger a transient network drop, timeout, or 503 while browsing; or inspect network tab on public pages.
- **Expected Result:** Session preserved across network drops and 503s; public pages avoid firing admin endpoints; request deadlines prevent hanging calls; recoverable loading/outage banner allows user retry.
- **Actual Result (Before Fix):** Monolithic `getState()` fired 17 endpoints indiscriminately (including all `/admin/*` endpoints on public pages) and deleted auth session tokens on any network error or 5xx response.
- **Fix Commit:** `c864fec` (`fix(api): repair global fetching, add request deadlines, and preserve sessions during outages (MH-22)`)
- **Verification Evidence:**
  - Implemented request deadlines (8,000ms default) via `AbortSignal.timeout` in `request()` and `refreshAuthSession()`.
  - Removed destructive `clearAuthSession()` calls from `getState()` and the catch blocks of `refreshAuthSession()`.
  - Implemented cached user persistence (`saveCachedAuthUser`, `getCachedAuthUser`) to preserve logged-in user state during temporary outages.
  - Refactored `api.getState(options)` to fetch only route- and role-scoped endpoints. Public routes no longer send `/admin/*`, counsellor-private, or user-private requests.
  - Added recoverable outage notification banner and `[data-action="retry-fetch"]` handler in `panelShell` and `attachGlobalHandlers` in `src/main.js`.
  - Automated test suite `tests/global-fetch-outage.test.js` verified 7/7 tests passing (public endpoint isolation, admin panel scoping, 503 outage session preservation, offline/network drop resiliency, genuine 401 expiration handling, request timeout aborts, and UI wiring).
  - Clean run of full test suite `npm test` (39/39 passed) and `npm run check` (0 errors).

#### MH-25: Public provider listings use seeded static content
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`, `src/data/mindheal-data.js`
- **Reproduction Steps:** Add/modify counsellor in admin/database; visit public directory.
- **Expected Result:** Live database counsellors rendered dynamically.
- **Actual Result (Before Fix):** Rendered hardcoded static array from 2024.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-26: Service filter state leaks and hides homepage bento cards
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Select category on `/services`, return to Home (`#/`).
- **Expected Result:** Home bento cards visible.
- **Actual Result (Before Fix):** Cards hidden due to shared global filter state.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-27: Legal-centre links open wrong aliased documents
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Click Cookie Policy, Refund Policy, or Subprocessors.
- **Expected Result:** Respective dedicated policy content displayed.
- **Actual Result (Before Fix):** Aliased to Privacy Policy or Terms with mismatched headings.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-28: Dream auth modal lacks accessible dialog behavior
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Trigger login modal from Dream Analysis; inspect ARIA attributes and test Esc key.
- **Expected Result:** ARIA dialog tags present; Esc key closes modal; focus trapped.
- **Actual Result (Before Fix):** Plain `<div>` without dialog roles or keyboard dismiss.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-29: Focus page shows literal "undefined" under Pomodoro
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Navigate to `#/services/focus`.
- **Expected Result:** Pomodoro timer description displayed.
- **Actual Result (Before Fix):** Shows string `"undefined"`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-30: Analysis reset buttons throw ReferenceError on click
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Complete Dream Analysis and click "Analyze Another Dream".
- **Expected Result:** State resets and input form displays cleanly.
- **Actual Result (Before Fix):** Console error `ReferenceError: state is not defined`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-31: Session persistence ignores "Stay logged in" checkbox
- **Priority:** P2 (Medium)
- **Status:** `Staging verified`
- **Affected Files:** `src/services/mock-api.js`, `src/main.js`, `src/utils/i18n.js`, `tests/session-persistence.test.js`
- **Reproduction Steps:**
  1. Login with "Stay logged in" unchecked; inspect storage -> tokens isolated in `sessionStorage`, `localStorage` empty.
  2. Simulate browser/tab close -> `sessionStorage` destroyed, session cleanly terminated.
  3. Login with "Stay logged in" checked -> tokens stored in `localStorage`, `sessionStorage` empty.
  4. Simulate browser/tab close & reopen -> persistent tokens survive restarts.
  5. Switch between modes/logins -> opposite storage completely purged to prevent token leaks.
  6. Trigger token expiry/401 -> seamless token refresh preserves the user's chosen storage persistence mode.
- **Expected Result:** Session-only logins store auth tokens strictly in `sessionStorage` (cleared on browser/tab close); persistent logins store tokens in `localStorage` across restarts; token refresh and logout handle both storages cleanly.
- **Actual Result (Before Fix):** All logins unconditionally saved tokens to `localStorage`, ignoring the "Stay logged in" checkbox state and persisting indefinitely.
- **Fix Commit:** `eb8fa05`
- **Verification Evidence:**
  - Automated unit test suite `tests/session-persistence.test.js`: 9/9 tests passing (100%).
  - Full frontend test suite `npm test`: 25/25 tests passing (100%).
  - Syntax check `npm run check`: 0 errors.

---

### Phase 8: Deployment, Routing Contracts & Release Suite (P1 & P2)

#### MH-05: Rate limiter failure mode in production
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/app.js`, `backend/src/config/redis.js`
- **Reproduction Steps:** Simulate Redis disconnect in production.
- **Expected Result:** Falls back to memory bucket rate limiter with logged warning.
- **Actual Result (Before Fix):** Entire API fails closed or open without graceful degradation.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-23: Dispatcher context missing query; status mismatch
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/app.js`, `backend/src/routes/index.js`
- **Reproduction Steps:** Invoke endpoint requiring query parameters (e.g., `listInstructionBundles`).
- **Expected Result:** Query parameters parsed into `req.query`.
- **Actual Result (Before Fix):** Query parameters omitted from dispatcher context.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-24: AI failure fallback and media processing
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/services/ai.service.js`
- **Reproduction Steps:** Invoke AI service with invalid key or invalid image buffer.
- **Expected Result:** Structured error response and wallet credit refund.
- **Actual Result (Before Fix):** Returned synthetic mock text.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-32: Test suite timers and assertion gates
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/tests/`, `backend/src/services/otp.service.js`
- **Reproduction Steps:** Run `npm test` without `--test-force-exit`.
- **Expected Result:** All tests pass and process exits naturally with code 0.
- **Actual Result (Before Fix):** Unref timer handles keep Node event loop open.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-33: API fallback routing under SPA
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `index.html`, server proxy configuration
- **Reproduction Steps:** Request nonexistent `/api/v1/invalid-route`.
- **Expected Result:** JSON 404 response `{"success": false, "error": {"code": "NOT_FOUND"}}`.
- **Actual Result (Before Fix):** Returned SPA `index.html` with status 200.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-34: Enforce HTTPS & Security Headers
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `backend/src/app.js`
- **Reproduction Steps:** Inspect response headers on HTTP request in production.
- **Expected Result:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options headers present.
- **Actual Result (Before Fix):** Security headers missing or incomplete.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

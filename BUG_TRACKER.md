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
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/upload.controller.js`, `backend/src/controllers/ai.controller.js`
- **Reproduction Steps:** User A attempts to generate signed download URL, delete file, or unlock report belonging to User B.
- **Expected Result:** HTTP 403 Forbidden.
- **Actual Result (Before Fix):** Server generates signed URL or performs operation without checking user ownership.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-07: Socket rooms do not verify session membership
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/socket.js`
- **Reproduction Steps:** Client socket connects with User C credentials and emits `join_session` for session between User A and User B.
- **Expected Result:** Socket is denied entry and cannot receive session messages.
- **Actual Result (Before Fix):** Socket joins room and receives messages without verifying session participant list.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-21: Mood logging accepts client-supplied owner
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/user.controller.js`
- **Reproduction Steps:** Send `POST /api/v1/user/mood-logs` with body containing `userId: "other_user"`.
- **Expected Result:** Log is created strictly for the authenticated `req.user.id`.
- **Actual Result (Before Fix):** Server accepted client-provided `userId`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-40: Peer request details lack participant authorization
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/peer.controller.js`
- **Reproduction Steps:** User C calls `GET /api/v1/peer-session-requests/:id` for a request between User A and User B.
- **Expected Result:** HTTP 403 Forbidden.
- **Actual Result (Before Fix):** Details returned to any authenticated user.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

---

### Phase 4: Identity, Age, Guardian & Account Governance (P1)

#### MH-09: Signup drops DOB; adult gate allows unknown age
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`, `backend/src/app.js`
- **Reproduction Steps:** Complete signup flow with DOB; inspect network payload and attempt accessing adult AI services without DOB.
- **Expected Result:** DOB is sent in registration; users with missing DOB are blocked from adult AI endpoints.
- **Actual Result (Before Fix):** `mock-api.js` omitted DOB from register payload; adult gate failed open when DOB was missing.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

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
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`, `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js`
- **Reproduction Steps:** Admin logs in with password only, omitting TOTP code.
- **Expected Result:** HTTP 401 Unauthorized requiring valid TOTP token.
- **Actual Result (Before Fix):** Admin logged in successfully with password alone.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-12: Disabled accounts retain login and request access
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/services/auth.service.js`, `backend/src/app.js`, `backend/src/socket.js`
- **Reproduction Steps:** Deactivate user (`isActive: false`); attempt login and authenticated requests.
- **Expected Result:** HTTP 401/403 Account suspended.
- **Actual Result (Before Fix):** Disabled user can log in and issue requests.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-42: Password-created minor marked onboarding complete before consent
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `backend/src/services/auth.service.js`, `backend/src/app.js`
- **Reproduction Steps:** Register 16-year-old user with password.
- **Expected Result:** `onboardingStatus` is `PENDING_GUARDIAN`; adult/general routes blocked until guardian consents.
- **Actual Result (Before Fix):** User marked `onboardingStatus: COMPLETED`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-13: Social sign-in fabricated account fallback
- **Priority:** P1 (High)
- **Status:** `Open`
- **Affected Files:** `src/main.js`
- **Reproduction Steps:** Click unconfigured social login provider in UI.
- **Expected Result:** Clear error notification that provider is unavailable.
- **Actual Result (Before Fix):** Frontend fabricated `provider_user_*@example.com` and auto-logged in.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

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
- **Status:** `Open`
- **Affected Files:** `backend/src/controllers/peer.controller.js`, `backend/src/repositories/memory/index.js`
- **Reproduction Steps:** Listener calls `grantSessionConsent` or lists peer sessions.
- **Expected Result:** HTTP 200 OK after resolving profile to user.
- **Actual Result (Before Fix):** HTTP 403 Forbidden because `profile.id` was compared with `user.id`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

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
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`
- **Reproduction Steps:** Log in, generate AI chat and thought diary entries, click Logout. Inspect `localStorage`.
- **Expected Result:** All mental health data cleared on logout.
- **Actual Result (Before Fix):** Plaintext notes and chat history remained in browser storage.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

#### MH-22: `getState()` couples rendering to session deletion
- **Priority:** P2 (Medium)
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`, `src/main.js`
- **Reproduction Steps:** Trigger a transient network drop while browsing.
- **Expected Result:** Session preserved; retry on next navigation.
- **Actual Result (Before Fix):** Session token deleted on any 5xx/network error.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

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
- **Status:** `Open`
- **Affected Files:** `src/services/mock-api.js`
- **Reproduction Steps:** Login with "Stay logged in" unchecked; inspect `localStorage`.
- **Expected Result:** Auth tokens stored in `sessionStorage` (expires on tab close).
- **Actual Result (Before Fix):** Always written to `localStorage`.
- **Fix Commit:** Pending
- **Verification Evidence:** Pending

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

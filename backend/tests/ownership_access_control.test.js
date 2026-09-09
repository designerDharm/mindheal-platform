import test from "node:test";
import assert from "node:assert";
import { refreshUploadUrl, deleteUpload, authorizeStoragePathAccess } from "../src/controllers/upload.controller.js";
import { getReport, unlockReport } from "../src/controllers/ai.controller.js";
import { repositories } from "../src/repositories/index.js";

test("MH-06: File and report ownership access control", async (t) => {
  const userA = { id: "usr_synthetic_a", role: "user", email: "user_a@example.com" };
  const userB = { id: "usr_synthetic_b", role: "user", email: "user_b@example.com" };
  const adminUser = { id: "usr_synthetic_admin", role: "admin", email: "admin@example.com" };

  await t.test("1. authorizeStoragePathAccess enforces owner matching", async () => {
    // Owner accessing their own uploads
    assert.strictEqual(await authorizeStoragePathAccess("uploads/usr_synthetic_a/doc.pdf", userA), true);
    assert.strictEqual(await authorizeStoragePathAccess("reports/usr_synthetic_a/rep.pdf", userA), true);
    assert.strictEqual(await authorizeStoragePathAccess("users/usr_synthetic_a/avatar.png", userA), true);

    // Foreign user accessing another user's uploads
    assert.strictEqual(await authorizeStoragePathAccess("uploads/usr_synthetic_a/doc.pdf", userB), false);
    assert.strictEqual(await authorizeStoragePathAccess("reports/usr_synthetic_a/rep.pdf", userB), false);
    assert.strictEqual(await authorizeStoragePathAccess("users/usr_synthetic_a/avatar.png", userB), false);

    // Admin accessing any user's uploads
    assert.strictEqual(await authorizeStoragePathAccess("uploads/usr_synthetic_a/doc.pdf", adminUser), true);
    assert.strictEqual(await authorizeStoragePathAccess("reports/usr_synthetic_a/rep.pdf", adminUser), true);

    // Unauthenticated caller attempting to access user-scoped path
    assert.strictEqual(await authorizeStoragePathAccess("uploads/usr_synthetic_a/doc.pdf", null), false);
  });

  await t.test("2. refreshUploadUrl blocks signing for non-owners (HTTP 403)", async () => {
    // User B tries to sign User A's file
    const responseB = await refreshUploadUrl({
      body: { storagePath: "uploads/usr_synthetic_a/confidential.pdf" },
      user: userB
    });

    assert.strictEqual(responseB.status, 403);
    assert.strictEqual(responseB.body.error.code, "FORBIDDEN");

    // User A signs their own file
    const responseA = await refreshUploadUrl({
      body: { storagePath: "uploads/usr_synthetic_a/confidential.pdf" },
      user: userA
    });

    assert.strictEqual(responseA.status, 200);
    assert.strictEqual(responseA.body.success, true);
    assert.ok(responseA.body.data.url);

    // Admin signs User A's file
    const responseAdmin = await refreshUploadUrl({
      body: { storagePath: "uploads/usr_synthetic_a/confidential.pdf" },
      user: adminUser
    });

    assert.strictEqual(responseAdmin.status, 200);
  });

  await t.test("3. deleteUpload blocks deletion for non-owners (HTTP 403)", async () => {
    // User B tries to delete User A's file
    const responseB = await deleteUpload({
      body: { storagePath: "uploads/usr_synthetic_a/diary-scan.jpg" },
      user: userB
    });

    assert.strictEqual(responseB.status, 403);
    assert.strictEqual(responseB.body.error.code, "FORBIDDEN");

    // User A deletes their own file
    const responseA = await deleteUpload({
      body: { storagePath: "uploads/usr_synthetic_a/diary-scan.jpg" },
      user: userA
    });

    assert.strictEqual(responseA.status, 200);
    assert.strictEqual(responseA.body.data.deleted, true);

    // Admin deletes User A's file
    const responseAdmin = await deleteUpload({
      body: { storagePath: "uploads/usr_synthetic_a/diary-scan.jpg" },
      user: adminUser
    });

    assert.strictEqual(responseAdmin.status, 200);
  });

  await t.test("4. Report reading and unlocking strictly authorizes stored owner", async () => {
    // Create locked report for User A
    const lockedReport = await repositories.reports.create({
      id: "rep_locked_user_a",
      userId: userA.id,
      reportType: "dream",
      inputText: "I saw a river in the mountains",
      aiSummary: "Symbolic journey",
      isPdfUnlocked: false,
      pdfUnlockFeeInr: 49,
      createdAt: new Date().toISOString()
    });

    // Create already-unlocked report for User A
    const unlockedReport = await repositories.reports.create({
      id: "rep_unlocked_user_a",
      userId: userA.id,
      reportType: "handwriting",
      inputText: "Handwriting sample",
      aiSummary: "Detailed psychological breakdown",
      aiFullReport: "Full clinical Jungian analysis text",
      pdfUrl: "https://mock-storage.local/reports/usr_synthetic_a/report.pdf",
      isPdfUnlocked: true,
      pdfUnlockFeeInr: 49,
      createdAt: new Date().toISOString()
    });

    // User B attempts to read User A's report (even with known ID)
    const readAttemptB = await getReport({
      params: { id: lockedReport.id },
      user: userB
    });
    assert.strictEqual(readAttemptB.status, 403);
    assert.strictEqual(readAttemptB.body.error.code, "FORBIDDEN");

    // User B attempts to unlock User A's locked report
    const unlockAttemptB = await unlockReport({
      params: { id: lockedReport.id },
      user: userB
    });
    assert.strictEqual(unlockAttemptB.status, 403);
    assert.strictEqual(unlockAttemptB.body.error.code, "FORBIDDEN");

    // CRITICAL: User B attempts to access User A's ALREADY-UNLOCKED report
    const readUnlockedAttemptB = await getReport({
      params: { id: unlockedReport.id },
      user: userB
    });
    assert.strictEqual(readUnlockedAttemptB.status, 403);
    assert.strictEqual(readUnlockedAttemptB.body.error.code, "FORBIDDEN");

    // CRITICAL: User B attempts to call unlock on User A's ALREADY-UNLOCKED report
    const unlockAlreadyUnlockedAttemptB = await unlockReport({
      params: { id: unlockedReport.id },
      user: userB
    });
    assert.strictEqual(unlockAlreadyUnlockedAttemptB.status, 403);
    assert.strictEqual(unlockAlreadyUnlockedAttemptB.body.error.code, "FORBIDDEN");

    // Owner (User A) reads their own unlocked report
    const readOwnerA = await getReport({
      params: { id: unlockedReport.id },
      user: userA
    });
    assert.strictEqual(readOwnerA.status, 200);
    assert.strictEqual(readOwnerA.body.data.id, unlockedReport.id);

    // Owner (User A) calls unlock on their already-unlocked report
    const unlockOwnerA = await unlockReport({
      params: { id: unlockedReport.id },
      user: userA
    });
    assert.strictEqual(unlockOwnerA.status, 200);
    assert.strictEqual(unlockOwnerA.body.data.id, unlockedReport.id);

    // Admin reads User A's report
    const readAdmin = await getReport({
      params: { id: unlockedReport.id },
      user: adminUser
    });
    assert.strictEqual(readAdmin.status, 200);
  });
});

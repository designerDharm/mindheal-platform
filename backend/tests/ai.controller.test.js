import test from "node:test";
import assert from "node:assert";
import { chat, unlockReport } from "../src/controllers/ai.controller.js";
import { store } from "../src/data/store.js";
import { repositories } from "../src/repositories/index.js";
import { hashValue } from "../src/utils/security.js";

test("ai controller", async (t) => {
  await t.test("logs high-risk AI chat messages without storing raw text", async () => {
    const originalCrisisEvents = repositories.crisisEvents;
    const events = [];
    repositories.crisisEvents = {
      create: async (entry) => {
        events.push(entry);
        return entry;
      }
    };

    try {
      const message = "I want to kill myself";
      const response = await chat({
        body: { message },
        user: { id: "usr_safety" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.safety.riskLevel, "high");
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].userId, "usr_safety");
      assert.strictEqual(events[0].source, "ai_chat");
      assert.strictEqual(events[0].detectedTextHash, hashValue(message));
      assert.ok(!JSON.stringify(events[0]).includes(message));
    } finally {
      repositories.crisisEvents = originalCrisisEvents;
    }
  });

  await t.test("does not log low-risk AI chat messages", async () => {
    const originalCrisisEvents = repositories.crisisEvents;
    let logged = false;
    repositories.crisisEvents = {
      create: async () => {
        logged = true;
      }
    };

    try {
      const response = await chat({
        body: { message: "I feel stressed about work" },
        user: { id: "usr_safety" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.safety.riskLevel, "low");
      assert.strictEqual(logged, false);
    } finally {
      repositories.crisisEvents = originalCrisisEvents;
    }
  });

  await t.test("refunds report unlock fee when PDF unlock fails after debit", async () => {
    const originalReportsUpdate = repositories.reports.update;
    const originalReportsLength = store.analysisReports.length;
    const originalWalletsLength = store.wallets.length;
    const originalLedgerLength = store.ledgerEntries.length;

    const userId = "usr_report_refund";
    const walletId = "wal_report_refund";
    const reportId = "rep_refund_failure";

    store.wallets.push({ id: walletId, ownerType: "user", ownerId: userId, currency: "INR" });
    store.ledgerEntries.push({
      id: "led_report_refund_seed",
      walletId,
      direction: "credit",
      amountPaise: 10000,
      entryType: "test_seed",
      createdAt: new Date().toISOString()
    });
    store.analysisReports.push({
      id: reportId,
      userId,
      reportType: "dream",
      inputText: "A short dream",
      aiSummary: "Summary",
      aiFullReport: "Full report content",
      pdfUrl: null,
      isPdfUnlocked: false,
      pdfUnlockFeeInr: 49,
      createdAt: new Date().toISOString()
    });

    repositories.reports.update = async () => {
      throw new Error("Report update failed.");
    };

    try {
      const response = await unlockReport({
        params: { id: reportId },
        user: { id: userId, role: "user" }
      });

      assert.strictEqual(response.status, 400);
      assert.match(response.body.error.message, /Report update failed/);

      const walletEntries = store.ledgerEntries.filter((entry) => entry.walletId === walletId);
      const debitEntry = walletEntries.find((entry) => entry.entryType === "pdf_unlock");
      const refundEntry = walletEntries.find((entry) => entry.entryType === "pdf_unlock_refund");

      assert.ok(debitEntry);
      assert.ok(refundEntry);
      assert.strictEqual(debitEntry.direction, "debit");
      assert.strictEqual(refundEntry.direction, "credit");
      assert.strictEqual(debitEntry.amountPaise, 4900);
      assert.strictEqual(refundEntry.amountPaise, 4900);
      assert.strictEqual(refundEntry.referenceType, "analysis_report");
      assert.strictEqual(refundEntry.referenceId, reportId);
      assert.match(refundEntry.notes, /Automatic refund/);
    } finally {
      repositories.reports.update = originalReportsUpdate;
      store.analysisReports.length = originalReportsLength;
      store.wallets.length = originalWalletsLength;
      store.ledgerEntries.length = originalLedgerLength;
    }
  });
});

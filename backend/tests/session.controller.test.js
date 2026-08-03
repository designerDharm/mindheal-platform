import test from "node:test";
import assert from "node:assert";
import { bookSession, cancelSession, completeSession } from "../src/controllers/session.controller.js";
import { repositories } from "../src/repositories/index.js";

test("session controller", async (t) => {
  await t.test("rejects invalid booking inputs before creating sessions", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    let counsellorLookupCount = 0;
    let sessionCreateCount = 0;

    repositories.counsellors = {
      findById: async () => {
        counsellorLookupCount += 1;
        return { id: "cns_test", userId: "usr_counsellor" };
      }
    };
    repositories.sessions = {
      create: async () => {
        sessionCreateCount += 1;
      }
    };

    try {
      const cases = [
        [{ sessionType: "telepathy", scheduledAt: "2026-06-06T10:00:00.000Z", durationMinutes: 60, amountInr: 900 }, "Invalid session type."],
        [{ sessionType: "video", scheduledAt: "not-a-date", durationMinutes: 60, amountInr: 900 }, "Invalid scheduled time."],
        [{ sessionType: "video", scheduledAt: "2026-06-06T10:00:00.000Z", durationMinutes: 0, amountInr: 900 }, "Duration must be between 1 and 240 minutes."],
        [{ sessionType: "video", scheduledAt: "2026-06-06T10:00:00.000Z", durationMinutes: 60, amountInr: -1 }, "Invalid amount."]
      ];

      for (const [patch, message] of cases) {
        const response = await bookSession({
          body: { counsellorId: "cns_test", ...patch },
          user: { id: "usr_user" }
        });

        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.body.error.message, message);
      }

      assert.strictEqual(counsellorLookupCount, 0);
      assert.strictEqual(sessionCreateCount, 0);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
    }
  });

  await t.test("records a failed payment session instead of leaving only a wallet mutation", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalAvailabilitySlots = repositories.availabilitySlots;
    const originalWallets = repositories.wallets;
    const calls = [];
    let savedSession = null;
    let updatePatch = null;

    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.availabilitySlots = {
      claimForBooking: async () => {
        calls.push("slot:claim");
        return { id: "slot_test", isBooked: true };
      },
      releaseBooking: async (id) => {
        calls.push("slot:release");
        assert.strictEqual(id, "slot_test");
        return { id, isBooked: false };
      }
    };
    repositories.sessions = {
      create: async (session) => {
        calls.push("session:create");
        savedSession = session;
        return session;
      },
      update: async (id, patch) => {
        calls.push("session:update");
        updatePatch = { id, patch };
        return { ...savedSession, ...patch };
      }
    };
    repositories.wallets = {
      findByOwner: async () => ({ id: "wal_empty", ownerId: "usr_user", currency: "INR" }),
      ledgerEntries: async () => []
    };

    try {
      const response = await bookSession({
        body: {
          counsellorId: "cns_test",
          sessionType: "video",
          scheduledAt: "2026-06-06T10:00:00.000Z",
          durationMinutes: 60,
          amountInr: 900
        },
        user: { id: "usr_user" }
      });

      assert.strictEqual(response.status, 400);
      assert.deepStrictEqual(calls, ["slot:claim", "session:create", "session:update", "slot:release"]);
      assert.strictEqual(updatePatch.id, savedSession.id);
      assert.strictEqual(savedSession.availabilitySlotId, "slot_test");
      assert.strictEqual(updatePatch.patch.status, "payment_failed");
      assert.match(updatePatch.patch.paymentFailureReason, /Insufficient wallet balance/);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.availabilitySlots = originalAvailabilitySlots;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("rejects booking when selected availability slot is unavailable", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalAvailabilitySlots = repositories.availabilitySlots;
    let sessionCreateCount = 0;

    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.availabilitySlots = {
      claimForBooking: async ({ counsellorId, scheduledAt, sessionType }) => {
        assert.strictEqual(counsellorId, "cns_test");
        assert.strictEqual(scheduledAt.toISOString(), "2026-06-06T10:00:00.000Z");
        assert.strictEqual(sessionType, "video");
        return null;
      }
    };
    repositories.sessions = {
      create: async () => {
        sessionCreateCount += 1;
      }
    };

    try {
      const response = await bookSession({
        body: {
          counsellorId: "cns_test",
          sessionType: "video",
          scheduledAt: "2026-06-06T10:00:00.000Z",
          durationMinutes: 60,
          amountInr: 900
        },
        user: { id: "usr_user" }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Selected slot is no longer available.");
      assert.strictEqual(sessionCreateCount, 0);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.availabilitySlots = originalAvailabilitySlots;
    }
  });

  await t.test("wraps successful booking mutations in a repository transaction", async () => {
    const originalTransactions = repositories.transactions;
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalAvailabilitySlots = repositories.availabilitySlots;
    const originalWallets = repositories.wallets;
    const calls = [];

    repositories.transactions = {
      withTransaction: async (callback) => {
        calls.push("transaction:begin");
        const result = await callback();
        calls.push("transaction:commit");
        return result;
      }
    };
    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.availabilitySlots = {
      claimForBooking: async () => {
        calls.push("slot:claim");
        return { id: "slot_test", isBooked: true };
      }
    };
    repositories.sessions = {
      create: async (session) => {
        calls.push("session:create");
        return session;
      }
    };
    repositories.wallets = {
      findByOwner: async () => ({ id: "wal_funded", ownerId: "usr_user", currency: "INR" }),
      ledgerEntries: async () => [{ direction: "credit", amountPaise: 100000 }],
      createLedgerEntry: async (entry) => {
        calls.push("wallet:debit");
        return entry;
      }
    };

    try {
      const response = await bookSession({
        body: {
          counsellorId: "cns_test",
          sessionType: "video",
          scheduledAt: "2026-06-06T10:00:00.000Z",
          durationMinutes: 60,
          amountInr: 900
        },
        user: { id: "usr_user" }
      });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.data.availabilitySlotId, "slot_test");
      assert.deepStrictEqual(calls, [
        "transaction:begin",
        "slot:claim",
        "session:create",
        "wallet:debit",
        "transaction:commit"
      ]);
    } finally {
      repositories.transactions = originalTransactions;
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.availabilitySlots = originalAvailabilitySlots;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("cancels pending sessions by releasing the slot and refunding unmatched wallet holds", async () => {
    const originalTransactions = repositories.transactions;
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalAvailabilitySlots = repositories.availabilitySlots;
    const originalWallets = repositories.wallets;
    const calls = [];
    let updatedPatch = null;

    repositories.transactions = {
      withTransaction: async (callback) => {
        calls.push("transaction");
        return await callback();
      }
    };
    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.sessions = {
      findById: async () => ({
        id: "ses_cancel",
        userId: "usr_user",
        counsellorId: "cns_test",
        counsellorUserId: "usr_counsellor",
        status: "pending",
        availabilitySlotId: "slot_test",
        amountInr: 900
      }),
      update: async (id, patch) => {
        calls.push("session:update");
        updatedPatch = { id, patch };
        return { id, status: patch.status };
      }
    };
    repositories.availabilitySlots = {
      releaseBooking: async (id) => {
        calls.push("slot:release");
        assert.strictEqual(id, "slot_test");
        return { id, isBooked: false };
      }
    };
    repositories.wallets = {
      findByOwner: async () => ({ id: "wal_user", ownerId: "usr_user", currency: "INR" }),
      ledgerEntries: async () => [
        {
          walletId: "wal_user",
          direction: "debit",
          amountPaise: 90000,
          entryType: "session_hold",
          referenceType: "session",
          referenceId: "ses_cancel"
        }
      ],
      createLedgerEntry: async (entry) => {
        calls.push("wallet:refund");
        assert.strictEqual(entry.direction, "credit");
        assert.strictEqual(entry.amountPaise, 90000);
        assert.strictEqual(entry.entryType, "session_hold_refund");
        assert.strictEqual(entry.referenceType, "session");
        assert.strictEqual(entry.referenceId, "ses_cancel");
        return entry;
      }
    };

    try {
      const response = await cancelSession({
        params: { id: "ses_cancel" },
        user: { id: "usr_user", role: "user" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(updatedPatch.id, "ses_cancel");
      assert.strictEqual(updatedPatch.patch.status, "cancelled");
      assert.deepStrictEqual(calls, ["transaction", "session:update", "slot:release", "wallet:refund"]);
    } finally {
      repositories.transactions = originalTransactions;
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.availabilitySlots = originalAvailabilitySlots;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("does not duplicate session hold refunds when cancellation is retried", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalAvailabilitySlots = repositories.availabilitySlots;
    const originalWallets = repositories.wallets;
    let refundCount = 0;

    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.sessions = {
      findById: async () => ({
        id: "ses_cancel_retry",
        userId: "usr_user",
        counsellorId: "cns_test",
        counsellorUserId: "usr_counsellor",
        status: "pending",
        availabilitySlotId: "slot_test"
      }),
      update: async (id, patch) => ({ id, status: patch.status })
    };
    repositories.availabilitySlots = {
      releaseBooking: async () => ({ id: "slot_test", isBooked: false })
    };
    repositories.wallets = {
      findByOwner: async () => ({ id: "wal_user", ownerId: "usr_user", currency: "INR" }),
      ledgerEntries: async () => [
        { direction: "debit", amountPaise: 90000, entryType: "session_hold", referenceType: "session", referenceId: "ses_cancel_retry" },
        { direction: "credit", amountPaise: 90000, entryType: "session_hold_refund", referenceType: "session", referenceId: "ses_cancel_retry" }
      ],
      createLedgerEntry: async () => {
        refundCount += 1;
      }
    };

    try {
      const response = await cancelSession({
        params: { id: "ses_cancel_retry" },
        user: { id: "usr_user", role: "user" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(refundCount, 0);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.availabilitySlots = originalAvailabilitySlots;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("completes confirmed sessions by settling counsellor payout and platform commission", async () => {
    const originalTransactions = repositories.transactions;
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalWallets = repositories.wallets;
    const calls = [];
    const walletsByOwner = {
      usr_user: { id: "wal_user", ownerId: "usr_user", currency: "INR" },
      usr_counsellor: { id: "wal_counsellor", ownerId: "usr_counsellor", currency: "INR" },
      platform: { id: "wal_platform", ownerId: "platform", currency: "INR" }
    };
    const ledgerByWallet = {
      wal_user: [
        {
          direction: "debit",
          amountPaise: 90000,
          entryType: "session_hold",
          referenceType: "session",
          referenceId: "ses_complete"
        }
      ],
      wal_counsellor: [],
      wal_platform: []
    };

    repositories.transactions = {
      withTransaction: async (callback) => {
        calls.push("transaction");
        return await callback();
      }
    };
    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.sessions = {
      findById: async () => ({
        id: "ses_complete",
        userId: "usr_user",
        counsellorId: "cns_test",
        counsellorUserId: "usr_counsellor",
        status: "confirmed",
        amountInr: 900,
        counsellorEarningInr: 720,
        platformCommissionInr: 180
      }),
      update: async (id, patch) => {
        calls.push("session:update");
        assert.strictEqual(id, "ses_complete");
        assert.strictEqual(patch.status, "completed");
        return { id, status: patch.status };
      }
    };
    repositories.wallets = {
      findByOwner: async (ownerId) => walletsByOwner[ownerId],
      ledgerEntries: async (walletId) => ledgerByWallet[walletId] || [],
      createLedgerEntry: async (entry) => {
        calls.push(entry.entryType);
        ledgerByWallet[entry.walletId].push(entry);
        return entry;
      }
    };

    try {
      const response = await completeSession({
        params: { id: "ses_complete" },
        user: { id: "usr_counsellor", role: "counsellor" }
      });

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(calls, [
        "transaction",
        "session_counsellor_payout",
        "session_platform_commission",
        "session:update"
      ]);

      const counsellorPayout = ledgerByWallet.wal_counsellor.find((entry) => entry.entryType === "session_counsellor_payout");
      const platformCommission = ledgerByWallet.wal_platform.find((entry) => entry.entryType === "session_platform_commission");
      assert.strictEqual(counsellorPayout.amountPaise, 72000);
      assert.strictEqual(counsellorPayout.referenceId, "ses_complete");
      assert.strictEqual(platformCommission.amountPaise, 18000);
      assert.strictEqual(platformCommission.referenceId, "ses_complete");
    } finally {
      repositories.transactions = originalTransactions;
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("does not duplicate settlement entries when completion is retried", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalWallets = repositories.wallets;
    let createdLedgerCount = 0;
    const walletsByOwner = {
      usr_user: { id: "wal_user", ownerId: "usr_user", currency: "INR" },
      usr_counsellor: { id: "wal_counsellor", ownerId: "usr_counsellor", currency: "INR" },
      platform: { id: "wal_platform", ownerId: "platform", currency: "INR" }
    };
    const baseReference = { referenceType: "session", referenceId: "ses_complete_retry" };

    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.sessions = {
      findById: async () => ({
        id: "ses_complete_retry",
        userId: "usr_user",
        counsellorId: "cns_test",
        counsellorUserId: "usr_counsellor",
        status: "completed",
        amountInr: 900,
        counsellorEarningInr: 720,
        platformCommissionInr: 180
      }),
      update: async () => {
        throw new Error("Completed sessions should not be updated on retry.");
      }
    };
    repositories.wallets = {
      findByOwner: async (ownerId) => walletsByOwner[ownerId],
      ledgerEntries: async (walletId) => {
        if (walletId === "wal_user") {
          return [{ direction: "debit", amountPaise: 90000, entryType: "session_hold", ...baseReference }];
        }
        if (walletId === "wal_counsellor") {
          return [{ direction: "credit", amountPaise: 72000, entryType: "session_counsellor_payout", ...baseReference }];
        }
        if (walletId === "wal_platform") {
          return [{ direction: "credit", amountPaise: 18000, entryType: "session_platform_commission", ...baseReference }];
        }
        return [];
      },
      createLedgerEntry: async () => {
        createdLedgerCount += 1;
      }
    };

    try {
      const response = await completeSession({
        params: { id: "ses_complete_retry" },
        user: { id: "usr_counsellor", role: "counsellor" }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(createdLedgerCount, 0);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.wallets = originalWallets;
    }
  });

  await t.test("does not complete confirmed paid sessions when the wallet hold is missing", async () => {
    const originalCounsellors = repositories.counsellors;
    const originalSessions = repositories.sessions;
    const originalWallets = repositories.wallets;
    let sessionUpdated = false;

    repositories.counsellors = {
      findById: async () => ({ id: "cns_test", userId: "usr_counsellor" })
    };
    repositories.sessions = {
      findById: async () => ({
        id: "ses_no_hold",
        userId: "usr_user",
        counsellorId: "cns_test",
        counsellorUserId: "usr_counsellor",
        status: "confirmed",
        counsellorEarningInr: 720,
        platformCommissionInr: 180
      }),
      update: async () => {
        sessionUpdated = true;
      }
    };
    repositories.wallets = {
      findByOwner: async (ownerId) => ({ id: `wal_${ownerId}`, ownerId, currency: "INR" }),
      ledgerEntries: async () => [],
      createLedgerEntry: async () => {
        throw new Error("Settlement should not create ledger entries without a hold.");
      }
    };

    try {
      const response = await completeSession({
        params: { id: "ses_no_hold" },
        user: { id: "usr_counsellor", role: "counsellor" }
      });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.error.message, "Session hold is not available for settlement.");
      assert.strictEqual(sessionUpdated, false);
    } finally {
      repositories.counsellors = originalCounsellors;
      repositories.sessions = originalSessions;
      repositories.wallets = originalWallets;
    }
  });
});

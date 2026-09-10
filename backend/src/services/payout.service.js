import { createId } from "../utils/security.js";
import { repositories } from "../repositories/index.js";
import { debit, credit } from "./wallet.service.js";
import { postJournalTransaction } from "./double_entry.service.js";

/**
 * Calculates net eligible earnings for a peer listener.
 * Strictly separates earned session revenue from user deposits (e.g. topup).
 */
export async function getEligiblePeerEarnings(userId) {
  const wallet = await repositories.wallets.findByOwner(userId);
  if (!wallet) return 0;
  const ledger = await repositories.wallets.ledgerEntries(wallet.id);

  // Strictly filter on earning entries
  const earningCredits = ledger
    .filter((e) => (e.entryType === "peer_session_earning" || e.entryType === "peer_session_pending_earning") && e.direction === "credit")
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  // Subtract previous payouts
  const payoutDebits = ledger
    .filter((e) => (e.entryType === "peer_payout" || e.entryType === "listener_payout") && e.direction === "debit")
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  // Add back any failed payout reversals
  const payoutReversals = ledger
    .filter((e) => (e.entryType === "payout_reversal" || e.entryType === "peer_payout_refund") && e.direction === "credit")
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  const netEligible = Math.max(0, earningCredits - (payoutDebits - payoutReversals));

  // Cap at available wallet balance in case of other service deductions
  const currentTotalBalance = ledger.reduce(
    (sum, e) => sum + (e.direction === "credit" ? Number(e.amountPaise || 0) : -Number(e.amountPaise || 0)),
    0
  );

  return Math.min(netEligible, Math.max(0, currentTotalBalance));
}

/**
 * Calculates net mature eligible earnings for a counsellor.
 * Strictly separates earned session revenue from user deposits.
 */
export async function getEligibleCounsellorEarnings(counsellorUserId, cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000) {
  const wallet = await repositories.wallets.findByOwner(counsellorUserId);
  if (!wallet) return 0;
  const ledger = await repositories.wallets.ledgerEntries(wallet.id);

  // Strictly filter on mature session earning entries
  const matureCredits = ledger
    .filter(
      (e) =>
        (e.entryType === "session_counsellor_pending_earning" || e.entryType === "counsellor_earning") &&
        e.direction === "credit" &&
        new Date(e.createdAt || 0).getTime() <= cutoffTime
    )
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  const payoutDebits = ledger
    .filter((e) => e.entryType === "counsellor_payout" && e.direction === "debit")
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  const payoutReversals = ledger
    .filter((e) => (e.entryType === "payout_reversal" || e.entryType === "counsellor_payout_refund") && e.direction === "credit")
    .reduce((sum, e) => sum + Number(e.amountPaise || 0), 0);

  const netEligible = Math.max(0, matureCredits - (payoutDebits - payoutReversals));

  const currentTotalBalance = ledger.reduce(
    (sum, e) => sum + (e.direction === "credit" ? Number(e.amountPaise || 0) : -Number(e.amountPaise || 0)),
    0
  );

  return Math.min(netEligible, Math.max(0, currentTotalBalance));
}

/**
 * Weekly Payout Engine Worker
 * Aggregates eligible counsellor and peer listener earnings,
 * creates durable batch and record states, debits wallets transactionally,
 * and maintains idempotency against retries.
 */
export async function executeWeeklyPayoutBatch({
  executedByUserId = "usr_admin",
  batchReference = null,
  cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000
} = {}) {
  const generatedReference = batchReference || `PAYOUT_BATCH_${Date.now()}`;

  // 1. Check for existing batch (Idempotency against batch retries)
  const existingBatch = await repositories.payoutBatches.findByReference(generatedReference);
  if (existingBatch) {
    const existingRecords = await repositories.payoutRecords.findByBatchId(existingBatch.id);
    return {
      status: "success",
      isIdempotentReplay: true,
      data: {
        batch: existingBatch,
        payouts: existingRecords
      }
    };
  }

  const batchId = createId("bat");
  const batchRecord = await repositories.payoutBatches.create({
    id: batchId,
    batchReference: generatedReference,
    totalGrossPaise: 0,
    totalCommissionPaise: 0,
    totalPayoutPaise: 0,
    status: "processing",
    counsellorCount: 0,
    listenerCount: 0,
    payoutType: "mixed",
    executedBy: executedByUserId,
    metadata: { createdAt: new Date().toISOString() }
  });

  let totalCounsellorPayoutPaise = 0;
  let totalCounsellorGrossPaise = 0;
  let totalCounsellorCommissionPaise = 0;
  let counsellorCount = 0;
  const counsellorPayouts = [];

  // --- 2. Counsellor Payouts Processing ---
  const counsellors = typeof repositories.counsellors.listAll === "function"
    ? await repositories.counsellors.listAll()
    : [];

  for (const counsellor of counsellors) {
    if (!counsellor.userId) continue;

    const eligiblePaise = await getEligibleCounsellorEarnings(counsellor.userId, cutoffTime);
    if (eligiblePaise > 0) {
      const idempotencyKey = `payout_cns_${counsellor.id}_${batchId}`;

      // Check if already in progress or created
      const existingRecord = await repositories.payoutRecords.findByIdempotencyKey(idempotencyKey);
      if (existingRecord) continue;

      const payoutRecordId = createId("pout");
      const payoutRecord = await repositories.payoutRecords.create({
        id: payoutRecordId,
        batchId: batchRecord.id,
        payoutType: "counsellor",
        beneficiaryId: counsellor.id,
        userId: counsellor.userId,
        amountPaise: eligiblePaise,
        status: "processing",
        idempotencyKey,
        providerTransferId: `tr_${payoutRecordId}`,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });

      // Debit wallet for payout deduction
      await debit(counsellor.userId, eligiblePaise / 100, "counsellor_payout", {
        referenceType: "PayoutRecord",
        referenceId: payoutRecord.id,
        idempotencyKey
      });

      // Balanced Double-Entry Journal
      const journal = await postJournalTransaction({
        journalType: "COUNSELLOR_PAYOUT",
        businessReferenceType: "PayoutRecord",
        businessReferenceId: payoutRecord.id,
        idempotencyKey: `jnl_${idempotencyKey}`,
        description: `Weekly counsellor payout of ${eligiblePaise / 100} INR for ${counsellor.id}`,
        entries: [
          { accountKey: `USER_AVAILABLE_${counsellor.userId}`, entrySide: "debit", amountPaise: eligiblePaise },
          { accountKey: "BANK_CLEARING", entrySide: "credit", amountPaise: eligiblePaise }
        ]
      });
      await repositories.journalTransactions.create(journal);

      const grossPaise = Math.floor((eligiblePaise * 10000) / 9000);
      const commissionPaise = grossPaise - eligiblePaise;

      totalCounsellorPayoutPaise += eligiblePaise;
      totalCounsellorGrossPaise += grossPaise;
      totalCounsellorCommissionPaise += commissionPaise;
      counsellorCount++;
      counsellorPayouts.push(payoutRecord);
    }
  }

  // --- 3. Peer Listener Payouts Processing ---
  const peerProfiles = typeof repositories.peerListenerProfiles.listAll === "function"
    ? await repositories.peerListenerProfiles.listAll()
    : (typeof repositories.peerListenerProfiles.list === "function"
      ? await repositories.peerListenerProfiles.list()
      : []);

  const activeProfiles = peerProfiles.filter((p) => p.verificationStatus === "approved");

  let totalPeerPayoutPaise = 0;
  let listenerCount = 0;
  const peerPayouts = [];

  for (const profile of activeProfiles) {
    if (!profile.userId) continue;

    const eligiblePaise = await getEligiblePeerEarnings(profile.userId);
    if (eligiblePaise > 0) {
      const idempotencyKey = `payout_peer_${profile.id}_${batchId}`;

      // Check if already in progress or created
      const existingRecord = await repositories.payoutRecords.findByIdempotencyKey(idempotencyKey);
      if (existingRecord) continue;

      const payoutRecordId = createId("pout");
      const payoutRecord = await repositories.payoutRecords.create({
        id: payoutRecordId,
        batchId: batchRecord.id,
        payoutType: "peer_listener",
        beneficiaryId: profile.id,
        userId: profile.userId,
        amountPaise: eligiblePaise,
        status: "processing",
        idempotencyKey,
        providerTransferId: `tr_${payoutRecordId}`,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });

      // Debit wallet for payout deduction
      await debit(profile.userId, eligiblePaise / 100, "peer_payout", {
        referenceType: "PeerListenerProfile",
        referenceId: profile.id,
        idempotencyKey
      });

      // Balanced Double-Entry Journal
      const journal = await postJournalTransaction({
        journalType: "PEER_PAYOUT",
        businessReferenceType: "PeerListenerProfile",
        businessReferenceId: profile.id,
        idempotencyKey: `jnl_${idempotencyKey}`,
        description: `Weekly payout of ${eligiblePaise / 100} INR for peer listener ${profile.id}`,
        entries: [
          { accountKey: `USER_AVAILABLE_${profile.userId}`, entrySide: "debit", amountPaise: eligiblePaise },
          { accountKey: "BANK_CLEARING", entrySide: "credit", amountPaise: eligiblePaise }
        ]
      });
      await repositories.journalTransactions.create(journal);

      totalPeerPayoutPaise += eligiblePaise;
      listenerCount++;
      peerPayouts.push(payoutRecord);
    }
  }

  const totalPayoutPaise = totalCounsellorPayoutPaise + totalPeerPayoutPaise;
  const totalGrossPaise = totalCounsellorGrossPaise + totalPeerPayoutPaise;
  const totalCommissionPaise = totalCounsellorCommissionPaise;

  // 4. Update Batch Record
  const updatedBatch = await repositories.payoutBatches.update(batchRecord.id, {
    totalGrossPaise,
    totalCommissionPaise,
    totalPayoutPaise,
    counsellorCount,
    listenerCount,
    status: totalPayoutPaise > 0 ? "processing" : "paid"
  });

  // 5. Audit Log
  const auditId = createId("aud");
  await repositories.auditLogs.create({
    id: auditId,
    userId: executedByUserId,
    action: "EXECUTE_PAYOUT_BATCH",
    entityType: "PayoutBatch",
    newValue: {
      batchId: updatedBatch.id,
      batchReference: updatedBatch.batchReference,
      totalPayoutPaise,
      counsellorCount,
      listenerCount
    }
  });

  return {
    status: "success",
    data: {
      batch: updatedBatch,
      counsellors: {
        totalPayoutPaise: totalCounsellorPayoutPaise,
        counsellorCount,
        payouts: counsellorPayouts
      },
      peerListeners: {
        totalPayoutPaise: totalPeerPayoutPaise,
        listenerCount,
        payouts: peerPayouts
      },
      auditLogId: auditId
    }
  };
}

/**
 * Provider Reconciliation
 * Reconciles provider transfer events (confirmed or failed).
 * If confirmed: sets payout state to confirmed.
 * If failed: sets payout state to failed (unpaid) and refunds debited funds
 * back to provider's wallet balance via payout_reversal with double-entry reversal.
 */
export async function reconcilePayoutTransfer({
  payoutId,
  transferStatus, // "confirmed" | "paid" | "failed" | "rejected"
  providerReference = null,
  failureReason = null
}) {
  const record = await repositories.payoutRecords.findById(payoutId);
  if (!record) {
    const error = new Error(`Payout record '${payoutId}' not found.`);
    error.code = "PAYOUT_NOT_FOUND";
    throw error;
  }

  if (record.status === "confirmed") {
    return { record, reconciled: true, alreadySettled: true };
  }

  const isSuccess = transferStatus === "confirmed" || transferStatus === "paid";
  const isFailure = transferStatus === "failed" || transferStatus === "rejected";

  if (isSuccess) {
    const updated = await repositories.payoutRecords.update(record.id, {
      status: "confirmed",
      providerTransferId: providerReference || record.providerTransferId,
      reconciledAt: new Date().toISOString()
    });

    if (record.batchId) {
      await updateBatchStatusIfAllResolved(record.batchId);
    }

    return { record: updated, reconciled: true, status: "confirmed" };
  }

  if (isFailure) {
    // 1. Mark record as failed (remains unpaid)
    const updated = await repositories.payoutRecords.update(record.id, {
      status: "failed",
      failureReason: failureReason || "Provider transfer failed or rejected",
      reconciledAt: new Date().toISOString()
    });

    // 2. Compensate provider: refund debited funds back to wallet
    const refundInr = record.amountPaise / 100;
    await credit(record.userId, refundInr, "payout_reversal", {
      referenceType: "PayoutRecord",
      referenceId: record.id,
      notes: `Refund for failed payout transfer ${record.id}: ${failureReason || "transfer failed"}`
    });

    // 3. Post reversal journal transaction
    const reversalJournal = await postJournalTransaction({
      journalType: "PAYOUT_REVERSAL",
      businessReferenceType: "PayoutRecord",
      businessReferenceId: record.id,
      idempotencyKey: `rev_${record.id}_${Date.now()}`,
      description: `Reversal of failed payout for user ${record.userId}`,
      entries: [
        { accountKey: "BANK_CLEARING", entrySide: "debit", amountPaise: record.amountPaise },
        { accountKey: `USER_AVAILABLE_${record.userId}`, entrySide: "credit", amountPaise: record.amountPaise }
      ]
    });
    await repositories.journalTransactions.create(reversalJournal);

    if (record.batchId) {
      await updateBatchStatusIfAllResolved(record.batchId);
    }

    return { record: updated, reconciled: true, status: "failed", refunded: true };
  }

  throw new Error(`Unsupported transferStatus '${transferStatus}'. Use 'confirmed', 'paid', 'failed', or 'rejected'.`);
}

async function updateBatchStatusIfAllResolved(batchId) {
  const batchRecords = await repositories.payoutRecords.findByBatchId(batchId);
  const allResolved = batchRecords.every((r) => r.status === "confirmed" || r.status === "failed");
  if (allResolved) {
    const hasConfirmed = batchRecords.some((r) => r.status === "confirmed");
    await repositories.payoutBatches.update(batchId, {
      status: hasConfirmed ? "paid" : "failed",
      paidAt: hasConfirmed ? new Date().toISOString() : null
    });
  }
}

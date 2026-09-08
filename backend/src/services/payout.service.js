import { createId } from "../utils/security.js";
import { repositories } from "../repositories/index.js";
import { getBalance, debit } from "./wallet.service.js";
import { postJournalTransaction } from "./double_entry.service.js";

/**
 * Weekly Payout Engine Worker
 * Aggregates eligible counsellor and peer listener earnings
 * and batches them for weekly payout processing.
 */
export async function executeWeeklyPayoutBatch(executedByUserId = "usr_admin") {
  const result = {
    counsellors: null,
    peerListeners: null,
    auditLogId: null
  };

  // --- 1. Counsellor Payout Batching ---
  const allLedgers = await repositories.wallets.allLedgerEntries();
  const pendingEarningEntries = allLedgers.filter(
    (e) => e.entryType === "session_counsellor_pending_earning" && e.direction === "credit"
  );

  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7-day eligibility delay
  const eligibleCounsellorEntries = pendingEarningEntries.filter(
    (e) => new Date(e.createdAt || 0).getTime() <= cutoffTime
  );

  if (eligibleCounsellorEntries.length) {
    let totalGrossPaise = 0;
    let totalCommissionPaise = 0;
    let totalPayoutPaise = 0;
    const counsellorEarningsMap = new Map();

    for (const entry of eligibleCounsellorEntries) {
      const amountPaise = Number(entry.amountPaise || 0);
      totalPayoutPaise += amountPaise;
      
      const grossPaise = Math.floor((amountPaise * 10000) / 9000);
      const commissionPaise = grossPaise - amountPaise;

      totalGrossPaise += grossPaise;
      totalCommissionPaise += commissionPaise;

      const counsellorWalletId = entry.walletId;
      const existing = counsellorEarningsMap.get(counsellorWalletId) || 0;
      counsellorEarningsMap.set(counsellorWalletId, existing + amountPaise);
    }

    const batchId = createId("bat");
    result.counsellors = {
      id: batchId,
      batchReference: `COUNSELLOR_PAYOUT_BATCH_${Date.now()}`,
      totalGrossPaise,
      totalCommissionPaise,
      totalPayoutPaise,
      counsellorCount: counsellorEarningsMap.size,
      status: "processed"
    };
  }

  // --- 2. Peer Listener Payout Batching ---
  const peerProfiles = await repositories.peerListenerProfiles.listAll();
  const activePeerProfiles = peerProfiles.filter(p => p.verificationStatus === "approved");
  
  let peerPayoutCount = 0;
  let totalPeerPayoutPaise = 0;
  const peerPayoutsList = [];

  for (const profile of activePeerProfiles) {
    const balancePaise = await getBalance(profile.userId);
    if (balancePaise > 0) {
      const amountInr = balancePaise / 100;
      
      // Debit the wallet to lock/deduct the payout
      await debit(profile.userId, amountInr, "peer_payout", {
        referenceType: "PeerListenerProfile",
        referenceId: profile.id
      });

      // Post double-entry journal for this payout
      const payoutJournal = await postJournalTransaction({
        journalType: "PEER_PAYOUT",
        businessReferenceType: "PeerListenerProfile",
        businessReferenceId: profile.id,
        idempotencyKey: `payout_${profile.id}_${Date.now()}`,
        description: `Weekly payout of ${amountInr} INR for peer listener ${profile.id}`,
        entries: [
          { accountKey: `USER_AVAILABLE_${profile.userId}`, entrySide: "debit", amountPaise: balancePaise },
          { accountKey: "BANK_CLEARING", entrySide: "credit", amountPaise: balancePaise }
        ]
      });
      await repositories.journalTransactions.create(payoutJournal);

      peerPayoutCount++;
      totalPeerPayoutPaise += balancePaise;
      peerPayoutsList.push({
        listenerProfileId: profile.id,
        userId: profile.userId,
        amountPaise: balancePaise
      });
    }
  }

  if (peerPayoutCount > 0) {
    const batchId = createId("bat");
    result.peerListeners = {
      id: batchId,
      batchReference: `PEER_PAYOUT_BATCH_${Date.now()}`,
      totalPayoutPaise: totalPeerPayoutPaise,
      listenerCount: peerPayoutCount,
      status: "processed",
      payouts: peerPayoutsList
    };
  }

  // --- 3. Record Payout Audit Event ---
  const auditId = createId("aud");
  await repositories.auditLogs.create({
    id: auditId,
    userId: executedByUserId,
    action: "EXECUTE_PAYOUT_BATCH",
    entityType: "PayoutBatch",
    newValue: result
  });

  result.auditLogId = auditId;
  return { status: "success", data: result };
}

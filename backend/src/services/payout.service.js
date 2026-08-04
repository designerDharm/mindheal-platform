import { createId } from "../utils/security.js";
import { repositories } from "../repositories/index.js";

/**
 * Weekly Payout Engine Worker
 * Aggregates eligible counsellor earnings (completed sessions >= 7 days old)
 * and batches them for weekly payout processing.
 */
export async function executeWeeklyPayoutBatch(executedByUserId = "usr_admin") {
  const allLedgers = await repositories.wallets.allLedgerEntries();
  
  // 1. Filter all pending counsellor earnings
  const pendingEarningEntries = allLedgers.filter(
    (e) => e.entryType === "session_counsellor_pending_earning" && e.direction === "credit"
  );

  if (!pendingEarningEntries.length) {
    return { status: "no_eligible_earnings", batch: null };
  }

  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7-day eligibility delay
  const eligibleEntries = pendingEarningEntries.filter(
    (e) => new Date(e.createdAt || 0).getTime() <= cutoffTime
  );

  if (!eligibleEntries.length) {
    return { status: "no_matured_earnings", message: "Pending earnings exist but have not reached 7-day eligibility period.", batch: null };
  }

  // 2. Aggregate earnings per counsellor
  let totalGrossPaise = 0;
  let totalCommissionPaise = 0;
  let totalPayoutPaise = 0;
  const counsellorEarningsMap = new Map();

  for (const entry of eligibleEntries) {
    const amountPaise = Number(entry.amountPaise || 0);
    totalPayoutPaise += amountPaise;
    
    // Approximate gross and commission for tracking (10% BPS)
    const grossPaise = Math.floor((amountPaise * 10000) / 9000);
    const commissionPaise = grossPaise - amountPaise;

    totalGrossPaise += grossPaise;
    totalCommissionPaise += commissionPaise;

    const counsellorWalletId = entry.walletId;
    const existing = counsellorEarningsMap.get(counsellorWalletId) || 0;
    counsellorEarningsMap.set(counsellorWalletId, existing + amountPaise);
  }

  const batchId = createId("bat");
  const payoutBatch = {
    id: batchId,
    batchReference: `PAYOUT_BATCH_${Date.now()}`,
    totalGrossPaise,
    totalCommissionPaise,
    totalPayoutPaise,
    counsellorCount: counsellorEarningsMap.size,
    status: "processing",
    executedBy: executedByUserId,
    createdAt: new Date().toISOString()
  };

  // 3. Record Payout Batch & Audit Event
  await repositories.auditLogs.create({
    id: createId("aud"),
    userId: executedByUserId,
    action: "EXECUTE_PAYOUT_BATCH",
    entityType: "PayoutBatch",
    entityId: batchId,
    newValue: payoutBatch
  });

  return { status: "success", batch: payoutBatch };
}

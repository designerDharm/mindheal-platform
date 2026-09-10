process.env.NODE_ENV = "test";
process.env.REPOSITORY_DRIVER = "memory";

import test from "node:test";
import assert from "node:assert";

// Dynamic import ensures REPOSITORY_DRIVER=memory is applied even when invoked directly
const { memoryRepositories } = await import("../src/repositories/memory/index.js");
const { postgresRepositories } = await import("../src/repositories/postgres/index.js");
const { repositories } = await import("../src/repositories/index.js");
const { credit, getBalance, getWallet } = await import("../src/services/wallet.service.js");
const {
  executeWeeklyPayoutBatch,
  getEligiblePeerEarnings,
  getEligibleCounsellorEarnings,
  reconcilePayoutTransfer
} = await import("../src/services/payout.service.js");

test("MH-20: Payout worker repair, repository contracts, earnings separation, and reconciliation", async (t) => {
  await t.test("1. Both repository drivers implement peerListenerProfiles.listAll and payout namespaces", () => {
    // Check memory repository
    assert.strictEqual(typeof memoryRepositories.peerListenerProfiles.listAll, "function");
    assert.strictEqual(typeof memoryRepositories.payoutBatches.create, "function");
    assert.strictEqual(typeof memoryRepositories.payoutBatches.findByReference, "function");
    assert.strictEqual(typeof memoryRepositories.payoutBatches.findById, "function");
    assert.strictEqual(typeof memoryRepositories.payoutBatches.update, "function");
    assert.strictEqual(typeof memoryRepositories.payoutBatches.list, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.create, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.findById, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.findByBatchId, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.findByIdempotencyKey, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.update, "function");
    assert.strictEqual(typeof memoryRepositories.payoutRecords.list, "function");

    // Check postgres repository
    assert.strictEqual(typeof postgresRepositories.peerListenerProfiles.listAll, "function");
    assert.strictEqual(typeof postgresRepositories.payoutBatches.create, "function");
    assert.strictEqual(typeof postgresRepositories.payoutBatches.findByReference, "function");
    assert.strictEqual(typeof postgresRepositories.payoutBatches.findById, "function");
    assert.strictEqual(typeof postgresRepositories.payoutBatches.update, "function");
    assert.strictEqual(typeof postgresRepositories.payoutBatches.list, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.create, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.findById, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.findByBatchId, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.findByIdempotencyKey, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.update, "function");
    assert.strictEqual(typeof postgresRepositories.payoutRecords.list, "function");
  });

  await t.test("2. Strictly separates eligible earnings from user deposits (topups are NEVER swept)", async () => {
    const listenerUserId = "usr_listener_deposit_test";
    const profileId = "plp_deposit_test";

    // Setup listener profile
    await repositories.peerListenerProfiles.create({
      id: profileId,
      userId: listenerUserId,
      publicDisplayName: "Listener With Deposit",
      verificationStatus: "approved"
    });

    // Simulate user depositing ₹5,000 for personal use
    await credit(listenerUserId, 5000, "topup", { notes: "Personal wallet topup" });

    // Verify balance is ₹5,000 (500,000 paise)
    const initialBalance = await getBalance(listenerUserId);
    assert.strictEqual(initialBalance, 500000);

    // Eligible earnings must be 0 because all funds are deposits, not earned revenue
    const eligibleEarnings = await getEligiblePeerEarnings(listenerUserId);
    assert.strictEqual(eligibleEarnings, 0, "Personal wallet deposits must NOT be counted as eligible earnings");

    // Run payout batch: listener should be skipped, no funds deducted
    const batchResult = await executeWeeklyPayoutBatch({
      batchReference: `TEST_DEPOSIT_SEPARATION_${Date.now()}`
    });

    const balanceAfterBatch = await getBalance(listenerUserId);
    assert.strictEqual(balanceAfterBatch, 500000, "Customer deposit balance must remain completely untouched");

    const listenerPayout = batchResult.data.peerListeners.payouts.find(p => p.userId === listenerUserId);
    assert.strictEqual(listenerPayout, undefined, "User with only personal deposits must not receive a payout record");
  });

  await t.test("3. Accurately calculates eligible earnings when user has both deposits and session earnings", async () => {
    const listenerUserId = "usr_listener_mixed_test";
    const profileId = "plp_mixed_test";

    await repositories.peerListenerProfiles.create({
      id: profileId,
      userId: listenerUserId,
      publicDisplayName: "Mixed Earnings Listener",
      verificationStatus: "approved"
    });

    // User deposited ₹1,000
    await credit(listenerUserId, 1000, "wallet_topup");
    // User earned ₹2,500 from peer sessions
    await credit(listenerUserId, 2500, "peer_session_earning", { referenceType: "PeerSession", referenceId: "ps_1" });

    // Total balance is ₹3,500 (350,000 paise)
    const totalBalance = await getBalance(listenerUserId);
    assert.strictEqual(totalBalance, 350000);

    // Eligible earnings must be exactly ₹2,500 (250,000 paise), excluding the ₹1,000 deposit
    const eligibleEarnings = await getEligiblePeerEarnings(listenerUserId);
    assert.strictEqual(eligibleEarnings, 250000, "Eligible earnings must equal earned revenue, excluding deposit");

    // Execute weekly payout
    const batchReference = `TEST_MIXED_BATCH_${Date.now()}`;
    const batchResult = await executeWeeklyPayoutBatch({ batchReference });

    const payout = batchResult.data.peerListeners.payouts.find(p => p.userId === listenerUserId);
    assert.ok(payout, "Payout record must be created for earned revenue");
    assert.strictEqual(payout.amountPaise, 250000, "Payout amount must equal exactly the earned ₹2,500");
    assert.strictEqual(payout.status, "processing", "Payout state must initially be 'processing'");

    // User balance after payout should retain the ₹1,000 deposit
    const remainingBalance = await getBalance(listenerUserId);
    assert.strictEqual(remainingBalance, 100000, "Remaining balance must retain customer's deposit of ₹1,000");
  });

  await t.test("4. Retries do not duplicate payouts (Batch idempotency and double-debit protection)", async () => {
    const listenerUserId = "usr_listener_retry_test";
    const profileId = "plp_retry_test";

    await repositories.peerListenerProfiles.create({
      id: profileId,
      userId: listenerUserId,
      publicDisplayName: "Retry Test Listener",
      verificationStatus: "approved"
    });

    await credit(listenerUserId, 1500, "peer_session_earning");

    const batchReference = `TEST_IDEMPOTENT_BATCH_${Date.now()}`;

    // First execution
    const firstRun = await executeWeeklyPayoutBatch({ batchReference });
    assert.strictEqual(firstRun.status, "success");
    assert.strictEqual(firstRun.isIdempotentReplay, undefined);

    const balanceAfterFirst = await getBalance(listenerUserId);
    assert.strictEqual(balanceAfterFirst, 0, "Balance must be debited once for the payout");

    // Second execution with identical batch reference (Simulated retry)
    const secondRun = await executeWeeklyPayoutBatch({ batchReference });
    assert.strictEqual(secondRun.status, "success");
    assert.strictEqual(secondRun.isIdempotentReplay, true, "Retry must be identified as idempotent replay");

    const balanceAfterSecond = await getBalance(listenerUserId);
    assert.strictEqual(balanceAfterSecond, 0, "Retry must NOT debit the wallet again");

    // Verify only 1 payout record exists in repository for this idempotency key
    const records = await repositories.payoutRecords.findByBatchId(firstRun.data.batch.id);
    assert.strictEqual(records.length, 1, "Exactly one payout record must exist");
  });

  await t.test("5. Provider reconciliation: Confirmed transfers settle permanently", async () => {
    const listenerUserId = "usr_listener_confirm_test";
    const profileId = "plp_confirm_test";

    await repositories.peerListenerProfiles.create({
      id: profileId,
      userId: listenerUserId,
      publicDisplayName: "Confirm Test Listener",
      verificationStatus: "approved"
    });

    await credit(listenerUserId, 3000, "peer_session_earning");

    const batch = await executeWeeklyPayoutBatch({ batchReference: `CONFIRM_BATCH_${Date.now()}` });
    const payout = batch.data.peerListeners.payouts.find(p => p.userId === listenerUserId);
    assert.ok(payout);

    // Reconcile as confirmed
    const recon = await reconcilePayoutTransfer({
      payoutId: payout.id,
      transferStatus: "confirmed",
      providerReference: "bank_tr_success_123"
    });

    assert.strictEqual(recon.status, "confirmed");
    assert.strictEqual(recon.record.status, "confirmed");
    assert.strictEqual(recon.record.providerTransferId, "bank_tr_success_123");
    assert.ok(recon.record.reconciledAt);

    // Balance remains debited (settled)
    const finalBalance = await getBalance(listenerUserId);
    assert.strictEqual(finalBalance, 0);

    // Retried reconciliation is idempotent
    const retryRecon = await reconcilePayoutTransfer({
      payoutId: payout.id,
      transferStatus: "confirmed"
    });
    assert.strictEqual(retryRecon.alreadySettled, true);
  });

  await t.test("6. Provider reconciliation: Failed transfers remain unpaid and refund balance", async () => {
    const listenerUserId = "usr_listener_fail_test";
    const profileId = "plp_fail_test";

    await repositories.peerListenerProfiles.create({
      id: profileId,
      userId: listenerUserId,
      publicDisplayName: "Fail Test Listener",
      verificationStatus: "approved"
    });

    await credit(listenerUserId, 4000, "peer_session_earning");

    const batch = await executeWeeklyPayoutBatch({ batchReference: `FAIL_BATCH_${Date.now()}` });
    const payout = batch.data.peerListeners.payouts.find(p => p.userId === listenerUserId);
    assert.ok(payout);

    // Balance is 0 immediately after payout execution
    assert.strictEqual(await getBalance(listenerUserId), 0);

    // Reconcile as failed (bank rejected)
    const recon = await reconcilePayoutTransfer({
      payoutId: payout.id,
      transferStatus: "failed",
      failureReason: "BENEFICIARY_ACCOUNT_INVALID"
    });

    // Check: Failed transfer remains unpaid
    assert.strictEqual(recon.status, "failed");
    assert.strictEqual(recon.record.status, "failed", "Payout record must remain in 'failed' status (unpaid)");
    assert.strictEqual(recon.record.failureReason, "BENEFICIARY_ACCOUNT_INVALID");
    assert.strictEqual(recon.refunded, true);

    // Check: Balances reconcile with confirmed transfers (failed amount refunded back to wallet)
    const reconciledBalance = await getBalance(listenerUserId);
    assert.strictEqual(reconciledBalance, 400000, "Wallet balance must be restored to full 400,000 paise");

    // Check: Ledger contains compensatory payout_reversal
    const wallet = await getWallet(listenerUserId);
    const ledger = await repositories.wallets.ledgerEntries(wallet.id);
    const reversalEntry = ledger.find(e => e.entryType === "payout_reversal" && e.direction === "credit");
    assert.ok(reversalEntry, "Ledger must contain a payout_reversal credit entry");
    assert.strictEqual(reversalEntry.amountPaise, 400000);
  });

  await t.test("7. Counsellor eligible mature earnings and 7-day maturity delay", async () => {
    const counsellor = (await repositories.counsellors.listAll())[0];
    assert.ok(counsellor, "Seeded counsellor must exist");
    const counsellorUserId = counsellor.userId;

    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    const preTestBalance = await getBalance(counsellorUserId);

    // 1 mature session earning (10 days ago, ₹3,000)
    await credit(counsellorUserId, 3000, "session_counsellor_pending_earning", { createdAt: tenDaysAgo });
    // 1 immature session earning (2 days ago, ₹2,000)
    await credit(counsellorUserId, 2000, "session_counsellor_pending_earning", { createdAt: twoDaysAgo });
    // Personal deposit (₹1,500)
    await credit(counsellorUserId, 1500, "topup");

    // Total balance: preTest + 6,500
    assert.strictEqual(await getBalance(counsellorUserId), preTestBalance + 650000);

    // Mature eligible earnings should be ONLY the ₹3,000 mature session earning
    const matureEarnings = await getEligibleCounsellorEarnings(counsellorUserId, now - 7 * 24 * 60 * 60 * 1000);
    assert.strictEqual(matureEarnings, 300000, "Only mature earnings (older than 7 days) are eligible");

    // Execute weekly payout
    const batch = await executeWeeklyPayoutBatch({
      batchReference: `CNS_BATCH_${Date.now()}`,
      cutoffTime: now - 7 * 24 * 60 * 60 * 1000
    });

    const cnsPayout = batch.data.counsellors.payouts.find(p => p.userId === counsellorUserId);
    assert.ok(cnsPayout);
    assert.strictEqual(cnsPayout.amountPaise, 300000);

    // Remaining balance must retain immature earning (₹2,000) + deposit (₹1,500) + preTestBalance
    const remainingBalance = await getBalance(counsellorUserId);
    assert.strictEqual(remainingBalance, preTestBalance + 350000);
  });
});

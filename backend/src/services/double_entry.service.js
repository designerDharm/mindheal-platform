import { createId } from "../utils/security.js";
import { repositories } from "../repositories/index.js";

/**
 * Creates and posts a balanced Double-Entry Journal Transaction.
 * MANDATORY INVARIANT: SUM(Debits) === SUM(Credits)
 */
export async function postJournalTransaction({
  journalType,
  businessReferenceType,
  businessReferenceId,
  idempotencyKey,
  description = "",
  entries = []
}) {
  if (!entries || !entries.length) {
    throw new Error("Journal transaction requires at least one debit and one credit entry.");
  }

  // Calculate sum of debits and credits in integer paise
  let totalDebitPaise = 0;
  let totalCreditPaise = 0;

  entries.forEach((entry, idx) => {
    const amount = Number(entry.amountPaise || 0);
    if (amount <= 0) {
      throw new Error(`Entry at index ${idx} must have a positive amountPaise.`);
    }
    if (entry.entrySide === "debit") {
      totalDebitPaise += amount;
    } else if (entry.entrySide === "credit") {
      totalCreditPaise += amount;
    } else {
      throw new Error(`Invalid entrySide '${entry.entrySide}' at index ${idx}. Must be 'debit' or 'credit'.`);
    }
  });

  // MANDATORY INVARIANT CHECK
  if (totalDebitPaise !== totalCreditPaise) {
    throw new Error(`UNBALANCED_JOURNAL_ERROR: Total Debits (${totalDebitPaise} paise) do not equal Total Credits (${totalCreditPaise} paise).`);
  }

  const journalId = createId("jnl");
  const journal = {
    id: journalId,
    journalType,
    businessReferenceType,
    businessReferenceId,
    idempotencyKey: idempotencyKey || createId("idem"),
    status: "posted",
    description,
    postedAt: new Date().toISOString(),
    entries: entries.map((entry, idx) => ({
      id: createId("ent"),
      journalTransactionId: journalId,
      accountKey: entry.accountKey,
      entrySide: entry.entrySide,
      amountPaise: Number(entry.amountPaise),
      sequenceNumber: idx + 1
    }))
  };

  return journal;
}

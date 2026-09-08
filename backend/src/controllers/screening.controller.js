import { repositories } from "../repositories/index.js";
import { getBalance, debit } from "../services/wallet.service.js";
import { postJournalTransaction } from "../services/double_entry.service.js";
import { badRequest, created, forbidden, ok, notFound } from "../utils/http.js";
import { createId } from "../utils/security.js";

const SCREENING_PRICES = {
  low_mood: 3,
  anxiety: 3,
  burnout: 2,
  counsellor_match: 0
};

export async function createScreening({ body, user }) {
  const { screeningType } = body;
  if (!screeningType || !Object.keys(SCREENING_PRICES).includes(screeningType)) {
    return badRequest("Invalid or missing screeningType. Must be 'low_mood', 'anxiety', 'burnout', or 'counsellor_match'.");
  }

  const cost = SCREENING_PRICES[screeningType];
  const screeningId = createId("scr");

  // If cost is positive, execute transaction-safe wallet debit and double entry journal
  if (cost > 0) {
    try {
      const balancePaise = await getBalance(user.id);
      const costPaise = cost * 100;
      if (balancePaise < costPaise) {
        return badRequest("Insufficient wallet balance for this screening.", { code: "INSUFFICIENT_BALANCE" });
      }

      await debit(user.id, cost, "screening_charge", {
        referenceType: "Screening",
        referenceId: screeningId
      });

      const journal = await postJournalTransaction({
        journalType: "SCREENING_PURCHASE",
        businessReferenceType: "Screening",
        businessReferenceId: screeningId,
        idempotencyKey: `screening_${screeningId}`,
        description: `Charge user for ${screeningType} self-reflection screening`,
        entries: [
          { accountKey: `USER_AVAILABLE_${user.id}`, entrySide: "debit", amountPaise: costPaise },
          { accountKey: "PLATFORM_REVENUE", entrySide: "credit", amountPaise: costPaise }
        ]
      });
      await repositories.journalTransactions.create(journal);
    } catch (err) {
      return badRequest(err.message);
    }
  }

  const screening = await repositories.screenings.create({
    id: screeningId,
    userId: user.id,
    screeningType,
    status: "started",
    score: null,
    responsesJson: {}
  });

  return created(screening);
}

export async function completeScreening({ params, body, user }) {
  const screening = await repositories.screenings.findById(params.id);
  if (!screening) return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: "Screening session not found." } } };

  if (screening.userId !== user.id && user.role !== "admin") {
    return forbidden("You are not authorized for this screening session.");
  }

  if (screening.status === "completed") {
    return badRequest("This screening session has already been completed.");
  }

  const updated = await repositories.screenings.update(params.id, {
    status: "completed",
    score: body.score !== undefined ? Number(body.score) : null,
    responsesJson: body.responses || {},
    completedAt: new Date().toISOString()
  });

  return ok(updated);
}

export async function listMyScreenings({ user }) {
  const list = await repositories.screenings.listForUser(user.id);
  return ok(list);
}

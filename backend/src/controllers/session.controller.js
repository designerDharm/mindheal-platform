import { repositories } from "../repositories/index.js";
import { calculateCommission, credit, debit, ledger } from "../services/wallet.service.js";
import { rtcService } from "../services/rtc.service.js";
import { badRequest, created, forbidden, ok } from "../utils/http.js";
import { createId } from "../utils/security.js";
import { requireFields } from "../utils/validation.js";

export async function bookSession({ body, user }) {
  const missing = requireFields(body, ["counsellorId", "sessionType", "scheduledAt", "durationMinutes", "amountInr"]);
  if (missing) return badRequest("Missing required booking fields.", missing);
  const validationError = validateBooking(body);
  if (validationError) return badRequest(validationError);

  const counsellor = await repositories.counsellors.findById(body.counsellorId);
  if (!counsellor) return badRequest("Counsellor not found.");

  const scheduledAt = new Date(body.scheduledAt);
  return await withSessionTransaction(async () => {
    const slot = await repositories.availabilitySlots.claimForBooking({
      counsellorId: counsellor.id,
      scheduledAt,
      sessionType: body.sessionType
    });
    if (!slot) return badRequest("Selected slot is no longer available.");

    const commission = calculateCommission(Number(body.amountInr));
    const session = {
      id: createId("ses"),
      userId: user.id,
      counsellorUserId: counsellor.userId,
      status: "pending",
      availabilitySlotId: slot.id,
      createdAt: new Date().toISOString(),
      ...body,
      ...commission
    };

    const createdSession = await repositories.sessions.create(session);
    try {
      await debit(user.id, Number(body.amountInr), "session_hold", { referenceType: "session", referenceId: session.id });
    } catch (error) {
      await repositories.sessions.update(session.id, {
        status: "payment_failed",
        paymentFailureReason: error.message
      });
      await repositories.availabilitySlots.releaseBooking(slot.id);
      return badRequest(error.message);
    }
    return created(createdSession);
  });
}

async function withSessionTransaction(callback) {
  if (repositories.transactions?.withTransaction) {
    return await repositories.transactions.withTransaction(callback);
  }
  return await callback();
}

function validateBooking(body) {
  if (!["chat", "audio", "video", "group"].includes(body.sessionType)) {
    return "Invalid session type.";
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return "Invalid scheduled time.";
  }

  const durationMinutes = Number(body.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 240) {
    return "Duration must be between 1 and 240 minutes.";
  }

  const amountInr = Number(body.amountInr);
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return "Invalid amount.";
  }

  return null;
}

export async function mySessions({ user }) {
  return ok(await repositories.sessions.listForUser(user));
}

export function acceptSession({ params, user }) {
  return updateStatus(params.id, "confirmed", user, "counsellor");
}

export async function declineSession({ params, body, user }) {
  return await withSessionTransaction(async () => {
    const auth = await getAuthorizedSession(params.id, user, "counsellor");
    if (auth.response) return auth.response;
    const { session } = auth;

    if (["cancelled", "declined"].includes(session.status)) return ok(session);

    const updatedSession = await repositories.sessions.update(session.id, {
      status: "declined",
      declineReason: body.reason || "Counsellor not available"
    });

    if (session.availabilitySlotId) {
      await repositories.availabilitySlots.releaseBooking(session.availabilitySlotId);
    }
    await refundSessionHold(session);

    return ok(updatedSession);
  });
}

export async function completeSession({ params, user }) {
  return await withSessionTransaction(async () => {
    const auth = await getAuthorizedSession(params.id, user, "counsellor");
    if (auth.response) return auth.response;
    const { session } = auth;

    if (session.status === "completed") {
      await settleSessionHold(session);
      return ok(session);
    }
    if (["cancelled", "declined", "payment_failed"].includes(session.status)) {
      return badRequest("Only active sessions can be completed.");
    }
    if (session.status !== "confirmed") {
      return badRequest("Session must be confirmed before completion.");
    }

    const settlement = await settleSessionHold(session);
    if (!settlement.holdAvailable) return badRequest("Session hold is not available for settlement.");
    return ok(await repositories.sessions.update(session.id, { status: "completed" }));
  });
}

export async function cancelSession({ params, user }) {
  return await withSessionTransaction(async () => {
    const auth = await getAuthorizedSession(params.id, user, "user");
    if (auth.response) return auth.response;
    const { session } = auth;

    if (session.status === "cancelled") return ok(session);
    if (session.status === "completed") return badRequest("Completed sessions cannot be cancelled.");

    const updatedSession = await repositories.sessions.update(session.id, { status: "cancelled" });
    if (session.availabilitySlotId) {
      await repositories.availabilitySlots.releaseBooking(session.availabilitySlotId);
    }
    await refundSessionHold(session);

    return ok(updatedSession);
  });
}

export async function autoCleanStalePendingBookings() {
  try {
    const allSessions = await repositories.sessions.listForUser({ role: "admin" });
    const pendingSessions = (allSessions || []).filter((s) => s.status === "pending");
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const session of pendingSessions) {
      const createdAt = new Date(session.createdAt || 0).getTime();
      if (createdAt < cutoffTime) {
        console.warn(`[AutoRefund] Cleaning stale pending session ${session.id} (older than 24h)`);
        await repositories.sessions.update(session.id, {
          status: "cancelled",
          declineReason: "System auto-cancelled: Counsellor response timeout (24 hours)"
        });
        if (session.availabilitySlotId) {
          await repositories.availabilitySlots.releaseBooking(session.availabilitySlotId);
        }
        await refundSessionHold(session);
      }
    }
  } catch (err) {
    console.error("[AutoRefund] Error cleaning stale pending bookings:", err);
  }
}

async function updateStatus(id, status, user, actor, extra = {}) {
  const auth = await getAuthorizedSession(id, user, actor);
  if (auth.response) return auth.response;
  return ok(await repositories.sessions.update(id, { status, ...extra }));
}

async function getAuthorizedSession(id, user, actor) {
  const session = await repositories.sessions.findById(id);
  if (!session) return { response: badRequest("Session not found.") };
  const counsellor = await repositories.counsellors.findById(session.counsellorId);
  const counsellorUserId = session.counsellorUserId || counsellor?.userId;

  if (user.role !== "admin") {
    const isAllowedCounsellorAction = actor === "counsellor" && counsellorUserId === user.id;
    const isAllowedUserAction = actor === "user" && session.userId === user.id;
    if (!isAllowedCounsellorAction && !isAllowedUserAction) {
      return { response: forbidden("Not authorized for this session.") };
    }
  }

  return { session, counsellor, counsellorUserId };
}

async function refundSessionHold(session) {
  const entries = await ledger(session.userId);
  const isSessionReference = (entry) => entry.referenceType === "session" && entry.referenceId === session.id;
  const heldPaise = entries
    .filter((entry) => entry.entryType === "session_hold" && entry.direction === "debit" && isSessionReference(entry))
    .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
  const refundedPaise = entries
    .filter((entry) => entry.entryType === "session_hold_refund" && entry.direction === "credit" && isSessionReference(entry))
    .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
  const refundPaise = heldPaise - refundedPaise;

  if (refundPaise > 0) {
    await credit(session.userId, refundPaise / 100, "session_hold_refund", {
      referenceType: "session",
      referenceId: session.id,
      notes: "Automatic refund after session cancellation."
    });
  }
}

async function settleSessionHold(session) {
  const userEntries = await ledger(session.userId);
  const isSessionReference = (entry) => entry.referenceType === "session" && entry.referenceId === session.id;
  const heldPaise = userEntries
    .filter((entry) => entry.entryType === "session_hold" && entry.direction === "debit" && isSessionReference(entry))
    .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
  const refundedPaise = userEntries
    .filter((entry) => entry.entryType === "session_hold_refund" && entry.direction === "credit" && isSessionReference(entry))
    .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);

  if (heldPaise - refundedPaise <= 0) {
    return { holdAvailable: false };
  }

  const counsellorEntries = await ledger(session.counsellorUserId);
  const hasCounsellorPayout = counsellorEntries.some((entry) =>
    entry.entryType === "session_counsellor_payout" &&
    entry.direction === "credit" &&
    isSessionReference(entry)
  );
  if (!hasCounsellorPayout && Number(session.counsellorEarningInr || 0) > 0) {
    await credit(session.counsellorUserId, Number(session.counsellorEarningInr), "session_counsellor_payout", {
      referenceType: "session",
      referenceId: session.id,
      notes: "Counsellor earning settled after session completion."
    });
  }

  const platformEntries = await ledger("platform");
  const hasPlatformCommission = platformEntries.some((entry) =>
    entry.entryType === "session_platform_commission" &&
    entry.direction === "credit" &&
    isSessionReference(entry)
  );
  if (!hasPlatformCommission && Number(session.platformCommissionInr || 0) > 0) {
    await credit("platform", Number(session.platformCommissionInr), "session_platform_commission", {
      referenceType: "session",
      referenceId: session.id,
      notes: "Platform commission settled after session completion."
    });
  }

  return { holdAvailable: true };
}

export async function generateRtcToken({ params, user }) {
  const session = await repositories.sessions.findById(params.id);
  if (!session) return badRequest("Session not found.");
  const counsellor = await repositories.counsellors.findById(session.counsellorId);
  const counsellorUserId = session.counsellorUserId || counsellor?.userId;
  
  if (session.userId !== user.id && counsellorUserId !== user.id && user.role !== "admin") {
     return forbidden("Not authorized for this session.");
  }
  
  const rtcData = rtcService.generateToken(params.id, user.id);
  return ok(rtcData);
}

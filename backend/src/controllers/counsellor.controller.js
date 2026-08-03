import { repositories } from "../repositories/index.js";
import { badRequest, ok } from "../utils/http.js";
import { createId } from "../utils/security.js";

export async function listCounsellors({ url }) {
  const specialty = url.searchParams.get("specialty");
  const language = url.searchParams.get("language");
  const rows = await repositories.counsellors.listApproved({ specialty, language });
  return ok(rows, { count: rows.length });
}

export async function getCounsellor({ params }) {
  return ok(await repositories.counsellors.findById(params.id));
}

export async function getSlots({ params }) {
  const counsellor = await repositories.counsellors.findById(params.id);
  if (!counsellor) return badRequest("Counsellor not found.");
  return ok(await repositories.availabilitySlots.listForCounsellor(params.id));
}

export async function getMySlots({ user }) {
  const counsellor = await repositories.counsellors.findByUserId(user.id);
  if (!counsellor) return badRequest("Counsellor profile not found.");
  return ok(await repositories.availabilitySlots.listForCounsellor(counsellor.id));
}

export async function saveMySlots({ body, user }) {
  const counsellor = await repositories.counsellors.findByUserId(user.id);
  if (!counsellor) return badRequest("Counsellor profile not found.");

  const slots = Array.isArray(body.slots) ? body.slots : [];
  if (!slots.length) return badRequest("At least one availability slot is required.");

  const normalized = [];
  const seen = new Set();
  for (const slot of slots) {
    const date = String(slot.date || "").trim();
    const startTime = String(slot.startTime || "").trim();
    const endTime = String(slot.endTime || "").trim();
    const sessionType = slot.sessionType || "video";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("Slot date must use YYYY-MM-DD.");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return badRequest("Slot times must use HH:mm.");
    if (startTime >= endTime) return badRequest("Slot end time must be after start time.");
    if (!["chat", "audio", "video", "group"].includes(sessionType)) return badRequest("Invalid session type.");

    const key = `${date}-${startTime}-${endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: slot.id || createId("slot"),
      date,
      startTime,
      endTime,
      sessionType,
      isBooked: false
    });
  }

  return ok(await repositories.availabilitySlots.replaceForCounsellor(counsellor.id, normalized));
}

export async function mapListings() {
  return ok(await repositories.counsellors.mapListings());
}

export async function updateStatus({ body, user }) {
  const status = body.status || "online";
  const counsellor = user.role === "admin" && body.counsellorId
    ? await repositories.counsellors.updateStatus(body.counsellorId, status)
    : await repositories.counsellors.updateStatusForUser(user.id, status);

  if (!counsellor) return badRequest("Counsellor profile not found.");
  return ok(counsellor);
}

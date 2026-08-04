import { query, withTransaction } from "../../data/db.js";
import { createId } from "../../utils/security.js";

function normalizeConfigKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function compactPatch(patch, fields) {
  const updates = [];
  const values = [];
  let index = 1;
  for (const [jsKey, dbKey] of Object.entries(fields)) {
    if (patch[jsKey] !== undefined) {
      updates.push(`${dbKey} = $${index++}`);
      values.push(patch[jsKey]);
    }
  }
  return { updates, values, index };
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    firebase_uid: row.firebase_uid,
    firebaseUid: row.firebase_uid,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    mobile: row.mobile,
    languageCode: row.language_code,
    avatarUrl: row.avatar_url,
    passwordHash: row.password_hash,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : null,
    date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : null,
    isGuardianConsentVerified: row.is_guardian_consent_verified || false,
    guardianEmail: row.guardian_email || null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCounsellor(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    accountType: row.account_type,
    displayName: row.display_name,
    title: row.title,
    bio: row.bio,
    specializations: row.specializations || [],
    languagesSpoken: row.languages_spoken || [],
    experienceYears: row.experience_years,
    licenseNumber: row.license_number,
    hasPrescriptionAuth: row.has_prescription_auth,
    hourlyRateInr: Number(row.hourly_rate_inr || 0),
    perMinuteRateInr: row.per_minute_rate_inr === null ? null : Number(row.per_minute_rate_inr),
    chatEnabled: row.chat_enabled,
    audioEnabled: row.audio_enabled,
    videoEnabled: row.video_enabled,
    showOnMap: row.show_on_map,
    locationLat: row.location_lat === null ? null : Number(row.location_lat),
    locationLng: row.location_lng === null ? null : Number(row.location_lng),
    address: row.address,
    ratingAvg: Number(row.rating_avg || 0),
    ratingCount: row.rating_count,
    verificationStatus: row.verification_status,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    licenseNumber: row.license_number,
    specializations: row.specializations,
    status: row.status,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMood(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    score: row.score,
    note: row.note,
    createdAt: row.created_at
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    counsellorId: row.counsellor_id,
    counsellorUserId: row.counsellor_user_id,
    sessionType: row.session_type,
    serviceType: row.service_type,
    status: row.status,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes,
    amountInr: Number(row.amount_paise || 0) / 100,
    amountPaise: Number(row.amount_paise || 0),
    platformCommissionInr: Number(row.platform_commission_paise || 0) / 100,
    counsellorEarningInr: Number(row.counsellor_earning_paise || 0) / 100,
    availabilitySlotId: row.availability_slot_id,
    agoraChannelId: row.agora_channel_id,
    declineReason: row.decline_reason,
    paymentFailureReason: row.payment_failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAvailabilitySlot(row) {
  if (!row) return null;
  const date = row.slot_date instanceof Date
    ? `${row.slot_date.getFullYear()}-${String(row.slot_date.getMonth() + 1).padStart(2, '0')}-${String(row.slot_date.getDate()).padStart(2, '0')}`
    : row.slot_date;
  return {
    id: row.id,
    counsellorId: row.counsellor_id,
    date,
    startTime: row.start_time,
    endTime: row.end_time,
    sessionType: row.session_type,
    isBooked: row.is_booked,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    reportType: row.report_type,
    inputText: row.input_text,
    inputMediaUrl: row.input_media_url,
    voiceTranscript: row.voice_transcript,
    aiSummary: row.ai_summary,
    aiFullReport: row.ai_full_report,
    pdfUrl: row.pdf_url,
    isPdfUnlocked: row.is_pdf_unlocked,
    pdfUnlockFeeInr: Number(row.pdf_unlock_fee_paise || 0) / 100,
    expertReviewSessionId: row.expert_review_session_id,
    aiModelUsed: row.ai_model_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWallet(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    walletId: row.wallet_id,
    direction: row.direction,
    amountPaise: Number(row.amount_paise || 0),
    entryType: row.entry_type,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    createdAt: row.created_at
  };
}

function mapPaymentOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    gateway: row.gateway,
    gatewayOrderId: row.gateway_order_id,
    gatewayPaymentId: row.gateway_payment_id,
    userId: row.user_id,
    amountPaise: Number(row.amount_paise || 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at
  };
}

function mapApiConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceName: row.service_name,
    aliases: row.aliases || [],
    provider: row.provider,
    modelName: row.model_name,
    apiKeyEncrypted: row.api_key_encrypted,
    isActive: row.is_active,
    systemPrompt: row.system_prompt,
    updatedAt: row.updated_at
  };
}

function mapService(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    icon: row.icon,
    isActive: row.is_active,
    isFree: row.is_free,
    priceInr: Number(row.price_paise || 0) / 100,
    pricePaise: Number(row.price_paise || 0),
    apiConfigId: row.api_config_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.admin_id,
    action: row.action,
    entity: row.entity,
    entityType: row.entity_type || row.entity,
    entityId: row.entity_id,
    details: row.details,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at
  };
}

function mapCrisisEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    riskLevel: row.risk_level,
    detectedTextHash: row.detected_text_hash,
    actionTaken: row.action_taken,
    createdAt: row.created_at
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

export const postgresRepositories = {
  transactions: {
    withTransaction
  },

  users: {
    async list() {
      const res = await query("SELECT * FROM users ORDER BY created_at DESC");
      return res.rows.map(mapUser);
    },
    async findById(id) {
      const res = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
      return mapUser(res.rows[0]);
    },
    async findByEmailAndRole(email, role) {
      const res = await query("SELECT * FROM users WHERE email = $1 AND role = $2 LIMIT 1", [email, role]);
      return mapUser(res.rows[0]);
    },
    async findByMobileAndRole(mobile, role) {
      const cleanDigits = String(mobile).replace(/\D/g, "").slice(-10);
      const res = await query(
        `SELECT * FROM users WHERE RIGHT(REGEXP_REPLACE(mobile, '\\D', '', 'g'), 10) = $1 AND role = $2 LIMIT 1`,
        [cleanDigits, role]
      );
      return mapUser(res.rows[0]);
    },
    async create(user) {
      const res = await query(
        `INSERT INTO users (id, firebase_uid, role, full_name, email, mobile, password_hash, language_code, avatar_url, is_active, date_of_birth, guardian_email, is_guardian_consent_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          user.id,
          user.firebase_uid || user.firebaseUid || null,
          user.role,
          user.fullName,
          user.email,
          user.mobile || null,
          user.passwordHash || "",
          user.languageCode || "en",
          user.avatarUrl || null,
          user.isActive !== false,
          user.dateOfBirth || user.date_of_birth || null,
          user.guardianEmail || user.guardian_email || null,
          user.isGuardianConsentVerified || false
        ]
      );
      return mapUser(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        fullName: "full_name",
        email: "email",
        mobile: "mobile",
        languageCode: "language_code",
        avatarUrl: "avatar_url",
        passwordHash: "password_hash",
        dateOfBirth: "date_of_birth",
        date_of_birth: "date_of_birth",
        guardianEmail: "guardian_email",
        guardian_email: "guardian_email",
        isGuardianConsentVerified: "is_guardian_consent_verified",
        is_guardian_consent_verified: "is_guardian_consent_verified",
        isActive: "is_active"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapUser(res.rows[0]);
    },
    async updatePasswordHash(id, passwordHash) {
      const res = await query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [passwordHash, id]
      );
      return mapUser(res.rows[0]);
    }
  },

  counsellors: {
    async listApproved({ specialty, language } = {}) {
      const res = await query("SELECT * FROM counsellors WHERE verification_status = 'approved' ORDER BY rating_avg DESC, display_name ASC");
      return res.rows.map(mapCounsellor).filter((item) => {
        const matchesSpecialty = !specialty || item.specializations.some((value) => value.toLowerCase().includes(specialty.toLowerCase()));
        const matchesLanguage = !language || item.languagesSpoken.includes(language);
        return matchesSpecialty && matchesLanguage;
      });
    },
    async listAll() {
      const res = await query("SELECT * FROM counsellors ORDER BY created_at DESC");
      return res.rows.map(mapCounsellor);
    },
    async findById(id) {
      const res = await query("SELECT * FROM counsellors WHERE id = $1 LIMIT 1", [id]);
      return mapCounsellor(res.rows[0]);
    },
    async findByUserId(userId) {
      const res = await query("SELECT * FROM counsellors WHERE user_id = $1 LIMIT 1", [userId]);
      return mapCounsellor(res.rows[0]);
    },
    async mapListings() {
      const res = await query("SELECT * FROM counsellors WHERE show_on_map = TRUE AND verification_status = 'approved' ORDER BY rating_avg DESC");
      return res.rows.map(mapCounsellor);
    },
    async updateStatus(id, status) {
      const res = await query("UPDATE counsellors SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [status, id]);
      return mapCounsellor(res.rows[0]);
    },
    async updateStatusForUser(userId, status) {
      const res = await query("UPDATE counsellors SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *", [status, userId]);
      return mapCounsellor(res.rows[0]);
    }
  },

  counsellorApplications: {
    async list() {
      const res = await query("SELECT * FROM counsellor_applications ORDER BY created_at DESC");
      return res.rows.map(mapApplication);
    },
    async create(application) {
      const res = await query(
        `INSERT INTO counsellor_applications (id, user_id, full_name, email, license_number, specializations, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [application.id, application.userId, application.fullName, application.email, application.licenseNumber, application.specializations, application.status || "pending", application.createdAt || new Date()]
      );
      return mapApplication(res.rows[0]);
    },
    async updateVerification(id, action, reason = "") {
      const status = action === "approve" ? "approved" : "rejected";
      const res = await query(
        "UPDATE counsellor_applications SET status = $1, review_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [status, reason, id]
      );
      return mapApplication(res.rows[0]);
    }
  },

  moodLogs: {
    async create(mood) {
      const res = await query(
        "INSERT INTO mood_logs (id, user_id, score, note, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [mood.id, mood.userId, mood.score || null, mood.note || "", mood.createdAt || new Date()]
      );
      return mapMood(res.rows[0]);
    },
    async listByUser(userId) {
      const res = await query("SELECT * FROM mood_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [userId]);
      return res.rows.map(mapMood);
    }
  },

  sessions: {
    async create(session) {
      const amountPaise = Math.round(Number(session.amountInr || 0) * 100);
      const res = await query(
        `INSERT INTO sessions (id, user_id, counsellor_id, counsellor_user_id, session_type, service_type, status, scheduled_at, duration_minutes, amount_paise, platform_commission_paise, counsellor_earning_paise, availability_slot_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [session.id, session.userId, session.counsellorId, session.counsellorUserId, session.sessionType, session.serviceType || session.sessionType, session.status, session.scheduledAt, session.durationMinutes, amountPaise, Math.round(Number(session.platformCommissionInr || 0) * 100), Math.round(Number(session.counsellorEarningInr || 0) * 100), session.availabilitySlotId || null, session.createdAt || new Date()]
      );
      return mapSession(res.rows[0]);
    },
    async listForUser(user) {
      const params = [];
      let where = "";
      if (user.role === "counsellor") {
        params.push(user.id);
        where = "WHERE counsellor_user_id = $1";
      } else if (user.role !== "admin") {
        params.push(user.id);
        where = "WHERE user_id = $1";
      }
      const res = await query(`SELECT * FROM sessions ${where} ORDER BY scheduled_at DESC`, params);
      return res.rows.map(mapSession);
    },
    async findById(id) {
      const res = await query("SELECT * FROM sessions WHERE id = $1 LIMIT 1", [id]);
      return mapSession(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        status: "status",
        declineReason: "decline_reason",
        paymentFailureReason: "payment_failure_reason",
        availabilitySlotId: "availability_slot_id",
        actualDurationMinutes: "actual_duration_minutes",
        agoraChannelId: "agora_channel_id"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE sessions SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapSession(res.rows[0]);
    }
  },

  availabilitySlots: {
    async listForCounsellor(counsellorId) {
      const res = await query(
        "SELECT * FROM availability_slots WHERE counsellor_id = $1 ORDER BY slot_date ASC, start_time ASC",
        [counsellorId]
      );
      return res.rows.map(mapAvailabilitySlot);
    },
    async replaceForCounsellor(counsellorId, slots = []) {
      await query("DELETE FROM availability_slots WHERE counsellor_id = $1 AND is_booked = FALSE", [counsellorId]);
      for (const slot of slots) {
        await query(
          `INSERT INTO availability_slots (id, counsellor_id, slot_date, start_time, end_time, session_type, is_booked, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [slot.id || createId("slot"), counsellorId, slot.date, slot.startTime, slot.endTime, slot.sessionType || "video", Boolean(slot.isBooked), slot.createdAt || new Date()]
        );
      }
      return await this.listForCounsellor(counsellorId);
    },
    async claimForBooking({ counsellorId, scheduledAt, sessionType }) {
      const date = scheduledAt.toISOString().slice(0, 10);
      const startTime = scheduledAt.toISOString().slice(11, 16);
      const res = await query(
        `UPDATE availability_slots
         SET is_booked = TRUE, updated_at = NOW()
         WHERE counsellor_id = $1
           AND slot_date = $2
           AND start_time = $3
           AND session_type = $4
           AND is_booked = FALSE
         RETURNING *`,
        [counsellorId, date, startTime, sessionType]
      );
      return mapAvailabilitySlot(res.rows[0]);
    },
    async releaseBooking(id) {
      const res = await query(
        "UPDATE availability_slots SET is_booked = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      return mapAvailabilitySlot(res.rows[0]);
    }
  },

  reports: {
    async create(report) {
      const res = await query(
        `INSERT INTO analysis_reports (id, user_id, report_type, input_text, input_media_url, voice_transcript, ai_summary, ai_full_report, pdf_url, is_pdf_unlocked, pdf_unlock_fee_paise, ai_model_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [report.id, report.userId, report.reportType, report.inputText || null, report.inputMediaUrl || null, report.voiceTranscript || null, report.aiSummary, report.aiFullReport || null, report.pdfUrl || null, Boolean(report.isPdfUnlocked), Math.round(Number(report.pdfUnlockFeeInr || 0) * 100), report.aiModelUsed || null, report.createdAt || new Date()]
      );
      return mapReport(res.rows[0]);
    },
    async listForUser(user) {
      const params = user.role === "admin" ? [] : [user.id];
      const where = user.role === "admin" ? "" : "WHERE user_id = $1";
      const res = await query(`SELECT * FROM analysis_reports ${where} ORDER BY created_at DESC`, params);
      return res.rows.map(mapReport);
    },
    async findById(id) {
      const res = await query("SELECT * FROM analysis_reports WHERE id = $1 LIMIT 1", [id]);
      return mapReport(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        aiFullReport: "ai_full_report",
        pdfUrl: "pdf_url",
        isPdfUnlocked: "is_pdf_unlocked"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE analysis_reports SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapReport(res.rows[0]);
    }
  },

  contacts: {
    async create(contact) {
      const res = await query(
        "INSERT INTO contacts (id, full_name, email, phone, message, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [contact.id, contact.fullName || contact.name, contact.email, contact.phone || null, contact.message, contact.status || "new", contact.createdAt || new Date()]
      );
      return mapContact(res.rows[0]);
    },
    async list({ status } = {}) {
      const values = [];
      let where = "";
      if (status) {
        values.push(status);
        where = "WHERE status = $1";
      }
      const res = await query(`SELECT * FROM contacts ${where} ORDER BY created_at DESC`, values);
      return res.rows.map(mapContact);
    },
    async updateStatus(id, status) {
      const res = await query(
        "UPDATE contacts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return mapContact(res.rows[0]);
    }
  },

  wallets: {
    async findByOwner(ownerId) {
      const res = await query("SELECT * FROM wallets WHERE owner_id = $1 LIMIT 1", [ownerId]);
      return mapWallet(res.rows[0]);
    },
    async createForOwner(ownerType, ownerId) {
      const id = createId("wal");
      const res = await query(
        "INSERT INTO wallets (id, owner_type, owner_id, currency) VALUES ($1, $2, $3, 'INR') RETURNING *",
        [id, ownerType, ownerId]
      );
      return mapWallet(res.rows[0]);
    },
    async ledgerEntries(walletId) {
      const res = await query("SELECT * FROM ledger_entries WHERE wallet_id = $1 ORDER BY created_at DESC", [walletId]);
      return res.rows.map(mapLedger);
    },
    async createLedgerEntry(entry) {
      const res = await query(
        `INSERT INTO ledger_entries (id, wallet_id, direction, amount_paise, entry_type, reference_type, reference_id, idempotency_key, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [entry.id, entry.walletId, entry.direction, entry.amountPaise, entry.entryType, entry.referenceType || null, entry.referenceId || null, entry.idempotencyKey || null, entry.notes || null, entry.createdAt || new Date()]
      );
      return mapLedger(res.rows[0]);
    },
    async allLedgerEntries() {
      const res = await query("SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 500");
      return res.rows.map(mapLedger);
    }
  },

  paymentOrders: {
    async create(order) {
      const res = await query(
        `INSERT INTO payment_orders (id, gateway, gateway_order_id, gateway_payment_id, user_id, amount_paise, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [order.id, order.gateway, order.gatewayOrderId, order.gatewayPaymentId || null, order.userId, order.amountPaise, order.status, order.createdAt || new Date()]
      );
      return mapPaymentOrder(res.rows[0]);
    },
    async find(idOrGatewayOrderId) {
      const res = await query("SELECT * FROM payment_orders WHERE id = $1 OR gateway_order_id = $1 LIMIT 1", [idOrGatewayOrderId]);
      return mapPaymentOrder(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        status: "status",
        gatewayPaymentId: "gateway_payment_id",
        paidAt: "paid_at"
      });
      if (!updates.length) return await this.find(id);
      values.push(id);
      const res = await query(`UPDATE payment_orders SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapPaymentOrder(res.rows[0]);
    }
  },

  apiConfigurations: {
    async list() {
      const res = await query("SELECT * FROM api_configurations ORDER BY service_name ASC");
      return res.rows.map(mapApiConfig);
    },
    async find(serviceNameOrId) {
      const lookup = normalizeConfigKey(serviceNameOrId);
      const res = await query("SELECT * FROM api_configurations");
      const row = res.rows.find((item) => {
        const aliases = item.aliases || [];
        return item.id === serviceNameOrId ||
          normalizeConfigKey(item.service_name) === lookup ||
          aliases.some((alias) => normalizeConfigKey(alias) === lookup);
      });
      return mapApiConfig(row);
    },
    async upsert(serviceName, patch) {
      const existing = await this.find(serviceName);
      if (!existing) {
        const res = await query(
          `INSERT INTO api_configurations (id, service_name, aliases, provider, model_name, api_key_encrypted, is_active, system_prompt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [createId("cfg"), serviceName, patch.aliases || [], patch.provider || "gemini", patch.modelName || "", patch.apiKeyEncrypted || "", patch.isActive !== undefined ? patch.isActive : false, patch.systemPrompt || ""]
        );
        return mapApiConfig(res.rows[0]);
      }
      const { updates, values, index } = compactPatch(patch, {
        provider: "provider",
        modelName: "model_name",
        apiKeyEncrypted: "api_key_encrypted",
        isActive: "is_active",
        systemPrompt: "system_prompt",
        aliases: "aliases"
      });
      if (!updates.length) return existing;
      values.push(existing.id);
      const res = await query(`UPDATE api_configurations SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapApiConfig(res.rows[0]);
    }
  },

  servicesCatalog: {
    async list() {
      const checkRes = await query("SELECT id FROM services_catalog WHERE id IN ('svc_express_half_hour', 'svc_express_hourly')");
      if (checkRes.rows.length < 2) {
        await query(`
          INSERT INTO services_catalog (id, name, category, is_active, is_free, price_paise)
          VALUES 
            ('svc_express_half_hour', 'Express Yourself (Half Hour)', 'Community', TRUE, FALSE, 20000),
            ('svc_express_hourly', 'Express Yourself (Hourly)', 'Community', TRUE, FALSE, 40000)
          ON CONFLICT (id) DO NOTHING
        `);
      }
      const res = await query("SELECT * FROM services_catalog ORDER BY name ASC");
      return res.rows.map(mapService);
    },
    async update(id, patch) {
      const normalizedPatch = { ...patch };
      if (patch.priceInr !== undefined && patch.pricePaise === undefined) normalizedPatch.pricePaise = Math.round(Number(patch.priceInr || 0) * 100);
      const { updates, values, index } = compactPatch(normalizedPatch, {
        name: "name",
        description: "description",
        category: "category",
        icon: "icon",
        isActive: "is_active",
        isFree: "is_free",
        pricePaise: "price_paise",
        apiConfigId: "api_config_id"
      });
      if (!updates.length) {
        const res = await query("SELECT * FROM services_catalog WHERE id = $1 LIMIT 1", [id]);
        return mapService(res.rows[0]);
      }
      values.push(id);
      const res = await query(`UPDATE services_catalog SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapService(res.rows[0]);
    }
  },

  auditLogs: {
    async create(entry) {
      const res = await query(
        `INSERT INTO audit_logs (id, user_id, action, entity, entity_type, entity_id, details, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [entry.id || createId("aud"), entry.userId || entry.adminId || null, entry.action, entry.entity || entry.entityType || null, entry.entityType || entry.entity || null, entry.entityId || null, entry.details || null, entry.oldValue || null, entry.newValue || null, entry.createdAt || new Date()]
      );
      return mapAudit(res.rows[0]);
    },
    async list(limit = 50, offset = 0) {
      const res = await query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
      return res.rows.map(mapAudit);
    }
  },

  crisisEvents: {
    async create(entry) {
      const res = await query(
        `INSERT INTO crisis_events (id, user_id, source, risk_level, detected_text_hash, action_taken, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          entry.id || createId("cri"),
          entry.userId || null,
          entry.source,
          entry.riskLevel,
          entry.detectedTextHash || null,
          entry.actionTaken,
          entry.createdAt || new Date()
        ]
      );
      return mapCrisisEvent(res.rows[0]);
    },
    async list(limit = 50, offset = 0) {
      const res = await query("SELECT * FROM crisis_events ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
      return res.rows.map(mapCrisisEvent);
    }
  },

  notifications: {
    async create(payload) {
      const res = await query(
        "INSERT INTO notifications (id, user_id, role, title, message, type, read, created_at) VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW()) RETURNING *",
        [createId("ntf"), payload.userId, payload.role, payload.title, payload.message, payload.type || "info"]
      );
      return mapNotification(res.rows[0]);
    },
    async listForUser(userId) {
      const res = await query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId]);
      return res.rows.map(mapNotification);
    },
    async markAsRead(id, userId) {
      const res = await query("UPDATE notifications SET read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *", [id, userId]);
      return mapNotification(res.rows[0]);
    }
  },

  analytics: {
    async summary() {
      const res = await query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS users,
          (SELECT COUNT(*)::int FROM counsellors) AS counsellors,
          (SELECT COUNT(*)::int FROM counsellor_applications WHERE status = 'pending') AS pending_applications,
          (SELECT COUNT(*)::int FROM sessions) AS sessions,
          (SELECT COUNT(*)::int FROM analysis_reports) AS reports,
          (SELECT COUNT(*)::int FROM ledger_entries) AS ledger_entries
      `);
      return {
        users: res.rows[0].users,
        counsellors: res.rows[0].counsellors,
        pendingApplications: res.rows[0].pending_applications,
        sessions: res.rows[0].sessions,
        reports: res.rows[0].reports,
        ledgerEntries: res.rows[0].ledger_entries
      };
    }
  }
};

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
    profileCompletedAt: row.profile_completed_at || null,
    onboardingStatus: row.onboarding_status || 'COMPLETED',
    emailVerifiedAt: row.email_verified_at || null,
    guardianConsentStatus: row.guardian_consent_status || 'APPROVED',
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
    quoteId: row.quote_id || null,
    peerSessionRequestId: row.peer_session_request_id || null,
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

function mapAiService(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceKey: row.service_key,
    displayName: row.display_name,
    category: row.category,
    description: row.description,
    serviceType: row.service_type,
    userFacing: row.user_facing,
    minimumAge: row.minimum_age,
    enabled: row.enabled,
    rolloutPercentage: row.rollout_percentage,
    primaryProvider: row.primary_provider,
    primaryModel: row.primary_model,
    fallbackProvider: row.fallback_provider,
    fallbackModel: row.fallback_model,
    creditCost: row.credit_cost,
    freeAllowance: row.free_allowance,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAiInstructionFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceId: row.service_id,
    originalFilename: row.original_filename,
    fileRole: row.file_role,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    checksumSha256: row.checksum_sha256,
    extractedText: row.extracted_text,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapAiInstructionBundle(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceId: row.service_id,
    version: row.version,
    name: row.name,
    description: row.description,
    status: row.status,
    systemInstructionText: row.system_instruction_text,
    prohibitedRulesText: row.prohibited_rules_text,
    parametersJson: row.parameters_json,
    createdBy: row.created_by,
    createdAt: row.created_at,
    activatedAt: row.activated_at
  };
}

function mapScreening(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    screeningType: row.screening_type,
    status: row.status,
    score: row.score,
    responsesJson: row.responses_json,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function mapPeerChatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    peerSessionId: row.peer_session_id,
    senderId: row.sender_id,
    messageText: row.message_text,
    createdAt: row.created_at
  };
}

function mapPeerListenerProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    publicDisplayName: row.public_display_name,
    publicAvatarAssetId: row.public_avatar_asset_id,
    ageBand: row.age_band,
    genderDisplay: row.gender_display,
    cityDisplay: row.city_display,
    shortBio: row.short_bio,
    languages: row.languages || [],
    conversationInterests: row.conversation_interests || [],
    excludedTopics: row.excluded_topics || [],
    verificationStatus: row.verification_status,
    moderationStatus: row.moderation_status,
    acceptingRequests: row.accepting_requests || false,
    voiceEnabled: row.voice_enabled || false,
    videoEnabled: row.video_enabled || false,
    fileSharingEnabled: row.file_sharing_enabled || false,
    averageRating: Number(row.average_rating || 0),
    ratingCount: Number(row.rating_count || 0),
    completedSessionCount: Number(row.completed_session_count || 0),
    completionRate: Number(row.completion_rate || 0),
    responseRate: Number(row.response_rate || 0),
    reliabilityScore: Number(row.reliability_score || 0),
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPeerListenerVerification(row) {
  if (!row) return null;
  return {
    id: row.id,
    listenerProfileId: row.listener_profile_id,
    identityVerificationStatus: row.identity_verification_status || "pending",
    ageVerificationStatus: row.age_verification_status || "pending",
    selfieLivenessStatus: row.selfie_liveness_status || "pending",
    panVerificationStatus: row.pan_verification_status || "pending",
    payoutAccountStatus: row.payout_account_status || "pending",
    communityPolicyStatus: row.community_policy_status || "pending",
    trainingAcknowledgementStatus: row.training_acknowledgement_status || "pending",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    resubmissionAllowed: row.resubmission_allowed !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPeerListenerRate(row) {
  if (!row) return null;
  return {
    id: row.id,
    listenerProfileId: row.listener_profile_id,
    sessionDurationMinutes: row.session_duration_minutes,
    feePaise: Number(row.fee_paise || 0),
    feeInr: Number(row.fee_paise || 0) / 100,
    hourlyEquivalentPaise: Number(row.hourly_equivalent_paise || 0),
    currency: row.currency || "INR",
    enabled: row.enabled || false,
    pricingPolicyVersion: row.pricing_policy_version || "v1.0",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPeerListenerPresence(row) {
  if (!row) return null;
  return {
    listenerProfileId: row.listener_profile_id,
    socketConnectionId: row.socket_connection_id,
    currentStatus: row.current_status || "offline",
    heartbeatAt: row.heartbeat_at,
    availableSince: row.available_since,
    busySessionId: row.busy_session_id,
    version: row.version || 1,
    updatedAt: row.updated_at
  };
}

function mapPeerSessionRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,
    listenerProfileId: row.listener_profile_id,
    requestedDurationMinutes: row.requested_duration_minutes,
    requestedMode: row.requested_mode,
    requestStatus: row.request_status || "pending",
    requestExpiresAt: row.request_expires_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPeerSessionQuote(row) {
  if (!row) return null;
  return {
    id: row.id,
    peerSessionRequestId: row.peer_session_request_id,
    requesterUserId: row.requester_user_id,
    listenerProfileId: row.listener_profile_id,
    durationMinutes: row.duration_minutes,
    grossAmountPaise: Number(row.gross_amount_paise || 0),
    grossAmountInr: Number(row.gross_amount_paise || 0) / 100,
    commissionRateBps: row.commission_rate_bps || 1000,
    commissionAmountPaise: Number(row.commission_amount_paise || 0),
    commissionAmountInr: Number(row.commission_amount_paise || 0) / 100,
    listenerEarningPaise: Number(row.listener_earning_paise || 0),
    listenerEarningInr: Number(row.listener_earning_paise || 0) / 100,
    currency: row.currency || "INR",
    quoteVersion: row.quote_version || "v1.0",
    pricingPolicyVersion: row.pricing_policy_version || "v1.0",
    paymentOrderId: row.payment_order_id || null,
    gatewayOrderId: row.gateway_order_id || null,
    expiresAt: row.expires_at,
    status: row.status || "pending",
    createdAt: row.created_at
  };
}

function mapPeerSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.request_id,
    quoteId: row.quote_id,
    requesterUserId: row.requester_user_id,
    listenerProfileId: row.listener_profile_id,
    status: row.status || "requested",
    textStartedAt: row.text_started_at,
    mediaConsentAvailableAt: row.media_consent_available_at,
    sessionStartedAt: row.session_started_at,
    scheduledEndAt: row.scheduled_end_at,
    actualEndAt: row.actual_end_at,
    endedBy: row.ended_by,
    endReason: row.end_reason,
    completionSource: row.completion_source,
    completionPolicyVersion: row.completion_policy_version || "v1.0",
    safetyState: row.safety_state || "normal",
    disputeState: row.dispute_state || "none",
    paymentState: row.payment_state || "pending",
    settlementState: row.settlement_state || "unsettled",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPeerSessionConsent(row) {
  if (!row) return null;
  return {
    id: row.id,
    peerSessionId: row.peer_session_id,
    userId: row.user_id,
    capability: row.capability,
    consentStatus: row.consent_status || "denied",
    policyVersion: row.policy_version || "v1.0",
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

function mapPeerSessionEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    peerSessionId: row.peer_session_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    sequenceNumber: row.sequence_number,
    details: row.details || {},
    createdAt: row.created_at
  };
}

function mapPeerFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    peerSessionId: row.peer_session_id,
    userId: row.user_id,
    targetUserId: row.target_user_id,
    rating: row.rating,
    respectfulness: row.respectfulness,
    listeningQuality: row.listening_quality,
    comfort: row.comfort,
    reliability: row.reliability,
    wouldTalkAgain: row.would_talk_again,
    reviewText: row.review_text,
    moderationStatus: row.moderation_status || "pending",
    isSafetyReport: row.is_safety_report || false,
    safetyReportCategory: row.safety_report_category,
    createdAt: row.created_at
  };
}

function mapPeerReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    reportedUserId: row.reported_user_id,
    peerSessionId: row.peer_session_id,
    category: row.category,
    description: row.description,
    evidenceMediaKeys: row.evidence_media_keys || [],
    status: row.status || "open",
    resolvedBy: row.resolved_by,
    resolutionNotes: row.resolution_notes,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at
  };
}

function mapPeerBlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    blockerUserId: row.blocker_user_id,
    blockedUserId: row.blocked_user_id,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function mapPeerPolicyAcceptance(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    policyType: row.policy_type,
    policyVersion: row.policy_version,
    language: row.language || "en",
    acceptedAt: row.accepted_at,
    ipAddress: row.ip_address,
    deviceMetadata: row.device_metadata || {}
  };
}

// Double Entry mappings
function mapLedgerAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountKey: row.account_key,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    accountType: row.account_type,
    currency: row.currency,
    status: row.status,
    allowNegative: row.allow_negative,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJournalTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    journalType: row.journal_type,
    businessReferenceType: row.business_reference_type,
    businessReferenceId: row.business_reference_id,
    idempotencyKey: row.idempotency_key,
    currency: row.currency,
    status: row.status,
    description: row.description,
    reversalOfJournalId: row.reversal_of_journal_id,
    metadata: row.metadata || {},
    postedAt: row.posted_at,
    createdAt: row.created_at
  };
}

function mapDoubleEntryLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    journalTransactionId: row.journal_transaction_id,
    ledgerAccountId: row.ledger_account_id,
    entrySide: row.entry_side,
    amountPaise: Number(row.amount_paise || 0),
    sequenceNumber: row.sequence_number,
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
        `INSERT INTO users (id, firebase_uid, role, full_name, email, mobile, password_hash, language_code, avatar_url, is_active, date_of_birth, guardian_email, is_guardian_consent_verified, profile_completed_at, onboarding_status, email_verified_at, guardian_consent_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
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
          user.isGuardianConsentVerified || false,
          user.profileCompletedAt || null,
          user.onboardingStatus || 'COMPLETED',
          user.emailVerifiedAt || null,
          user.guardianConsentStatus || 'APPROVED'
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
        isActive: "is_active",
        profileCompletedAt: "profile_completed_at",
        profile_completed_at: "profile_completed_at",
        onboardingStatus: "onboarding_status",
        onboarding_status: "onboarding_status",
        emailVerifiedAt: "email_verified_at",
        email_verified_at: "email_verified_at",
        guardianConsentStatus: "guardian_consent_status",
        guardian_consent_status: "guardian_consent_status"
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
        `INSERT INTO payment_orders (id, gateway, gateway_order_id, gateway_payment_id, user_id, amount_paise, status, quote_id, peer_session_request_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [order.id, order.gateway, order.gatewayOrderId, order.gatewayPaymentId || null, order.userId, order.amountPaise, order.status, order.quoteId || null, order.peerSessionRequestId || null, order.createdAt || new Date()]
      );
      return mapPaymentOrder(res.rows[0]);
    },
    async find(idOrGatewayOrderId) {
      const res = await query("SELECT * FROM payment_orders WHERE id = $1 OR gateway_order_id = $1 LIMIT 1", [idOrGatewayOrderId]);
      return mapPaymentOrder(res.rows[0]);
    },
    async findForUpdate(idOrGatewayOrderId) {
      const res = await query("SELECT * FROM payment_orders WHERE id = $1 OR gateway_order_id = $1 LIMIT 1 FOR UPDATE", [idOrGatewayOrderId]);
      return mapPaymentOrder(res.rows[0]);
    },
    async findByPaymentId(gatewayPaymentId) {
      if (!gatewayPaymentId) return null;
      const res = await query("SELECT * FROM payment_orders WHERE gateway_payment_id = $1 LIMIT 1", [gatewayPaymentId]);
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

  ledgerAccounts: {
    async findByKey(accountKey) {
      const res = await query("SELECT * FROM ledger_accounts WHERE account_key = $1 LIMIT 1", [accountKey]);
      return mapLedgerAccount(res.rows[0]);
    },
    async findOrCreate(account) {
      let existing = await this.findByKey(account.accountKey);
      if (existing) return existing;
      const res = await query(
        `INSERT INTO ledger_accounts (id, account_key, owner_type, owner_id, account_type, currency, status, allow_negative)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [account.id || createId("lac"), account.accountKey, account.ownerType, account.ownerId, account.accountType, account.currency || "INR", account.status || "active", account.allowNegative || false]
      );
      return mapLedgerAccount(res.rows[0]);
    }
  },

  journalTransactions: {
    async create(journal) {
      const res = await query(
        `INSERT INTO journal_transactions (id, journal_type, business_reference_type, business_reference_id, idempotency_key, currency, status, description, reversal_of_journal_id, metadata, posted_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [journal.id, journal.journalType, journal.businessReferenceType || null, journal.businessReferenceId || null, journal.idempotencyKey, journal.currency || "INR", journal.status || "posted", journal.description || "", journal.reversalOfJournalId || null, journal.metadata || {}, journal.postedAt || new Date(), journal.createdAt || new Date()]
      );
      
      if (journal.entries && journal.entries.length) {
        for (const entry of journal.entries) {
          const account = await postgresRepositories.ledgerAccounts.findOrCreate({
            accountKey: entry.accountKey,
            ownerType: entry.accountKey.startsWith("USER_AVAILABLE_") ? "user" : entry.accountKey.startsWith("LISTENER_") ? "user" : "platform",
            ownerId: entry.accountKey.split("_").pop(),
            accountType: entry.entrySide === "debit" ? "ASSET" : "LIABILITY"
          });
          
          await query(
            `INSERT INTO double_entry_ledger (id, journal_transaction_id, ledger_account_id, entry_side, amount_paise, sequence_number, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [entry.id || createId("ent"), journal.id, account.id, entry.entrySide, entry.amountPaise, entry.sequenceNumber, new Date()]
          );
        }
      }
      return mapJournalTransaction(res.rows[0]);
    }
  },

  aiServices: {
    async list() {
      const res = await query("SELECT * FROM ai_services ORDER BY created_at DESC");
      return res.rows.map(mapAiService);
    },
    async findByKey(serviceKey) {
      const res = await query("SELECT * FROM ai_services WHERE service_key = $1 OR id = $1 LIMIT 1", [serviceKey]);
      return mapAiService(res.rows[0]);
    },
    async upsert(serviceKey, patch) {
      const existing = await this.findByKey(serviceKey);
      if (!existing) {
        const id = `srv_${Date.now()}`;
        const res = await query(
          `INSERT INTO ai_services (id, service_key, display_name, category, description, service_type, user_facing, minimum_age, enabled, primary_provider, primary_model, credit_cost, free_allowance)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [id, serviceKey, patch.displayName || serviceKey, patch.category || "General", patch.description || "", patch.serviceType || "text", patch.userFacing !== false, patch.minimumAge || 18, patch.enabled !== false, patch.primaryProvider || "gemini", patch.primaryModel || "gemini-2.5-flash", patch.creditCost || 0, patch.freeAllowance || 0]
        );
        return mapAiService(res.rows[0]);
      } else {
        const { updates, values, index } = compactPatch(patch, {
          displayName: "display_name",
          category: "category",
          description: "description",
          serviceType: "service_type",
          userFacing: "user_facing",
          minimumAge: "minimum_age",
          enabled: "enabled",
          primaryProvider: "primary_provider",
          primaryModel: "primary_model",
          fallbackProvider: "fallback_provider",
          fallbackModel: "fallback_model",
          creditCost: "credit_cost",
          freeAllowance: "free_allowance"
        });
        if (!updates.length) return existing;
        values.push(existing.id);
        const res = await query(`UPDATE ai_services SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
        return mapAiService(res.rows[0]);
      }
    }
  },

  aiInstructionFiles: {
    async list(serviceId) {
      if (serviceId) {
        const res = await query("SELECT * FROM ai_instruction_files WHERE service_id = $1 ORDER BY created_at DESC", [serviceId]);
        return res.rows.map(mapAiInstructionFile);
      } else {
        const res = await query("SELECT * FROM ai_instruction_files ORDER BY created_at DESC");
        return res.rows.map(mapAiInstructionFile);
      }
    },
    async create(file) {
      const res = await query(
        `INSERT INTO ai_instruction_files (id, service_id, original_filename, file_role, mime_type, file_size, checksum_sha256, extracted_text, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [file.id || createId("aif"), file.serviceId, file.originalFilename || file.original_filename, file.fileRole || file.file_role, file.mimeType || file.mime_type, file.fileSize || file.file_size || 0, file.checksumSha256 || file.checksum_sha256 || "", file.extractedText || file.extracted_text || "", file.createdBy || file.created_by]
      );
      return mapAiInstructionFile(res.rows[0]);
    },
    async delete(id) {
      await query("DELETE FROM ai_instruction_files WHERE id = $1", [id]);
      return true;
    }
  },

  aiInstructionBundles: {
    async list(serviceId) {
      if (serviceId) {
        const res = await query("SELECT * FROM ai_instruction_bundles WHERE service_id = $1 ORDER BY created_at DESC", [serviceId]);
        return res.rows.map(mapAiInstructionBundle);
      } else {
        const res = await query("SELECT * FROM ai_instruction_bundles ORDER BY created_at DESC");
        return res.rows.map(mapAiInstructionBundle);
      }
    },
    async findActive(serviceId) {
      const res = await query("SELECT * FROM ai_instruction_bundles WHERE service_id = $1 AND status = 'active' LIMIT 1", [serviceId]);
      return mapAiInstructionBundle(res.rows[0]);
    },
    async create(bundle) {
      const res = await query(
        `INSERT INTO ai_instruction_bundles (id, service_id, version, name, description, status, system_instruction_text, prohibited_rules_text, parameters_json, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [bundle.id || createId("bdl"), bundle.serviceId, bundle.version || "1.0", bundle.name, bundle.description || "", bundle.status || "draft", bundle.systemInstructionText || bundle.system_instruction_text || "", bundle.prohibitedRulesText || bundle.prohibited_rules_text || "", bundle.parametersJson || bundle.parameters_json || {}, bundle.createdBy || bundle.created_by]
      );
      return mapAiInstructionBundle(res.rows[0]);
    },
    async activate(id) {
      const res = await query("SELECT * FROM ai_instruction_bundles WHERE id = $1", [id]);
      if (!res.rows.length) return null;
      const target = mapAiInstructionBundle(res.rows[0]);
      await query("UPDATE ai_instruction_bundles SET status = 'archived' WHERE service_id = $1 AND status = 'active'", [target.serviceId]);
      const updatedRes = await query("UPDATE ai_instruction_bundles SET status = 'active', activated_at = NOW() WHERE id = $1 RETURNING *", [id]);
      return mapAiInstructionBundle(updatedRes.rows[0]);
    }
  },

  peerListenerProfiles: {
    async findById(id) {
      const res = await query("SELECT * FROM peer_listener_profiles WHERE id = $1 LIMIT 1", [id]);
      return mapPeerListenerProfile(res.rows[0]);
    },
    async findByUserId(userId) {
      const res = await query("SELECT * FROM peer_listener_profiles WHERE user_id = $1 LIMIT 1", [userId]);
      return mapPeerListenerProfile(res.rows[0]);
    },
    async create(profile) {
      const res = await query(
        `INSERT INTO peer_listener_profiles (id, user_id, public_display_name, public_avatar_asset_id, age_band, gender_display, city_display, short_bio, languages, conversation_interests, excluded_topics, verification_status, moderation_status, accepting_requests, voice_enabled, video_enabled, file_sharing_enabled, average_rating, rating_count, completed_session_count, completion_rate, response_rate, reliability_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *`,
        [
          profile.id, profile.userId, profile.publicDisplayName, profile.publicAvatarAssetId || null, profile.ageBand, profile.genderDisplay || null, profile.cityDisplay || null, profile.shortBio || null,
          profile.languages || [], profile.conversationInterests || [], profile.excludedTopics || [], profile.verificationStatus || "pending", profile.moderationStatus || "active", profile.acceptingRequests || false,
          profile.voiceEnabled || false, profile.videoEnabled || false, profile.fileSharingEnabled || false, profile.averageRating || 0, profile.ratingCount || 0, profile.completedSessionCount || 0,
          profile.completionRate || 100.00, profile.responseRate || 100.00, profile.reliabilityScore || 100.00
        ]
      );
      return mapPeerListenerProfile(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        publicDisplayName: "public_display_name",
        publicAvatarAssetId: "public_avatar_asset_id",
        ageBand: "age_band",
        genderDisplay: "gender_display",
        cityDisplay: "city_display",
        shortBio: "short_bio",
        languages: "languages",
        conversationInterests: "conversation_interests",
        excludedTopics: "excluded_topics",
        verificationStatus: "verification_status",
        moderationStatus: "moderation_status",
        acceptingRequests: "accepting_requests",
        voiceEnabled: "voice_enabled",
        videoEnabled: "video_enabled",
        fileSharingEnabled: "file_sharing_enabled",
        averageRating: "average_rating",
        ratingCount: "rating_count",
        completedSessionCount: "completed_session_count",
        completionRate: "completion_rate",
        responseRate: "response_rate",
        reliabilityScore: "reliability_score",
        suspendedAt: "suspended_at",
        suspensionReason: "suspension_reason",
        approvedAt: "approved_at",
        approvedBy: "approved_by"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE peer_listener_profiles SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapPeerListenerProfile(res.rows[0]);
    },
    async list({ status, verificationStatus } = {}) {
      const values = [];
      let whereClauses = [];
      if (status) {
        values.push(status);
        whereClauses.push(`id IN (SELECT listener_profile_id FROM peer_listener_presence WHERE current_status = $${values.length})`);
      }
      if (verificationStatus) {
        values.push(verificationStatus);
        whereClauses.push(`verification_status = $${values.length}`);
      }
      const where = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";
      const res = await query(`SELECT * FROM peer_listener_profiles ${where} ORDER BY created_at DESC`, values);
      return res.rows.map(mapPeerListenerProfile);
    }
  },

  peerListenerVerifications: {
    async findByProfileId(profileId) {
      const res = await query("SELECT * FROM peer_listener_verifications WHERE listener_profile_id = $1 LIMIT 1", [profileId]);
      return mapPeerListenerVerification(res.rows[0]);
    },
    async create(verif) {
      const res = await query(
        `INSERT INTO peer_listener_verifications (id, listener_profile_id, identity_verification_status, age_verification_status, selfie_liveness_status, pan_verification_status, payout_account_status, community_policy_status, training_acknowledgement_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [verif.id, verif.listenerProfileId, verif.identityVerificationStatus || "pending", verif.ageVerificationStatus || "pending", verif.selfieLivenessStatus || "pending", verif.panVerificationStatus || "pending", verif.payoutAccountStatus || "pending", verif.communityPolicyStatus || "pending", verif.trainingAcknowledgementStatus || "pending"]
      );
      return mapPeerListenerVerification(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        identityVerificationStatus: "identity_verification_status",
        ageVerificationStatus: "age_verification_status",
        selfieLivenessStatus: "selfie_liveness_status",
        panVerificationStatus: "pan_verification_status",
        payoutAccountStatus: "payout_account_status",
        communityPolicyStatus: "community_policy_status",
        trainingAcknowledgementStatus: "training_acknowledgement_status",
        reviewedBy: "reviewed_by",
        reviewedAt: "reviewed_at",
        rejectionReason: "rejection_reason",
        resubmissionAllowed: "resubmission_allowed"
      });
      if (!updates.length) return await query("SELECT * FROM peer_listener_verifications WHERE id = $1", [id]).then(r => mapPeerListenerVerification(r.rows[0]));
      values.push(id);
      const res = await query(`UPDATE peer_listener_verifications SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapPeerListenerVerification(res.rows[0]);
    }
  },

  peerListenerRates: {
    async findByProfileId(profileId) {
      const res = await query("SELECT * FROM peer_listener_rates WHERE listener_profile_id = $1 AND enabled = TRUE", [profileId]);
      return res.rows.map(mapPeerListenerRate);
    },
    async createOrUpdate(rate) {
      const res = await query(
        `INSERT INTO peer_listener_rates (id, listener_profile_id, session_duration_minutes, fee_paise, hourly_equivalent_paise, currency, enabled, pricing_policy_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (listener_profile_id, session_duration_minutes)
         DO UPDATE SET fee_paise = EXCLUDED.fee_paise, hourly_equivalent_paise = EXCLUDED.hourly_equivalent_paise, enabled = EXCLUDED.enabled, updated_at = NOW()
         RETURNING *`,
        [rate.id || createId("plr"), rate.listenerProfileId, rate.sessionDurationMinutes, rate.feePaise, rate.hourlyEquivalentPaise, rate.currency || "INR", rate.enabled !== false, rate.pricingPolicyVersion || "v1.0"]
      );
      return mapPeerListenerRate(res.rows[0]);
    }
  },

  peerListenerPresence: {
    async findByProfileId(profileId) {
      const res = await query("SELECT * FROM peer_listener_presence WHERE listener_profile_id = $1 LIMIT 1", [profileId]);
      return mapPeerListenerPresence(res.rows[0]);
    },
    async createOrUpdate(presence) {
      const res = await query(
        `INSERT INTO peer_listener_presence (listener_profile_id, socket_connection_id, current_status, heartbeat_at, available_since, busy_session_id, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
         ON CONFLICT (listener_profile_id)
         DO UPDATE SET socket_connection_id = EXCLUDED.socket_connection_id, current_status = EXCLUDED.current_status, heartbeat_at = EXCLUDED.heartbeat_at, available_since = EXCLUDED.available_since, busy_session_id = EXCLUDED.busy_session_id, version = peer_listener_presence.version + 1, updated_at = NOW()
         RETURNING *`,
        [presence.listenerProfileId, presence.socketConnectionId || null, presence.currentStatus || "offline", presence.heartbeatAt || new Date(), presence.availableSince || null, presence.busySessionId || null]
      );
      return mapPeerListenerPresence(res.rows[0]);
    },
    async reapExpiredHeartbeats(timeoutSeconds = 60) {
      const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
      const res = await query(
        `UPDATE peer_listener_presence
         SET current_status = 'offline', socket_connection_id = NULL, updated_at = NOW()
         WHERE current_status != 'offline' AND heartbeat_at < $1 RETURNING *`,
        [cutoff]
      );
      return res.rows.map(mapPeerListenerPresence);
    }
  },

  peerSessionRequests: {
    async findById(id) {
      const res = await query("SELECT * FROM peer_session_requests WHERE id = $1 LIMIT 1", [id]);
      return mapPeerSessionRequest(res.rows[0]);
    },
    async create(request) {
      const res = await query(
        `INSERT INTO peer_session_requests (id, requester_user_id, listener_profile_id, requested_duration_minutes, requested_mode, request_status, request_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [request.id, request.requesterUserId, request.listenerProfileId, request.requestedDurationMinutes, request.requestedMode, request.requestStatus || "pending", request.requestExpiresAt]
      );
      return mapPeerSessionRequest(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        requestStatus: "request_status",
        acceptedAt: "accepted_at",
        declinedAt: "declined_at",
        declineReason: "decline_reason"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE peer_session_requests SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapPeerSessionRequest(res.rows[0]);
    },
    async listForUser(userId) {
      const res = await query("SELECT * FROM peer_session_requests WHERE requester_user_id = $1 ORDER BY created_at DESC", [userId]);
      return res.rows.map(mapPeerSessionRequest);
    },
    async listForListener(profileId) {
      const res = await query("SELECT * FROM peer_session_requests WHERE listener_profile_id = $1 ORDER BY created_at DESC", [profileId]);
      return res.rows.map(mapPeerSessionRequest);
    }
  },

  peerSessionQuotes: {
    async findById(id) {
      const res = await query("SELECT * FROM peer_session_quotes WHERE id = $1 LIMIT 1", [id]);
      return mapPeerSessionQuote(res.rows[0]);
    },
    async findByRequestId(requestId) {
      const res = await query("SELECT * FROM peer_session_quotes WHERE peer_session_request_id = $1 LIMIT 1", [requestId]);
      return mapPeerSessionQuote(res.rows[0]);
    },
    async create(quote) {
      const res = await query(
        `INSERT INTO peer_session_quotes (id, peer_session_request_id, requester_user_id, listener_profile_id, duration_minutes, gross_amount_paise, commission_rate_bps, commission_amount_paise, listener_earning_paise, currency, quote_version, pricing_policy_version, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [quote.id, quote.peerSessionRequestId || null, quote.requesterUserId, quote.listenerProfileId, quote.durationMinutes, quote.grossAmountPaise, quote.commissionRateBps || 1000, quote.commissionAmountPaise, quote.listenerEarningPaise, quote.currency || "INR", quote.quoteVersion || "v1.0", quote.pricingPolicyVersion || "v1.0", quote.expiresAt, quote.status || "pending"]
      );
      return mapPeerSessionQuote(res.rows[0]);
    },
    async updateStatus(id, status) {
      const res = await query("UPDATE peer_session_quotes SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return mapPeerSessionQuote(res.rows[0]);
    },
    async updatePaymentOrder(id, paymentOrderId, gatewayOrderId) {
      const res = await query("UPDATE peer_session_quotes SET payment_order_id = $1, gateway_order_id = $2 WHERE id = $3 RETURNING *", [paymentOrderId, gatewayOrderId, id]);
      return mapPeerSessionQuote(res.rows[0]);
    }
  },

  peerSessions: {
    async findById(id) {
      const res = await query("SELECT * FROM peer_sessions WHERE id = $1 LIMIT 1", [id]);
      return mapPeerSession(res.rows[0]);
    },
    async findByRequestId(requestId) {
      const res = await query("SELECT * FROM peer_sessions WHERE request_id = $1 LIMIT 1", [requestId]);
      return mapPeerSession(res.rows[0]);
    },
    async create(session) {
      const res = await query(
        `INSERT INTO peer_sessions (id, request_id, quote_id, requester_user_id, listener_profile_id, status, payment_state, settlement_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [session.id, session.requestId || session.peerSessionRequestId || null, session.quoteId || null, session.requesterUserId, session.listenerProfileId, session.status || session.sessionStatus || "requested", session.paymentState || "pending", session.settlementState || "unsettled"]
      );
      return mapPeerSession(res.rows[0]);
    },
    async update(id, patch) {
      const { updates, values, index } = compactPatch(patch, {
        status: "status",
        textStartedAt: "text_started_at",
        mediaConsentAvailableAt: "media_consent_available_at",
        sessionStartedAt: "session_started_at",
        scheduledEndAt: "scheduled_end_at",
        actualEndAt: "actual_end_at",
        endedBy: "ended_by",
        endReason: "end_reason",
        completionSource: "completion_source",
        completionPolicyVersion: "completion_policy_version",
        safetyState: "safety_state",
        disputeState: "dispute_state",
        paymentState: "payment_state",
        settlementState: "settlement_state"
      });
      if (!updates.length) return await this.findById(id);
      values.push(id);
      const res = await query(`UPDATE peer_sessions SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`, values);
      return mapPeerSession(res.rows[0]);
    },
    async listForUser(user) {
      if (user.role === "admin") {
        const res = await query("SELECT * FROM peer_sessions ORDER BY created_at DESC");
        return res.rows.map(mapPeerSession);
      }
      const res = await query(
        "SELECT * FROM peer_sessions WHERE requester_user_id = $1 OR listener_profile_id IN (SELECT id FROM peer_listener_profiles WHERE user_id = $1) ORDER BY created_at DESC",
        [user.id]
      );
      return res.rows.map(mapPeerSession);
    }
  },

  peerSessionConsents: {
    async findBySessionId(sessionId) {
      const res = await query("SELECT * FROM peer_session_consents WHERE peer_session_id = $1", [sessionId]);
      return res.rows.map(mapPeerSessionConsent);
    },
    async createOrUpdate(consent) {
      const res = await query(
        `INSERT INTO peer_session_consents (id, peer_session_id, user_id, capability, consent_status, policy_version, granted_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (peer_session_id, user_id, capability)
         DO UPDATE SET consent_status = EXCLUDED.consent_status, granted_at = CASE WHEN EXCLUDED.consent_status = 'granted' THEN NOW() ELSE peer_session_consents.granted_at END, revoked_at = CASE WHEN EXCLUDED.consent_status = 'revoked' THEN NOW() ELSE peer_session_consents.revoked_at END
         RETURNING *`,
        [consent.id || createId("psc"), consent.peerSessionId, consent.userId, consent.capability, consent.consentStatus || "denied", consent.policyVersion || "v1.0", consent.consentStatus === "granted" ? new Date() : null, consent.consentStatus === "revoked" ? new Date() : null]
      );
      return mapPeerSessionConsent(res.rows[0]);
    }
  },

  peerSessionEvents: {
    async create(event) {
      const res = await query(
        `INSERT INTO peer_session_events (id, peer_session_id, event_type, actor_id, sequence_number, details)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [event.id || createId("pse"), event.peerSessionId, event.eventType, event.actorId || null, event.sequenceNumber, event.details || {}]
      );
      return mapPeerSessionEvent(res.rows[0]);
    },
    async listForSession(sessionId) {
      const res = await query("SELECT * FROM peer_session_events WHERE peer_session_id = $1 ORDER BY sequence_number ASC", [sessionId]);
      return res.rows.map(mapPeerSessionEvent);
    }
  },

  peerFeedback: {
    async create(feedback) {
      const res = await query(
        `INSERT INTO peer_feedback (id, peer_session_id, user_id, target_user_id, rating, respectfulness, listening_quality, comfort, reliability, would_talk_again, review_text, moderation_status, is_safety_report, safety_report_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          feedback.id || createId("pfb"), feedback.peerSessionId, feedback.userId, feedback.targetUserId, feedback.rating || null, feedback.respectfulness || null, feedback.listeningQuality || null,
          feedback.comfort || null, feedback.reliability || null, feedback.wouldTalkAgain !== false, feedback.reviewText || null, feedback.moderationStatus || "pending", feedback.isSafetyReport || false, feedback.safetyReportCategory || null
        ]
      );
      return mapPeerFeedback(res.rows[0]);
    },
    async findBySessionAndUser(sessionId, userId) {
      const res = await query("SELECT * FROM peer_feedback WHERE peer_session_id = $1 AND user_id = $2 LIMIT 1", [sessionId, userId]);
      return mapPeerFeedback(res.rows[0]);
    }
  },

  peerReports: {
    async create(report) {
      const res = await query(
        `INSERT INTO peer_reports (id, reporter_user_id, reported_user_id, peer_session_id, category, description, evidence_media_keys, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [report.id || createId("prp"), report.reporterUserId, report.reportedUserId, report.peerSessionId || null, report.category, report.description || "", report.evidenceMediaKeys || [], report.status || "open"]
      );
      return mapPeerReport(res.rows[0]);
    },
    async list() {
      const res = await query("SELECT * FROM peer_reports ORDER BY created_at DESC");
      return res.rows.map(mapPeerReport);
    },
    async updateStatus(id, status, notes, resolvedBy) {
      const res = await query(
        "UPDATE peer_reports SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $4 RETURNING *",
        [status, notes, resolvedBy, id]
      );
      return mapPeerReport(res.rows[0]);
    }
  },

  peerBlocks: {
    async create(block) {
      const res = await query(
        `INSERT INTO peer_blocks (id, blocker_user_id, blocked_user_id, reason)
         VALUES ($1, $2, $3, $4) ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING RETURNING *`,
        [block.id || createId("pbk"), block.blockerUserId, block.blockedUserId, block.reason || null]
      );
      return mapPeerBlock(res.rows[0]);
    },
    async remove(blockerUserId, blockedUserId) {
      await query("DELETE FROM peer_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2", [blockerUserId, blockedUserId]);
      return true;
    },
    async isBlocked(userA, userB) {
      const res = await query("SELECT 1 FROM peer_blocks WHERE (blocker_user_id = $1 AND blocked_user_id = $2) OR (blocker_user_id = $2 AND blocked_user_id = $1) LIMIT 1", [userA, userB]);
      return res.rows.length > 0;
    }
  },

  peerPolicyAcceptances: {
    async create(acceptance) {
      const res = await query(
        `INSERT INTO peer_policy_acceptances (id, user_id, policy_type, policy_version, language, ip_address, device_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, policy_type, policy_version) DO UPDATE SET accepted_at = NOW()
         RETURNING *`,
        [acceptance.id || createId("ppa"), acceptance.userId, acceptance.policyType, acceptance.policyVersion, acceptance.language || "en", acceptance.ipAddress || null, acceptance.deviceMetadata || {}]
      );
      return mapPeerPolicyAcceptance(res.rows[0]);
    },
    async findLatest(userId, policyType) {
      const res = await query("SELECT * FROM peer_policy_acceptances WHERE user_id = $1 AND policy_type = $2 ORDER BY accepted_at DESC LIMIT 1", [userId, policyType]);
      return mapPeerPolicyAcceptance(res.rows[0]);
    }
  },

  peerChatMessages: {
    async create(message) {
      const res = await query(
        `INSERT INTO peer_chat_messages (id, peer_session_id, sender_id, message_text)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [message.id || createId("msg"), message.peerSessionId, message.senderId, message.messageText]
      );
      return mapPeerChatMessage(res.rows[0]);
    },
    async listForSession(sessionId) {
      const res = await query("SELECT * FROM peer_chat_messages WHERE peer_session_id = $1 ORDER BY created_at ASC", [sessionId]);
      return res.rows.map(mapPeerChatMessage);
    }
  },

  screenings: {
    async create(screening) {
      const res = await query(
        `INSERT INTO screenings (id, user_id, screening_type, status, score, responses_json)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [screening.id || createId("scr"), screening.userId, screening.screeningType, screening.status || "started", screening.score || null, screening.responsesJson || {}]
      );
      return mapScreening(res.rows[0]);
    },
    async update(id, updates) {
      const fields = [];
      const values = [];
      let idx = 1;
      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.score !== undefined) {
        fields.push(`score = $${idx++}`);
        values.push(updates.score);
      }
      if (updates.responsesJson !== undefined) {
        fields.push(`responses_json = $${idx++}`);
        values.push(updates.responsesJson);
      }
      if (updates.completedAt !== undefined) {
        fields.push(`completed_at = $${idx++}`);
        values.push(updates.completedAt);
      }
      if (fields.length === 0) return null;
      values.push(id);
      const res = await query(
        `UPDATE screenings SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );
      return mapScreening(res.rows[0]);
    },
    async findById(id) {
      const res = await query("SELECT * FROM screenings WHERE id = $1", [id]);
      return mapScreening(res.rows[0]);
    },
    async listForUser(userId) {
      const res = await query("SELECT * FROM screenings WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
      return res.rows.map(mapScreening);
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
  },

  promotionalBanners: {
    async listAll() {
      const res = await query("SELECT * FROM promotional_banners ORDER BY created_at DESC");
      return res.rows.map(row => ({
        id: row.id,
        message: row.message,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    },
    async getActive() {
      const res = await query("SELECT * FROM promotional_banners WHERE is_active = true ORDER BY created_at DESC");
      return res.rows.map(row => ({
        id: row.id,
        message: row.message,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    },
    async create(data) {
      const id = data.id || createId("promo");
      const res = await query(
        "INSERT INTO promotional_banners (id, message, is_active) VALUES ($1, $2, $3) RETURNING *",
        [id, data.message, data.isActive || false]
      );
      const row = res.rows[0];
      return { id: row.id, message: row.message, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at };
    },
    async update(id, updates) {
      const { updates: upds, values, index } = compactPatch({ message: 'message', isActive: 'is_active' }, { message: 'message', isActive: 'is_active' }, updates);
      const realUpdates = [];
      const realValues = [];
      let realIndex = 1;
      
      if (updates.message !== undefined) {
        realUpdates.push(`message = $${realIndex++}`);
        realValues.push(updates.message);
      }
      if (updates.isActive !== undefined) {
        realUpdates.push(`is_active = $${realIndex++}`);
        realValues.push(updates.isActive);
      }
      
      if (realUpdates.length === 0) return null;
      
      realValues.push(id);
      
      const res = await query(
        `UPDATE promotional_banners SET ${realUpdates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${realIndex} RETURNING *`,
        realValues
      );
      if (res.rowCount === 0) return null;
      const row = res.rows[0];
      return { id: row.id, message: row.message, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at };
    },
    async delete(id) {
      await query("DELETE FROM promotional_banners WHERE id = $1", [id]);
      return true;
    }
  }
};

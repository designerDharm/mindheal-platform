-- Migration 007: Talk to Someone Peer Listening Marketplace

-- 1. Profiles
CREATE TABLE IF NOT EXISTS peer_listener_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_display_name VARCHAR(255) NOT NULL,
  public_avatar_asset_id VARCHAR(255),
  age_band VARCHAR(32) NOT NULL CHECK (age_band IN ('18-20', '21-24', '25-29', '30-34', '35-39', '40-49', '50+')),
  gender_display VARCHAR(32),
  city_display VARCHAR(255),
  short_bio TEXT,
  languages TEXT[] DEFAULT '{}',
  conversation_interests TEXT[] DEFAULT '{}',
  excluded_topics TEXT[] DEFAULT '{}',
  verification_status VARCHAR(32) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  moderation_status VARCHAR(32) DEFAULT 'active' CHECK (moderation_status IN ('active', 'flagged', 'suspended')),
  accepting_requests BOOLEAN DEFAULT FALSE,
  voice_enabled BOOLEAN DEFAULT FALSE,
  video_enabled BOOLEAN DEFAULT FALSE,
  file_sharing_enabled BOOLEAN DEFAULT FALSE,
  average_rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  completed_session_count INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 100.00,
  response_rate NUMERIC(5,2) DEFAULT 100.00,
  reliability_score NUMERIC(5,2) DEFAULT 100.00,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Verification Checklist
CREATE TABLE IF NOT EXISTS peer_listener_verifications (
  id TEXT PRIMARY KEY,
  listener_profile_id TEXT NOT NULL REFERENCES peer_listener_profiles(id) ON DELETE CASCADE,
  identity_verification_status VARCHAR(32) DEFAULT 'pending',
  age_verification_status VARCHAR(32) DEFAULT 'pending',
  selfie_liveness_status VARCHAR(32) DEFAULT 'pending',
  pan_verification_status VARCHAR(32) DEFAULT 'pending',
  payout_account_status VARCHAR(32) DEFAULT 'pending',
  community_policy_status VARCHAR(32) DEFAULT 'pending',
  training_acknowledgement_status VARCHAR(32) DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  resubmission_allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rates Table
CREATE TABLE IF NOT EXISTS peer_listener_rates (
  id TEXT PRIMARY KEY,
  listener_profile_id TEXT NOT NULL REFERENCES peer_listener_profiles(id) ON DELETE CASCADE,
  session_duration_minutes INTEGER NOT NULL CHECK (session_duration_minutes IN (15, 30, 45, 60)),
  fee_paise BIGINT NOT NULL CHECK (fee_paise >= 0),
  hourly_equivalent_paise BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'INR',
  enabled BOOLEAN DEFAULT TRUE,
  pricing_policy_version VARCHAR(32) DEFAULT 'v1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listener_profile_id, session_duration_minutes)
);

-- 4. Presence
CREATE TABLE IF NOT EXISTS peer_listener_presence (
  listener_profile_id TEXT PRIMARY KEY REFERENCES peer_listener_profiles(id) ON DELETE CASCADE,
  socket_connection_id VARCHAR(255),
  current_status VARCHAR(32) DEFAULT 'offline' CHECK (current_status IN ('offline', 'available', 'pending_request', 'busy', 'break', 'suspended')),
  heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  available_since TIMESTAMPTZ,
  busy_session_id TEXT,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Session Requests
CREATE TABLE IF NOT EXISTS peer_session_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  listener_profile_id TEXT NOT NULL REFERENCES peer_listener_profiles(id),
  requested_duration_minutes INTEGER NOT NULL,
  requested_mode VARCHAR(32) NOT NULL CHECK (requested_mode IN ('text', 'voice', 'video')),
  request_status VARCHAR(32) DEFAULT 'pending' CHECK (request_status IN ('pending', 'accepted', 'declined', 'expired')),
  request_expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Quotes
CREATE TABLE IF NOT EXISTS peer_session_quotes (
  id TEXT PRIMARY KEY,
  peer_session_request_id TEXT REFERENCES peer_session_requests(id),
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  listener_profile_id TEXT NOT NULL REFERENCES peer_listener_profiles(id),
  duration_minutes INTEGER NOT NULL,
  gross_amount_paise BIGINT NOT NULL,
  commission_rate_bps INTEGER DEFAULT 1000,
  commission_amount_paise BIGINT NOT NULL,
  listener_earning_paise BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'INR',
  quote_version VARCHAR(32) DEFAULT 'v1.0',
  pricing_policy_version VARCHAR(32) DEFAULT 'v1.0',
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Peer Sessions
CREATE TABLE IF NOT EXISTS peer_sessions (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES peer_session_requests(id),
  quote_id TEXT REFERENCES peer_session_quotes(id),
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  listener_profile_id TEXT NOT NULL REFERENCES peer_listener_profiles(id),
  status VARCHAR(32) DEFAULT 'requested' CHECK (status IN ('requested', 'awaiting_listener', 'accepted', 'payment_pending', 'paid', 'text_active', 'media_consent_available', 'active', 'ending', 'completed', 'cancelled_by_requester', 'cancelled_by_listener', 'safety_ended', 'technical_failure', 'disputed', 'refund_pending', 'refunded', 'settled', 'expired')),
  text_started_at TIMESTAMPTZ,
  media_consent_available_at TIMESTAMPTZ,
  session_started_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  ended_by TEXT REFERENCES users(id),
  end_reason TEXT,
  completion_source VARCHAR(64),
  completion_policy_version VARCHAR(32) DEFAULT 'v1.0',
  safety_state VARCHAR(32) DEFAULT 'normal',
  dispute_state VARCHAR(32) DEFAULT 'none',
  payment_state VARCHAR(32) DEFAULT 'pending',
  settlement_state VARCHAR(32) DEFAULT 'unsettled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Mutual Consents
CREATE TABLE IF NOT EXISTS peer_session_consents (
  id TEXT PRIMARY KEY,
  peer_session_id TEXT NOT NULL REFERENCES peer_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  capability VARCHAR(32) NOT NULL CHECK (capability IN ('voice', 'video', 'file_sharing')),
  consent_status VARCHAR(32) DEFAULT 'denied' CHECK (consent_status IN ('granted', 'denied', 'revoked')),
  policy_version VARCHAR(32) DEFAULT 'v1.0',
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(peer_session_id, user_id, capability)
);

-- 9. Seq Events
CREATE TABLE IF NOT EXISTS peer_session_events (
  id TEXT PRIMARY KEY,
  peer_session_id TEXT NOT NULL REFERENCES peer_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  actor_id TEXT REFERENCES users(id),
  sequence_number INTEGER NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(peer_session_id, sequence_number)
);

-- 10. Feedback & Ratings
CREATE TABLE IF NOT EXISTS peer_feedback (
  id TEXT PRIMARY KEY,
  peer_session_id TEXT NOT NULL REFERENCES peer_sessions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  respectfulness INTEGER CHECK (respectfulness >= 1 AND respectfulness <= 5),
  listening_quality INTEGER CHECK (listening_quality >= 1 AND listening_quality <= 5),
  comfort INTEGER CHECK (comfort >= 1 AND comfort <= 5),
  reliability INTEGER CHECK (reliability >= 1 AND reliability <= 5),
  would_talk_again BOOLEAN,
  review_text TEXT,
  moderation_status VARCHAR(32) DEFAULT 'pending',
  is_safety_report BOOLEAN DEFAULT FALSE,
  safety_report_category VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Reports & Safety
CREATE TABLE IF NOT EXISTS peer_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id),
  reported_user_id TEXT NOT NULL REFERENCES users(id),
  peer_session_id TEXT REFERENCES peer_sessions(id),
  category VARCHAR(64) NOT NULL,
  description TEXT,
  evidence_media_keys TEXT[] DEFAULT '{}',
  status VARCHAR(32) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolved_by TEXT REFERENCES users(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Block Matrix
CREATE TABLE IF NOT EXISTS peer_blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_user_id, blocked_user_id)
);

-- 13. Policy Acceptances
CREATE TABLE IF NOT EXISTS peer_policy_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_type VARCHAR(64) NOT NULL, -- e.g. 'marketplace_disclaimer'
  policy_version VARCHAR(32) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  device_metadata JSONB DEFAULT '{}',
  UNIQUE (user_id, policy_type, policy_version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_peer_listener_user ON peer_listener_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_peer_listener_verif ON peer_listener_verifications(listener_profile_id);
CREATE INDEX IF NOT EXISTS idx_peer_listener_rates ON peer_listener_rates(listener_profile_id);
CREATE INDEX IF NOT EXISTS idx_peer_session_requests_req ON peer_session_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_session_requests_list ON peer_session_requests(listener_profile_id);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_req ON peer_sessions(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_list ON peer_sessions(listener_profile_id);
CREATE INDEX IF NOT EXISTS idx_peer_session_consents ON peer_session_consents(peer_session_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedback ON peer_feedback(peer_session_id);
CREATE INDEX IF NOT EXISTS idx_peer_reports_rep ON peer_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_reports_reported ON peer_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_blocks_blocker ON peer_blocks(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_policy_acc ON peer_policy_acceptances(user_id);

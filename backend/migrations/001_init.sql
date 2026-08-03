CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE,
  role VARCHAR(32) NOT NULL CHECK (role IN ('user', 'counsellor', 'admin')),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  mobile VARCHAR(20),
  password_hash TEXT,
  auth_provider VARCHAR(32) DEFAULT 'email',
  language_code VARCHAR(10) DEFAULT 'en',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email, role)
);

CREATE TABLE IF NOT EXISTS counsellors (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  account_type VARCHAR(32) DEFAULT 'individual' CHECK (account_type IN ('individual', 'organisation')),
  display_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  bio TEXT,
  specializations TEXT[] NOT NULL DEFAULT '{}',
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  license_number VARCHAR(100),
  has_prescription_auth BOOLEAN DEFAULT FALSE,
  hourly_rate_inr NUMERIC(10,2) NOT NULL DEFAULT 0,
  per_minute_rate_inr NUMERIC(8,2),
  chat_enabled BOOLEAN DEFAULT TRUE,
  audio_enabled BOOLEAN DEFAULT FALSE,
  video_enabled BOOLEAN DEFAULT FALSE,
  show_on_map BOOLEAN DEFAULT FALSE,
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  address TEXT,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  verification_status VARCHAR(32) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  status VARCHAR(32) DEFAULT 'offline',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counsellor_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  license_number VARCHAR(100),
  specializations TEXT,
  status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mood_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(40),
  message TEXT,
  status VARCHAR(32) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  owner_type VARCHAR(32) NOT NULL CHECK (owner_type IN ('user', 'counsellor', 'platform')),
  owner_id TEXT NOT NULL,
  currency CHAR(3) DEFAULT 'INR',
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  entry_type VARCHAR(64) NOT NULL,
  reference_type VARCHAR(64),
  reference_id TEXT,
  idempotency_key VARCHAR(128) UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  gateway VARCHAR(64) NOT NULL,
  gateway_order_id VARCHAR(255) UNIQUE NOT NULL,
  gateway_payment_id VARCHAR(255),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status VARCHAR(32) DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  counsellor_id TEXT NOT NULL REFERENCES counsellors(id),
  counsellor_user_id TEXT REFERENCES users(id),
  session_type VARCHAR(32) NOT NULL CHECK (session_type IN ('chat', 'audio', 'video', 'group')),
  service_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  actual_duration_minutes INTEGER,
  amount_paise BIGINT NOT NULL,
  platform_commission_paise BIGINT NOT NULL,
  counsellor_earning_paise BIGINT NOT NULL,
  availability_slot_id TEXT,
  agora_channel_id VARCHAR(255),
  consent_record_id TEXT,
  decline_reason TEXT,
  payment_failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id TEXT PRIMARY KEY,
  counsellor_id TEXT NOT NULL REFERENCES counsellors(id),
  slot_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  session_type VARCHAR(32) NOT NULL DEFAULT 'video' CHECK (session_type IN ('chat', 'audio', 'video', 'group')),
  is_booked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (counsellor_id, slot_date, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  report_type VARCHAR(32) NOT NULL CHECK (report_type IN ('dream', 'handwriting', 'signature')),
  input_text TEXT,
  input_media_url TEXT,
  voice_transcript TEXT,
  ai_summary TEXT NOT NULL,
  ai_full_report TEXT,
  pdf_url TEXT,
  is_pdf_unlocked BOOLEAN DEFAULT FALSE,
  pdf_unlock_fee_paise BIGINT NOT NULL,
  expert_review_session_id TEXT REFERENCES sessions(id),
  ai_model_used VARCHAR(100),
  prompt_version_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_configurations (
  id TEXT PRIMARY KEY,
  service_name VARCHAR(128) UNIQUE NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  provider VARCHAR(64) NOT NULL,
  model_name VARCHAR(128),
  api_key_encrypted TEXT,
  system_prompt TEXT,
  parameters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services_catalog (
  id TEXT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  category VARCHAR(64),
  icon VARCHAR(64),
  is_active BOOLEAN DEFAULT TRUE,
  is_free BOOLEAN DEFAULT FALSE,
  price_paise BIGINT DEFAULT 0,
  api_config_id TEXT REFERENCES api_configurations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  entity VARCHAR(100),
  entity_type VARCHAR(64),
  entity_id TEXT,
  details JSONB,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role VARCHAR(32) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  consent_type VARCHAR(64) NOT NULL,
  granted BOOLEAN NOT NULL,
  scope TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crisis_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  source VARCHAR(64) NOT NULL,
  risk_level VARCHAR(32) NOT NULL,
  detected_text_hash VARCHAR(64),
  action_taken TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_counsellors_status ON counsellors(verification_status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_counsellor ON sessions(counsellor_user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_availability_slots_counsellor ON availability_slots(counsellor_id, slot_date, start_time);
CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger_entries(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway ON payment_orders(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_crisis_events_user ON crisis_events(user_id, created_at DESC);

INSERT INTO api_configurations (id, service_name, aliases, provider, model_name, api_key_encrypted, system_prompt, is_active)
VALUES
  ('cfg_ai_chat', 'AI Counselling Chat', ARRAY['chat', 'ai-chat', 'ai-counselling'], 'Gemini', 'gemini-1.5-flash', '', 'Warm reflective mental wellness support.', FALSE),
  ('cfg_dream_pdf', 'Dream Analysis PDF Report', ARRAY['report_dream', 'report-dream', 'dream-analysis'], 'Gemini', 'gemini-1.5-pro', '', 'Reflective dream analysis, not diagnosis.', FALSE),
  ('cfg_google_maps', 'Google Maps', ARRAY['google-maps', 'maps'], 'Google', '', '', '', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services_catalog (id, name, category, is_active, is_free, price_paise)
VALUES
  ('svc_ai_chat', 'AI Counselling Chat', 'AI Support', TRUE, TRUE, 0),
  ('svc_dream', 'Dream Analysis PDF Report', 'Analysis Reports', TRUE, FALSE, 4900)
ON CONFLICT (id) DO NOTHING;

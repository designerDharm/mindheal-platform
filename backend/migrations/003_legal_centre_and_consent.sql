-- Migration 003: Legal Centre, Acceptance Tracking & DPDP Consent Engine
CREATE TABLE IF NOT EXISTS legal_documents (
  id TEXT PRIMARY KEY,
  document_type VARCHAR(64) NOT NULL,
  audience VARCHAR(32) NOT NULL CHECK (audience IN ('USER', 'PROFESSIONAL', 'GUARDIAN', 'PUBLIC')),
  locale VARCHAR(10) DEFAULT 'en',
  version VARCHAR(32) NOT NULL,
  status VARCHAR(32) DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'RETIRED')),
  title VARCHAR(255) NOT NULL,
  rendered_content TEXT NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  change_summary TEXT,
  is_material_change BOOLEAN DEFAULT FALSE,
  requires_reacceptance BOOLEAN DEFAULT FALSE,
  approved_by_legal VARCHAR(255),
  approved_by_clinical VARCHAR(255),
  effective_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id TEXT PRIMARY KEY,
  legal_document_id TEXT REFERENCES legal_documents(id),
  subject_user_id TEXT REFERENCES users(id),
  accepting_actor_id TEXT REFERENCES users(id),
  accepting_role VARCHAR(32) DEFAULT 'SELF' CHECK (accepting_role IN ('SELF', 'GUARDIAN', 'ORGANISATION_REPRESENTATIVE')),
  accepted_version VARCHAR(32) NOT NULL,
  accepted_content_hash VARCHAR(128) NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  locale VARCHAR(10) DEFAULT 'en',
  app_surface VARCHAR(64) DEFAULT 'web',
  app_version VARCHAR(32) DEFAULT '1.0'
);

CREATE TABLE IF NOT EXISTS consent_purposes (
  id TEXT PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  purpose_code VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN ('GIVE', 'WITHDRAW', 'EXPIRE', 'SUPERSEDE')),
  actor_id TEXT REFERENCES users(id),
  scope VARCHAR(255),
  recipient VARCHAR(255),
  evidence_hash VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO consent_purposes (id, code, title, description, is_mandatory)
VALUES
  ('cnsp_core', 'CORE_SERVICE', 'Core Service Terms', 'Basic account administration and essential service delivery.', TRUE),
  ('cnsp_health', 'HEALTH_DATA', 'Mental Health & Assessment Data', 'Processing mood tracking, CBT logs, and assessment scores.', FALSE),
  ('cnsp_ai', 'AI_PROCESSING', 'AI Model Processing', 'Sending anonymized inputs to configured AI providers.', FALSE),
  ('cnsp_sharing', 'PROFESSIONAL_SHARING', 'Counsellor Data Sharing', 'Explicit sharing of selected reports with a chosen clinician.', FALSE),
  ('cnsp_minor', 'GUARDIAN_MINOR', 'Guardian Consent', 'Parent/guardian consent for minor accounts (15-17 years).', FALSE)
ON CONFLICT (code) DO NOTHING;

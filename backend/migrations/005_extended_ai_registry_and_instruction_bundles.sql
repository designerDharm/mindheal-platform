-- Migration 005: Extended AI Service Registry, Age & Privacy Rules, and Instruction File Management

-- 1. Create Extended AI Services Table (Canonical Service Registry)
CREATE TABLE IF NOT EXISTS ai_services (
  id TEXT PRIMARY KEY,
  service_key VARCHAR(128) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description TEXT,
  service_type VARCHAR(64) NOT NULL DEFAULT 'text',
  user_facing BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_age INTEGER NOT NULL DEFAULT 18,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  primary_provider VARCHAR(64) DEFAULT 'gemini',
  primary_model VARCHAR(128) DEFAULT 'gemini-2.5-flash',
  fallback_provider VARCHAR(64) DEFAULT 'openai',
  fallback_model VARCHAR(128) DEFAULT 'gpt-4o-mini',
  credit_cost INTEGER NOT NULL DEFAULT 0,
  free_allowance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Instruction Files Table
CREATE TABLE IF NOT EXISTS ai_instruction_files (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES ai_services(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  file_role VARCHAR(64) NOT NULL CHECK (file_role IN ('DATA_SOURCE', 'RESPONSE_INSTRUCTIONS', 'RESPONSE_PARAMETERS', 'PROHIBITED_RESPONSES', 'SAFETY_POLICY', 'OUTPUT_SCHEMA')),
  mime_type VARCHAR(64) NOT NULL,
  file_size BIGINT NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  extracted_text TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Instruction Bundles Table
CREATE TABLE IF NOT EXISTS ai_instruction_bundles (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES ai_services(id) ON DELETE CASCADE,
  version VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'active', 'archived')),
  system_instruction_text TEXT,
  prohibited_rules_text TEXT,
  parameters_json JSONB DEFAULT '{}',
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE(service_id, version)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_ai_services_key ON ai_services(service_key);
CREATE INDEX IF NOT EXISTS idx_ai_services_enabled ON ai_services(enabled);
CREATE INDEX IF NOT EXISTS idx_instruction_files_service ON ai_instruction_files(service_id);
CREATE INDEX IF NOT EXISTS idx_instruction_bundles_service ON ai_instruction_bundles(service_id, status);

-- Seed canonical services into database
INSERT INTO ai_services (id, service_key, display_name, category, service_type, user_facing, minimum_age, enabled, primary_provider, primary_model, credit_cost)
VALUES
  ('srv_ai_chat', 'adult_supportive_ai_chat', 'Adult Supportive AI Chat', 'User Support', 'text', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_mood_refl', 'mood_reflection', 'Mood Reflection', 'Wellness', 'text', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_journal_refl', 'journal_reflection', 'Journal Reflection', 'Wellness', 'text', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_cbt_refl', 'cbt_exercise_reflection', 'CBT Exercise Reflection', 'CBT Tools', 'text', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_dream_text', 'dream_brief_text', 'Dream Brief Reflection (Text)', 'Dream Analysis', 'text', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_dream_voice', 'dream_brief_voice', 'Dream Brief Reflection (Voice)', 'Dream Analysis', 'voice', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0),
  ('srv_dream_pdf', 'dream_detailed_pdf', 'Dream Detailed Analysis PDF', 'Dream Analysis', 'pdf', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 49),
  ('srv_handwriting_pdf', 'handwriting_detailed_pdf', 'Handwriting Detailed PDF', 'Handwriting Analysis', 'pdf', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 49),
  ('srv_signature_pdf', 'signature_detailed_pdf', 'Signature Detailed PDF', 'Signature Analysis', 'pdf', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 49),
  ('srv_face_refl', 'face_brief_visual_reflection', 'Face Brief Visual Reflection', 'Face Analysis', 'vision', TRUE, 18, TRUE, 'gemini', 'gemini-2.5-flash', 0)
ON CONFLICT (id) DO NOTHING;

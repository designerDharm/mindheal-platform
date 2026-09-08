-- Migration 009: Screenings Table
CREATE TABLE IF NOT EXISTS screenings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  screening_type VARCHAR(64) NOT NULL, -- 'low_mood', 'anxiety', 'burnout', 'counsellor_match'
  status VARCHAR(32) DEFAULT 'started' CHECK (status IN ('started', 'completed')),
  score INTEGER,
  responses_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_screenings_user ON screenings(user_id);

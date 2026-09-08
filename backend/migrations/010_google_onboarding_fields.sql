-- Migration 010: Google Onboarding Completion, Verification States & Minor Guardian Consent
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'COMPLETED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_consent_status VARCHAR(50) DEFAULT 'APPROVED';

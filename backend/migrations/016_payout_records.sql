-- Migration 016: Durable Payout Records and Lifecycle Reconciliation
ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS listener_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS payout_type VARCHAR(32) NOT NULL DEFAULT 'mixed';
ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS payout_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES payout_batches(id) ON DELETE CASCADE,
  payout_type VARCHAR(32) NOT NULL CHECK (payout_type IN ('counsellor', 'peer_listener')),
  beneficiary_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed')),
  provider_transfer_id VARCHAR(128),
  idempotency_key VARCHAR(128) UNIQUE,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_records_batch ON payout_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_user ON payout_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_status ON payout_records(status);
CREATE INDEX IF NOT EXISTS idx_payout_records_idempotency ON payout_records(idempotency_key);

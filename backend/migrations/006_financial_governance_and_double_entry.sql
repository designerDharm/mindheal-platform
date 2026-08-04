-- Migration 006: Production-Grade Financial Governance, Double-Entry Accounting, Webhook Logging, and Payout Lifecycle

-- 1. Ledger Accounts Table
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  account_key VARCHAR(128) UNIQUE NOT NULL,
  owner_type VARCHAR(64) NOT NULL CHECK (owner_type IN ('user', 'counsellor', 'platform', 'gateway', 'system')),
  owner_id TEXT NOT NULL,
  account_type VARCHAR(64) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  allow_negative BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Journal Transactions Table (Balanced Master Journal)
CREATE TABLE IF NOT EXISTS journal_transactions (
  id TEXT PRIMARY KEY,
  journal_type VARCHAR(64) NOT NULL,
  business_reference_type VARCHAR(64),
  business_reference_id TEXT,
  idempotency_key VARCHAR(128) UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  description TEXT,
  reversal_of_journal_id TEXT REFERENCES journal_transactions(id),
  metadata JSONB DEFAULT '{}',
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Double-Entry Ledger Entries Table
CREATE TABLE IF NOT EXISTS double_entry_ledger (
  id TEXT PRIMARY KEY,
  journal_transaction_id TEXT NOT NULL REFERENCES journal_transactions(id) ON DELETE CASCADE,
  ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  entry_side VARCHAR(8) NOT NULL CHECK (entry_side IN ('debit', 'credit')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Booking Quotes Snapshot Table (10% BPS Commission & Price Guarantee)
CREATE TABLE IF NOT EXISTS booking_quotes (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  counsellor_id TEXT NOT NULL REFERENCES counsellors(id),
  gross_amount_paise BIGINT NOT NULL,
  commission_rate_bps INTEGER NOT NULL DEFAULT 1000, -- Exactly 10% (1000 Basis Points)
  commission_amount_paise BIGINT NOT NULL,
  counsellor_earning_paise BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  commission_policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0_10BPS',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payment Gateway Webhook Events Table (Exactly-Once Fulfilment)
CREATE TABLE IF NOT EXISTS payment_gateway_events (
  id TEXT PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  gateway VARCHAR(64) NOT NULL DEFAULT 'razorpay',
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'duplicate', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Counsellor Weekly Payout Batches Table
CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  batch_reference VARCHAR(128) UNIQUE NOT NULL,
  total_gross_paise BIGINT NOT NULL,
  total_commission_paise BIGINT NOT NULL,
  total_payout_paise BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'paid', 'failed')),
  counsellor_count INTEGER NOT NULL DEFAULT 0,
  executed_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Indexes for high-performance financial queries
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_owner ON ledger_accounts(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_double_entry_journal ON double_entry_ledger(journal_transaction_id);
CREATE INDEX IF NOT EXISTS idx_double_entry_account ON double_entry_ledger(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_booking_quotes_user ON booking_quotes(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_gateway_events_status ON payment_gateway_events(status);

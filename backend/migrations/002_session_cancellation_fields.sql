ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS availability_slot_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_failure_reason TEXT;

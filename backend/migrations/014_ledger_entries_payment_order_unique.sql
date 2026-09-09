-- Migration 014: Ensure exactly-once payment settlement via unique constraint on ledger entries for payment orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_payment_order_unique ON ledger_entries (reference_type, reference_id) WHERE reference_type = 'payment_order';

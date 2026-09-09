-- Migration 012: Ensure gateway_payment_id uniqueness among payment orders to prevent replay attacks
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_gateway_payment_id ON payment_orders (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

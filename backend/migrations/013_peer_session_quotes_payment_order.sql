-- Migration 013: Associate payment orders with session quotes and peer session requests
ALTER TABLE peer_session_quotes ADD COLUMN IF NOT EXISTS payment_order_id TEXT REFERENCES payment_orders(id);
ALTER TABLE peer_session_quotes ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS quote_id TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS peer_session_request_id TEXT;

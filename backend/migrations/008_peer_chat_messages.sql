-- Migration 008: Peer Chat Messages Table
CREATE TABLE IF NOT EXISTS peer_chat_messages (
  id TEXT PRIMARY KEY,
  peer_session_id TEXT NOT NULL REFERENCES peer_sessions(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_chat_messages_session ON peer_chat_messages(peer_session_id);

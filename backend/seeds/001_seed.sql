-- Seed configurations for local development and testing
TRUNCATE TABLE ledger_entries, wallets, sessions, availability_slots, counsellors, users, api_configurations, services_catalog CASCADE;

INSERT INTO users (id, role, full_name, email, mobile, language_code, password_hash)
VALUES
  ('usr_arjun', 'user', 'Arjun Kumar', 'arjun@example.com', '+919999999999', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_demo_user', 'user', 'Demo User', 'user@example.com', '+919999999998', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_counsellor_priya', 'counsellor', 'Dr. Priya Mehta', 'priya.counsellor@example.com', '+918888888888', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_counsellor_aarav', 'counsellor', 'Aarav Sen', 'aarav.counsellor@example.com', '+917777777777', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_counsellor_nisha', 'counsellor', 'Nisha Iyer', 'nisha.counsellor@example.com', '+916666666666', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_admin_dharm', 'admin', 'Designer Dharm', 'dharm@mindheal.com', '+919999999997', 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663'),
  ('usr_admin', 'admin', 'MindHeal Admin', 'admin@example.com', NULL, 'en', 'pbkdf2_sha256$120000$3ba64226f50db5fcf67a91863113b3df$2ce1e250c5d59182e3cafc848677e6a3b10f20e563671b32a549f46bcd4a4663')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO counsellors (
  id,
  user_id,
  account_type,
  display_name,
  bio,
  specializations,
  languages_spoken,
  experience_years,
  license_number,
  hourly_rate_inr,
  chat_enabled,
  audio_enabled,
  video_enabled,
  show_on_map,
  rating_avg,
  rating_count,
  verification_status
)
VALUES 
(
  'cns_priya',
  'usr_counsellor_priya',
  'individual',
  'Dr. Priya Mehta',
  'Clinical psychologist focused on CBT, anxiety, and relationship support.',
  ARRAY['Anxiety','CBT','Relationship Counselling'],
  ARRAY['en','hi','gu'],
  9,
  'MH-DEMO-001',
  900,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  4.9,
  120,
  'approved'
),
(
  'cns_aarav',
  'usr_counsellor_aarav',
  'individual',
  'Aarav Sen',
  'Trauma counsellor specializing in somatic experiencing and mindfulness strategies.',
  ARRAY['Trauma','Grief','Mindfulness'],
  ARRAY['en','hi','bn'],
  6,
  'MH-DEMO-002',
  750,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  4.8,
  80,
  'approved'
),
(
  'cns_nisha',
  'usr_counsellor_nisha',
  'individual',
  'Nisha Iyer',
  'CBT therapist focusing on burnout recovery, ADHD coaching, and stress management.',
  ARRAY['CBT','Burnout','ADHD'],
  ARRAY['en','ta','ml'],
  4,
  'MH-DEMO-003',
  650,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  4.7,
  55,
  'approved'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO availability_slots (id, counsellor_id, slot_date, start_time, end_time, session_type, is_booked)
VALUES
  ('slot_cns_priya_1', 'cns_priya', CURRENT_DATE, '16:00', '17:00', 'video', FALSE),
  ('slot_cns_priya_2', 'cns_priya', CURRENT_DATE + INTERVAL '1 day', '11:00', '12:00', 'video', FALSE),
  ('slot_cns_aarav_1', 'cns_aarav', CURRENT_DATE, '15:00', '16:00', 'video', FALSE),
  ('slot_cns_nisha_1', 'cns_nisha', CURRENT_DATE, '17:00', '18:00', 'video', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallets (id, owner_type, owner_id, currency, status)
VALUES
  ('wal_demo_user', 'user', 'usr_demo_user', 'INR', 'active'),
  ('wal_platform', 'platform', 'platform', 'INR', 'active'),
  ('wal_cns_priya', 'counsellor', 'usr_counsellor_priya', 'INR', 'active'),
  ('wal_cns_aarav', 'counsellor', 'usr_counsellor_aarav', 'INR', 'active'),
  ('wal_cns_nisha', 'counsellor', 'usr_counsellor_nisha', 'INR', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ledger_entries (id, wallet_id, direction, amount_paise, entry_type, created_at)
VALUES
  ('led_seed_credit', 'wal_demo_user', 'credit', 125000, 'seed_credit', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO api_configurations (id, service_name, aliases, provider, model_name, api_key_encrypted, system_prompt, is_active)
VALUES
  ('cfg_ai_chat', 'AI Counselling Chat', ARRAY['chat', 'ai-chat', 'ai-counselling'], 'Gemini', 'gemini-1.5-flash', '', 'Warm reflective mental wellness support.', FALSE),
  ('cfg_dream_pdf', 'Dream Analysis PDF Report', ARRAY['report_dream', 'report-dream', 'dream-analysis'], 'Gemini', 'gemini-1.5-pro', '', 'Reflective dream analysis, not diagnosis.', FALSE),
  ('cfg_google_maps', 'Google Maps', ARRAY['google-maps', 'maps'], 'Google', '', '', '', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services_catalog (id, name, category, is_active, is_free, price_paise)
VALUES
  ('svc_ai_chat', 'AI Counselling Chat', 'AI Support', TRUE, TRUE, 0),
  ('svc_dream', 'Dream Analysis PDF Report', 'Analysis Reports', TRUE, FALSE, 4900)
ON CONFLICT (id) DO NOTHING;

# MindHeal Database Schema

Production should use PostgreSQL as the primary source of truth. Realtime chat can use Firebase Realtime Database or a WebSocket-backed message store, but financial and identity-critical data should remain relational.

The backend already has SQL migrations in `backend/migrations` and a migration runner in `backend/scripts/run-migrations.mjs`. Apply schema files with:

```bash
cd backend
DATABASE_URL=postgresql://mindheal:mindheal@localhost:5432/mindheal npm run db:migrate
```

## Core Identity

```sql
users (
  id uuid primary key,
  firebase_uid varchar(128) unique,
  role varchar(32) not null check (role in ('user','counsellor','admin')),
  full_name varchar(255) not null,
  email varchar(255) unique,
  mobile varchar(20) unique,
  language_code varchar(10) default 'en',
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Counsellors

```sql
counsellors (
  id uuid primary key,
  user_id uuid references users(id),
  account_type varchar(32) check (account_type in ('individual','organisation')),
  display_name varchar(255) not null,
  bio text,
  specializations text[] not null,
  languages_spoken varchar(10)[] not null,
  experience_years int default 0,
  license_number varchar(100),
  has_prescription_auth boolean default false,
  hourly_rate_inr numeric(10,2) not null,
  per_minute_rate_inr numeric(8,2),
  chat_enabled boolean default true,
  audio_enabled boolean default false,
  video_enabled boolean default false,
  show_on_map boolean default false,
  verification_status varchar(32) default 'pending',
  created_at timestamptz default now()
);
```

## Wallet Ledger

Do not rely only on `wallet_balance` columns. Use immutable ledger entries.

```sql
wallets (
  id uuid primary key,
  owner_type varchar(32) check (owner_type in ('user','counsellor','platform')),
  owner_id uuid not null,
  currency char(3) default 'INR',
  status varchar(32) default 'active',
  created_at timestamptz default now()
);

ledger_entries (
  id uuid primary key,
  wallet_id uuid references wallets(id),
  direction varchar(8) check (direction in ('credit','debit')),
  amount_paise bigint not null check (amount_paise > 0),
  entry_type varchar(64) not null,
  reference_type varchar(64),
  reference_id uuid,
  idempotency_key varchar(128) unique,
  created_at timestamptz default now()
);

payment_orders (
  id uuid primary key,
  user_id uuid references users(id),
  gateway varchar(32) default 'razorpay',
  gateway_order_id varchar(255) unique,
  amount_paise bigint not null,
  status varchar(32) default 'created',
  created_at timestamptz default now()
);
```

## Sessions And Reports

```sql
sessions (
  id uuid primary key,
  user_id uuid references users(id),
  counsellor_id uuid references counsellors(id),
  session_type varchar(32) not null,
  service_type varchar(64) not null,
  status varchar(32) not null,
  scheduled_at timestamptz,
  duration_minutes int,
  amount_paise bigint,
  platform_commission_paise bigint,
  counsellor_earning_paise bigint,
  consent_record_id uuid,
  created_at timestamptz default now()
);

analysis_reports (
  id uuid primary key,
  user_id uuid references users(id),
  report_type varchar(32) check (report_type in ('dream','handwriting','signature')),
  input_text text,
  input_media_url text,
  voice_transcript text,
  ai_summary text not null,
  ai_full_report text,
  pdf_url text,
  is_pdf_unlocked boolean default false,
  ai_model_used varchar(100),
  prompt_version_id uuid,
  created_at timestamptz default now()
);
```

## Safety And Consent

```sql
consent_records (
  id uuid primary key,
  user_id uuid references users(id),
  consent_type varchar(64) not null,
  granted boolean not null,
  scope text,
  created_at timestamptz default now()
);

crisis_events (
  id uuid primary key,
  user_id uuid references users(id),
  source varchar(64) not null,
  risk_level varchar(32) not null,
  action_taken text not null,
  created_at timestamptz default now()
);
```

## Admin Configuration

```sql
api_configurations (
  id uuid primary key,
  service_name varchar(128) unique not null,
  provider varchar(64) not null,
  model_name varchar(128),
  api_key_encrypted text,
  system_prompt text,
  parameters jsonb,
  is_active boolean default true,
  updated_by uuid references users(id),
  updated_at timestamptz default now()
);
```

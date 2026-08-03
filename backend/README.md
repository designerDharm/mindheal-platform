# MindHeal Backend

This folder contains the backend foundation for the MindHeal web platform.

It is currently a dependency-light Node.js API using built-in HTTP modules so the route contracts can run immediately. Production can move the same controller/service structure to Express without changing the API surface.

## Run

```bash
cd backend
cp .env.example .env
npm run dev
```

API health check:

```txt
GET http://localhost:4000/api/v1/health
```

## Structure

```txt
src/
  app.js
  server.js
  config/
  controllers/
  data/
  repositories/
  routes/
  scripts/
  services/
  utils/
migrations/
seeds/
```

## Current Scope

Implemented route contracts:

- Auth and OTP flow with Redis-backed production storage
- Signed access and refresh token helpers
- Route-level role protection for user, counsellor, and admin APIs
- User profile and mood logs
- Counsellor listing and status
- Session booking and status changes
- AI chat mock response with crisis keyword detection
- Analysis report creation and unlock flow
- Private file uploads with signed URL refresh and delete endpoints
- Wallet balance, top-up, transactions, verified webhook receipt
- Admin users, counsellors, API config, services, transactions, analytics, audit logs, crisis events

## Data Layer

Controllers and services now use `src/repositories/index.js` instead of reading the local store directly. The active implementation is `src/repositories/memory`, which is useful for local development and API contract testing. The Postgres migration files are ready under `migrations/`, and production should replace the repository export with a Postgres implementation matching the same method names.

Run migrations against a local Postgres database:

```bash
cd backend
DATABASE_URL=postgresql://mindheal:mindheal@localhost:5432/mindheal npm run db:migrate
```

Run migrations plus seed data:

```bash
cd backend
DATABASE_URL=postgresql://mindheal:mindheal@localhost:5432/mindheal npm run db:seed
```

The migration runner uses the `psql` CLI and applies `migrations/*.sql` in filename order. Seeds are only applied when `--seed` is passed.

## Verification

Run syntax checks:

```bash
cd backend
npm run check
```

Run in-process API smoke tests:

```bash
cd backend
npm run test:smoke
```

The smoke test covers health, login, role protection, sanitized admin user responses, wallet balance, and dream analysis report creation.

## Production Requirements

Before launch:

- Set `REPOSITORY_DRIVER=postgres` and run `DATABASE_URL=... npm run db:migrate`.
- Configure `REDIS_URL` for OTP, refresh token rotation, logout revocation, and rate limits.
- Configure Firebase Admin credentials before enabling Firebase token login; local Firebase auth mocks require `FIREBASE_AUTH_MOCK_ENABLED=true`.
- Configure `FIREBASE_STORAGE_BUCKET` for private uploads. Clients should persist `storagePath` and call `POST /api/v1/upload/refresh-url` when a signed URL expires.
- Replace development JWT secrets with high-entropy `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values.
- Set exact `ALLOWED_ORIGINS`; wildcard origins are rejected in production.
- Replace mock Razorpay credentials with live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`; webhooks must preserve the exact raw request body.
- Configure `API_CONFIG_ENCRYPTION_KEY` for AES-GCM encrypted admin API key storage and rotate it through your secrets manager process.
- Configure Gemini/OpenAI provider keys and replace keyword-only safety classification before launch.
- Review audit logs and crisis events in the admin panel; crisis entries store hashes only, not raw detected text.

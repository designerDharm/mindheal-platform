# MindHeal Setup Guide

## 1. Local Preview

```bash
npx serve . -l 4173
```

Open `http://localhost:4173`.

## 2. Routes

```txt
#/                         Public homepage
#/services                 Public services page
#/for-counsellors          Counsellor marketing page
#/market                   Market/business page
#/contact                  Contact form
#/auth/user-login          User login
#/auth/user-signup         User signup
#/auth/counsellor-login    Counsellor login
#/auth/counsellor-signup   Counsellor signup
#/auth/admin-login         Admin login
#/panel/user               User panel
#/panel/counsellor         Counsellor panel
#/panel/admin              Admin panel
```

## 3. Source of Truth

Most product data is in:

```txt
src/data/mindheal-data.js
```

Do not duplicate services, counsellors, market stats, feature lists, or config text in individual screens.

## 4. Mock API

Form submissions use:

```txt
src/services/mock-api.js
```

This service now tries the local backend first:

```txt
http://localhost:4000/api/v1
```

If the backend is offline, it falls back to localStorage so the UI remains usable. To point the frontend at another backend in the browser console:

```js
localStorage.setItem("mindheal-api-base-url", "https://your-api.example.com/api/v1")
```

## 5. Production Backend Tasks

- Implement auth, OTP, Google login, JWT refresh, and role-based access.
- Implement PostgreSQL schema and migrations.
- Implement immutable wallet ledger and Razorpay webhook verification.
- Implement encrypted API configuration and prompt versioning.
- Implement AI safety classifier and crisis escalation logging.
- Implement Firebase/S3 uploads for report inputs, documents, and PDFs.
- Implement counselling booking, chat, calls, reviews, and payouts.

## 6. Backend Foundation

The backend scaffold is in:

```txt
backend/
```

Run it with:

```bash
cd backend
npm run dev
```

Health check:

```txt
GET http://localhost:4000/api/v1/health
```

Protected backend calls now require a signed access token. Login first:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!","role":"admin"}'
```

Then pass the returned token:

```txt
Authorization: Bearer <accessToken>
```

## 7. Database Setup

The backend has a repository boundary in:

```txt
backend/src/repositories/
```

Local development currently uses the memory repository. To initialize the production schema in Postgres, install the `psql` CLI and run:

```bash
cd backend
DATABASE_URL=postgresql://mindheal:mindheal@localhost:5432/mindheal npm run db:migrate
```

To also apply demo seed data:

```bash
cd backend
DATABASE_URL=postgresql://mindheal:mindheal@localhost:5432/mindheal npm run db:seed
```

The next backend milestone is implementing `backend/src/repositories/postgres` against the same repository contract used by the current memory implementation.

# MindHeal Web Platform

MindHeal is a web-first psychological wellness platform adapted from the mobile app product documents. It includes:

- Public website: homepage, services, counsellor landing page, market page, contact page.
- User panel: AI chat shell, counsellor booking, CBT tools, analysis reports, wallet, mood check-in.
- Counsellor panel: verification, sessions, availability, expert reviews, earnings.
- Admin panel: users, counsellor verification, AI config, service catalog, finance, CMS.

## Tech Stack

This first build is a dependency-light browser application:

- HTML, CSS, JavaScript modules
- Centralized source-of-truth data in `src/data/mindheal-data.js`
- Mock API/localStorage layer in `src/services/mock-api.js`
- Backend-ready documentation in `api-documentation.md` and `database-schema.md`

The production target from the source documents remains:

- Frontend: React/Next.js or equivalent web framework
- Backend: Node.js + Express
- Database: PostgreSQL + Redis
- Realtime: Firebase Realtime Database or WebSocket service
- Storage: Firebase Storage or S3-compatible storage
- Payments: Razorpay
- Calls: Agora or 100ms

## Run Locally

Open `index.html` directly in a browser, or run a static server:

```bash
npx serve . -l 4173
```

Then visit:

```txt
http://localhost:4173
```

Backend foundation:

```bash
cd backend
npm run dev
```

Backend health:

```txt
http://localhost:4000/api/v1/health
```

## Environment

Copy `.env.example` to `.env` when connecting backend services. Never commit `.env`.

## Folder Structure

```txt
assets/
  images/
  logos/
src/
  data/
  services/
  styles/
  utils/
backend/
admin-panel/
Documents and resources from claude/
```

## Known Limitations

- The current panels use localStorage mock data, not a live backend.
- Authentication is a demo flow only.
- Payment, AI, file upload, OTP, calls, and map integrations are represented as frontend-ready flows and documented contracts.
- Production must add server-side validation, immutable wallet ledger, real auth, encrypted API config, consent logs, and safety escalation.

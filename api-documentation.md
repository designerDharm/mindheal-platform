# MindHeal API Documentation

Base URL:

```txt
/api/v1
```

Local backend:

```txt
http://localhost:4000/api/v1
```

All protected routes require:

```txt
Authorization: Bearer <JWT>
```

Current protected route behavior:

- User routes require `user` unless explicitly noted.
- Counsellor self-management routes require `counsellor` or `admin`.
- Admin routes require `admin`.
- Public routes include health, contact, auth, public counsellor listing, counsellor detail, counsellor slots, and map listings.

## Auth

```txt
POST /auth/register
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/login
POST /auth/google
POST /auth/refresh-token
POST /auth/logout
POST /auth/counsellor/register
```

Example:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!","role":"user"}'
```

Local seed/demo credentials:

```txt
User: user@example.com / any non-empty password
Admin: admin@example.com / any non-empty password
```

New registrations must include a password, and backend-created accounts store only a password hash.

## User

```txt
GET    /user/me
PUT    /user/me
POST   /user/avatar
PUT    /user/language
GET    /user/notifications
POST   /user/mood/log
GET    /user/mood/history
DELETE /user/me
```

## Counsellors

```txt
GET    /counsellors
GET    /counsellors/:id
GET    /counsellors/:id/slots
GET    /counsellors/map
GET    /counsellors/me
PUT    /counsellors/me
POST   /counsellors/me/slots
DELETE /counsellors/me/slots/:id
PUT    /counsellors/me/status
```

## Sessions

```txt
POST /sessions/book
GET  /sessions/my
GET  /sessions/:id
PUT  /sessions/:id/cancel
PUT  /sessions/:id/accept
PUT  /sessions/:id/decline
GET  /sessions/:id/rtc-token
PUT  /sessions/:id/complete
POST /sessions/:id/review
```

## AI And Reports

```txt
POST /ai/chat
GET  /ai/chat/sessions
GET  /ai/chat/sessions/:id
POST /analysis/dream
POST /analysis/handwriting
POST /analysis/signature
GET  /analysis/reports
GET  /analysis/reports/:id
POST /analysis/reports/:id/unlock
GET  /analysis/reports/:id/pdf
```

Required production behavior:

- Run safety classification before AI response.
- Store prompt version and model used.
- Log crisis events and escalation actions.
- Never expose API keys to frontend.

## Wallet And Payments

```txt
GET  /wallet/balance
POST /wallet/topup/initiate
POST /wallet/topup/verify
GET  /wallet/transactions
POST /payments/webhook
GET  /wallet/counsellor/earnings
POST /wallet/counsellor/withdraw
```

Required production behavior:

- Payment success must come from verified backend/webhook.
- Ledger entries must be immutable.
- Use idempotency keys for all credit/debit operations.

## Admin

```txt
GET    /admin/users
PUT    /admin/users/:id/status
GET    /admin/counsellors
PUT    /admin/counsellors/:id/verify
PUT    /admin/counsellors/:id/prescription
GET    /admin/api-config
PUT    /admin/api-config/:service
POST   /admin/api-config/test
GET    /admin/services
POST   /admin/services
PUT    /admin/services/:id
DELETE /admin/services/:id
GET    /admin/transactions
POST   /admin/transactions/refund
GET    /admin/analytics/summary
POST   /admin/notifications/send
GET    /admin/audit-logs
```

The local backend currently implements the major contracts with a development store. Production should wire the same controller boundaries to PostgreSQL repositories and real authentication middleware.

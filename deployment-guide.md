# MindHeal Deployment Guide

## Static Frontend Preview

Any static host can serve this version:

- Netlify
- Vercel static output
- Firebase Hosting
- S3 + CloudFront

The entry file is:

```txt
index.html
```

## Production Recommended Architecture

```txt
Frontend website/panels  ->  CDN / Vercel / Firebase Hosting
Backend API              ->  Node.js on Cloud Run / EC2 / Render / Railway
PostgreSQL               ->  RDS / Cloud SQL / Supabase
Redis                    ->  Redis Cloud / ElastiCache
Storage                  ->  Firebase Storage / S3
Realtime chat            ->  Firebase Realtime DB / Socket.io
Payments                 ->  Razorpay with verified webhooks
Calls                    ->  Agora / 100ms
Monitoring               ->  Sentry + uptime checks
Analytics                ->  Privacy-aware product analytics
```

## Pre-Launch Checklist

- Point the frontend at the deployed backend with `mindheal-api-base-url`.
- Set `NODE_ENV=production`, strong JWT secrets, and exact `ALLOWED_ORIGINS`; wildcard CORS is rejected in production.
- Run backend syntax and test suites before release: `npm run check` and `npm test`.
- Run database migrations with `DATABASE_URL=... npm run db:migrate`; only run seeds in non-production.
- Use `REPOSITORY_DRIVER=postgres` with managed PostgreSQL.
- Set `REDIS_URL` for OTP storage, refresh-token rotation, logout revocation, and rate limiting.
- Configure Firebase Admin credentials plus `FIREBASE_STORAGE_BUCKET`; uploads are private and returned as short-lived signed URLs.
- Configure `STORAGE_SIGNED_URL_TTL_SECONDS` and use `/upload/refresh-url` when clients need a fresh file link.
- Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`; Razorpay webhooks must forward the exact raw body for HMAC verification.
- Generate `API_CONFIG_ENCRYPTION_KEY` with at least 32 bytes of entropy for encrypted admin-managed API keys.
- Review admin audit logs and crisis-event visibility after deployment; crisis entries expose hashes only, not raw user text.
- Add SEO sitemap and robots.txt.
- Run accessibility and responsive QA.
- Run security testing, upload lifecycle testing, and payment webhook replay testing.

## Production Environment Reference

```txt
NODE_ENV=production
PORT=4000
REPOSITORY_DRIVER=postgres
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
API_CONFIG_ENCRYPTION_KEY=<openssl rand -base64 48>
FIREBASE_STORAGE_BUCKET=your-private-bucket
FIREBASE_ADMIN_CREDENTIALS=<service-account-json-or-base64-json>
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
STORAGE_SIGNED_URL_TTL_SECONDS=900
```

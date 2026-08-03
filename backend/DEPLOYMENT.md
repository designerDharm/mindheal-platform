# Production Deployment Guide

This document outlines how to deploy the MindHeal backend infrastructure to a production environment.

## 1. Infrastructure Requirements

The backend relies on three primary components:
1. **Node.js Environment**: Runs the API server (v20+ recommended).
2. **PostgreSQL**: The primary relational database and Single Source of Truth.
3. **Redis**: Used for Session Management, Rate Limiting, and WebSocket (Socket.io) Pub/Sub scaling.

## 2. Environment Variables

Create a `.env` file in your production environment (or configure secrets in your hosting provider's dashboard) based on the provided `.env.example`.

**Crucial Variables:**
- `NODE_ENV=production` (Critical for performance and security)
- `REPOSITORY_DRIVER=postgres`: Enables the production PostgreSQL repositories.
- `DATABASE_URL`: Your production Postgres connection string.
- `REDIS_URL`: Your production Redis connection string.
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: Generate strong, cryptographically secure random strings.
- `ALLOWED_ORIGINS`: Comma-separated list of your production frontend URLs (e.g. `https://mindheal.com,https://counsellor.mindheal.com`).
- `API_CONFIG_ENCRYPTION_KEY`: 32+ bytes of entropy for encrypted admin-managed API keys.
- `FIREBASE_ADMIN_CREDENTIALS` and `FIREBASE_STORAGE_BUCKET`: Required for Firebase auth and private upload storage.
- `STORAGE_SIGNED_URL_TTL_SECONDS`: Signed upload URL lifetime; default is 900 seconds.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: Required for live top-ups and webhook verification.

## 3. Deployment Options

### Option A: Docker (Recommended)

The repository includes a `Dockerfile`. You can deploy this easily to any container platform (e.g. Google Cloud Run, AWS ECS, DigitalOcean App Platform, Render).

```bash
# Build the image
docker build -t mindheal-backend .

# Run the container
docker run -p 4000:4000 --env-file .env mindheal-backend
```

### Option B: Bare Metal / VPS (e.g., EC2, DigitalOcean Droplet)

1. Clone the repository to the server.
2. Run `npm ci --only=production`.
3. Use a process manager like `PM2` to keep the app running:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name "mindheal-api"
   ```
4. Setup Nginx as a reverse proxy forwarding port 80/443 to `localhost:4000`.

## 4. Database Migrations

Before starting the server, ensure your production database schema is up-to-date:

```bash
npm run db:migrate
```

*Note: Do not run `npm run db:seed` in production unless you explicitly want mock data.*

## 5. Production Verification

Run checks before promoting a release:

```bash
npm run check
npm test
```

Exercise these flows against the deployed API:

- Login, refresh, logout, and OTP verification with Redis online.
- Upload a file, persist `storagePath`, refresh it through `POST /api/v1/upload/refresh-url`, then delete it through `DELETE /api/v1/upload`.
- Razorpay webhook delivery with the exact raw request body; modified body payloads must fail signature verification.
- Admin audit logs and crisis events; crisis events should expose text hashes only.

## 6. Scaling WebSockets (Socket.io)

If you run multiple instances of the backend (horizontal scaling), the Socket.io instances need to communicate. You must configure the Socket.io Redis adapter.
The current codebase initializes sockets. In a multi-node production setup, ensure `REDIS_URL` is set, and consider adding the `@socket.io/redis-adapter` package to sync events across nodes.

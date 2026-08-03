# MindHeal Postgres Repository Notes

The app currently imports `repositories` from `src/repositories/index.js`, which points to the memory implementation by default. Set `REPOSITORY_DRIVER=postgres` only after the Postgres implementation is completed and the runtime has been adapted for async repository calls.

There are early Postgres repository sketches in this folder, but they are not active yet. Do not switch `src/repositories/index.js` to Postgres until every repository group below has been implemented and the controllers/services have been adapted for asynchronous database calls.

## Repository Groups

- `users`: identity, role lookup, profile updates
- `counsellors`: public listings, admin verification, map listings
- `counsellorApplications`: signup and verification workflow
- `moodLogs`: user mood check-ins
- `sessions`: booking, counsellor schedules, admin session views
- `reports`: dream, handwriting, and signature analysis reports
- `contacts`: contact form and support leads
- `wallets`, `paymentOrders`: financial state and immutable ledger entries
- `apiConfigurations`, `servicesCatalog`: admin-managed configuration and CMS/service content
- `auditLogs`, `analytics`: admin observability

## Implementation Contract

Keep controller and service code unaware of SQL details. Repository methods should return plain objects shaped like the current memory store responses, with sensitive fields such as `passwordHash` removed before they leave service/controller boundaries.

Use transactions for wallet writes, booking creation, counsellor payouts, admin verification changes, and payment webhook handling.

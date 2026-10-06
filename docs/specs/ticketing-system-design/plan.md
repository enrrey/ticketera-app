# Database and Stripe webhook implementation plan

Goal: implement the approved MER as PostgreSQL tables, relations, constraints and indexes, and accept signed Stripe events into a durable inbox.

Authorization: the user approved using spec.md and selecting an ORM with “ok procede”. This approval covers the database schema and webhook reception, not every pending product decision in the system design.

Architecture: Drizzle ORM with node-postgres, SQL migrations committed as artifacts, Next.js thin route delegating to payments. Money is integer cents, timestamps use timestamptz. Financial history uses restrictive deletes. Stripe events are stored as pending, never represented as fulfilled orders.

## Tasks

- [x] Install Drizzle, pg, Stripe and migration/test tooling; inspect existing database without printing credentials.
- [x] Define all MER tables in src/lib/db/schema.ts; add invoice linkage for Invoicing and promotion applicability to ticket types. Index foreign keys, lookup fields and unique external identifiers. Generate an additive initial migration.
- [x] Test migration against an isolated PostgreSQL-compatible database: referential integrity, invalid monetary/quantity values, single check-in, unique webhook and QR identifiers. Apply only after verifying target tables do not conflict.
- [x] Test and implement handleStripeWebhook(request): raw body signature verification, 400 on invalid signatures, durable insert with conflict handling, 503 on database failure, 200 only after persistence. No tickets, charges or transfers created by this endpoint yet.
- [x] Run typecheck, lint, full tests and migration verification; document commands and limitations.

## Verification results

- `npm run typecheck` and `npm run lint`: passed.
- `npm test -- --maxWorkers=1`: 14 files, 70 tests passed. Default parallel run timed out starting two workers; serial execution passed those files too.
- PGlite exercised the generated SQL and the real Drizzle inbox service before deployment; an initial composite-FK ordering defect was corrected before application.
- `npm run db:migrate`: successfully applied to the inspected, empty PostgreSQL target. `npm run db:inspect` confirmed 24 tables, 34 foreign keys, 86 indexes.
- `npm run db:generate -- --name=verification`: no schema changes.
- `node scripts/verify-webhook.mjs`: actual localhost HTTP rejection of unsigned requests, signed persistence and duplicate delivery passed; its synthetic row was removed.
- Fresh-context read-only review: no actionable findings in schema or inbox scope.
- Production dependency audit: zero vulnerabilities. The install reported four moderate advisories in development tooling; no unrelated dependency upgrades performed.

## Constraints and review focus

- Preserve unrelated working changes and every existing credential.
- Preserve guest orders with nullable user_id and historical buyer email.
- Do not claim inventory concurrency or payment fulfillment implemented by a schema alone.
- Do not silently replace existing tables; migration is initial/additive, never push/reset.
- Keep webhook pending data across process restarts; duplicate deliveries cannot create duplicate inbox entries.
- Migration rollback before commit is transactional. After application, no destructive down migration is run; use a reviewed forward fix or database backup restoration if needed.

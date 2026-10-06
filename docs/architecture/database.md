# PostgreSQL and Stripe webhook

Source: the MER in `docs/specs/ticketing-system-design/spec.md`, authorized by the user for this implementation. Drizzle ORM and `pg` connect to PostgreSQL using `DATABASE_URL`. Drizzle Kit loads `.env.local` then `.env`, preferring `DATABASE_URL_UNPOOLED` for migrations when provided.

`src/lib/db/schema.ts` defines 24 tables, with PostgreSQL foreign keys, unique identifiers, CHECK constraints and indexes. Besides the original MER it includes `promotion_ticket_type` for applicability and `invoice` to link Invoicing records to orders and payments. Money uses integer cents in PEN; dates use timestamptz. No financial records are deleted in cascade. A user role is an explicit assignment; no role is automatically privileged.

Commands:

```sh
npm run db:inspect
npm run db:generate
npm run db:migrate
npm test
```

For a live local endpoint check with a synthetic signed event, run `node scripts/verify-webhook.mjs` while Next.js is on port 3000. It verifies HTTP responses and durable duplicate handling, then removes only its own test event. It creates no Stripe resource or charge. On this Windows machine the full suite passed with `npm test -- --maxWorkers=1` (70 tests); default parallel workers had startup timeouts.

Initial migration applied and verified: 24 domain tables, 34 foreign keys, 86 indexes. TypeScript and ESLint passed; Drizzle reported no remaining schema changes.

Migrations are additive and versioned under `drizzle/`; do not use push/reset to replace an existing database. Test a migration before applying it, inspect the target first, and back up any populated target before future changes. The initial migration is transactional; no automatic destructive down migration is supplied. Schema changes are reproduced by Drizzle Kit snapshots.

## Webhook reception

`POST /api/webhooks/stripe` verifies the raw request body with Stripe's SDK and `STRIPE_WEBHOOK_SECRET`. It saves the provider event ID, object reference, event type, provider timestamp and mode in `webhook_event`, without copying buyer/card data. A unique `(provider, external_event_id)` index deduplicates deliveries across concurrent requests and application restarts. Persistence failure returns HTTP 503 for retry. Invalid or missing signatures return HTTP 400.

Valid persisted deliveries return HTTP 200 and remain `pending`. This endpoint is a durable inbox, not payment fulfillment. The worker that reconciles Stripe state, checks the reservation deadline, updates orders, emits tickets, sends email and performs refunds/settlements is a separate implementation still required. The frontend checkout remains a demonstration. No Stripe invoice is automatically issued; invoice policy and local fiscal requirements remain pending.

Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, copy that listener's signing secret into `.env`, and run Next.js on port 3000. Restart Next.js after changing environment variables. CLI signing secrets and Dashboard signing secrets belong to different endpoints.

The migration's constraints do not themselves implement inventory locking, sum-of-refunds limits, role authorization, promotion redemption limits, ticket quantity validation or cross-record settlement ownership. Those must be checked transactionally by domain services before production checkout is enabled.

References: [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new), [Stripe signature verification](https://docs.stripe.com/webhooks/signature).

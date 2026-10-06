// Real-concurrency check for checkout (spec CA-11, CA-12).
// Runs in a throwaway schema of the configured PostgreSQL: it never reads or writes real tables, and the schema is
// dropped even on failure. PGlite cannot prove this (single connection), so every buyer gets its own connection.
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { CheckoutError, createCheckout } from "../src/modules/checkout/services/createCheckout";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
// search_path is session state, which a transaction-mode pooler does not preserve: use the direct endpoint
// (Neon: the same host without "-pooler") unless an explicit unpooled URL is configured.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL.replace("-pooler.", ".");

const schema = `checkout_verify_${randomBytes(6).toString("hex")}`;
const safeName = /^checkout_verify_[0-9a-f]{12}$/;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [userId, venueId, eventId, sessionId, typeA, typeB, typeC] = [1, 2, 3, 4, 5, 6, 7].map(id);
const BUYERS = 40;

let failed = false;
const check = (label: string, ok: boolean, detail: unknown) => { console.log(`${ok ? "PASS" : "FAIL"} ${label} ${JSON.stringify(detail)}`); if (!ok) failed = true; };

function describeError(error: unknown) {
  const e = error as { code?: string; constraint?: string; detail?: string; table?: string; message?: string; cause?: unknown };
  const inner = (e?.cause ?? e) as typeof e;
  return { code: inner?.code ?? e?.code, constraint: inner?.constraint, table: inner?.table, detail: inner?.detail, message: inner?.message ?? e?.message };
}

async function outcomes(jobs: Promise<unknown>[]) {
  const tally: Record<string, number> = {};
  for (const result of await Promise.allSettled(jobs)) {
    const key = result.status === "fulfilled" ? "ok" : result.reason instanceof CheckoutError ? result.reason.code : `error:${describeError(result.reason).code ?? "unknown"}`;
    tally[key] = (tally[key] ?? 0) + 1;
  }
  return tally;
}

async function main() {
  const admin = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  const clients: pg.Client[] = [];
  try {
    await admin.connect();
    await admin.query(`create schema "${schema}"`);
    // One dedicated connection per concurrent buyer; search_path is awaited before any query runs on it.
    for (let i = 0; i < BUYERS; i += 1) {
      const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
      await client.connect();
      await client.query(`set search_path to "${schema}"`);
      clients.push(client);
    }
    for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) {
      // Migrations hard-code "public". foreign-key targets; retarget them so nothing in the temp schema can reference real tables.
      const statements = readFileSync(resolve("drizzle", file), "utf8").replaceAll('"public".', `"${schema}".`);
      if (/"public"|\bpublic\./i.test(statements)) throw new Error(`${file} still references the public schema; refusing to run`);
      await clients[0].query(statements);
    }
    const inSchema = (await clients[0].query("select count(*)::int as n from pg_tables where schemaname = $1", [schema])).rows[0].n;
    if (inSchema < 20) throw new Error(`Migrations did not land in the temporary schema (${inSchema} tables)`);
    await clients[0].query(`
      insert into "user" (id, clerk_user_id, email, name, identity_updated_at) values ('${userId}', 'verify', 'verify@example.com', 'Verify', now());
      insert into venue (id, name, address, city) values ('${venueId}', 'V', 'A', 'Lima');
      insert into event (id, slug, name, description, category, status, venue_id, organizer_id, created_by_id) values ('${eventId}', 'verify-event', 'E', 'd', 'concert', 'published', '${venueId}', '${userId}', '${userId}');
      insert into event_session (id, event_id, starts_at, ends_at) values ('${sessionId}', '${eventId}', now() + interval '10 days', now() + interval '10 days 2 hours');
      insert into ticket_type (id, event_id, name, price_cents, capacity, max_per_order, sales_start_at, sales_end_at) values
        ('${typeA}', '${eventId}', 'Scarce', 1000, 10, 6, now() - interval '1 day', now() + interval '5 days'),
        ('${typeB}', '${eventId}', 'Plenty', 1000, 1000, 6, now() - interval '1 day', now() + interval '5 days'),
        ('${typeC}', '${eventId}', 'Plenty 2', 1000, 1000, 6, now() - interval '1 day', now() + interval '5 days');
      insert into ticket_type_session (ticket_type_id, event_session_id, event_id) values ('${typeA}', '${sessionId}', '${eventId}'), ('${typeB}', '${sessionId}', '${eventId}'), ('${typeC}', '${sessionId}', '${eventId}');
    `);
    const buyWith = (index: number, ...types: string[]) => createCheckout(
      { eventId: "verify-event", items: types.map((ticketTypeId) => ({ ticketTypeId, quantity: 1 })), buyer: { email: "buyer@example.com", name: "Buyer" } },
      null, drizzle(clients[index]));
    const reservedUnits = async () => (await clients[0].query(`select coalesce(sum(r.quantity),0)::int as n from inventory_reservation r join order_item oi on oi.id = r.order_item_id where oi.ticket_type_id = '${typeA}' and r.status = 'active'`)).rows[0].n as number;

    // CA-11: 40 buyers race for 10 units.
    const race = await outcomes(Array.from({ length: BUYERS }, (_, i) => buyWith(i, typeA)));
    const afterRace = await reservedUnits();
    check("CA-11 exactly capacity succeeds", race.ok === 10 && race.insufficient_inventory === BUYERS - 10 && Object.keys(race).length === 2, race);
    check("CA-11 reserved units never exceed capacity", afterRace === 10, { reserved: afterRace, capacity: 10 });

    // CA-12: orders that request the same two (ample) types in opposite order must all succeed without deadlock.
    const crossing = await outcomes(Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? buyWith(i, typeB, typeC) : buyWith(i, typeC, typeB)));
    check("CA-12 opposite-order orders all succeed without deadlock", crossing.ok === 30 && Object.keys(crossing).length === 1, crossing);
    // Mixed: scarce + ample in both orders while the scarce type is already sold out must fail cleanly, never deadlock.
    const mixed = await outcomes(Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? buyWith(i, typeA, typeB) : buyWith(i, typeB, typeA)));
    check("CA-12 sold-out mixed orders fail cleanly and the scarce type stays within capacity", mixed.insufficient_inventory === 30 && (await reservedUnits()) === 10, mixed);
  } catch (error) {
    failed = true;
    console.error("Verification aborted:", JSON.stringify(describeError(error)));
  } finally {
    await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
    if (safeName.test(schema)) await admin.query(`drop schema if exists "${schema}" cascade`).catch(() => { console.error("Cleanup failed; drop schema manually:", schema); failed = true; });
    await admin.end().catch(() => undefined);
  }
  console.log(failed ? "RESULT: FAILED" : "RESULT: PASSED");
  process.exitCode = failed ? 1 : 0;
}

void main();

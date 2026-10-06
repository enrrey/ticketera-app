// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { persistStripeEvent } from "@/modules/payments";

const database = new PGlite();
const client = drizzle(database);
const userId = "00000000-0000-0000-0000-000000000001";
const eventId = "00000000-0000-0000-0000-000000000002";
const typeId = "00000000-0000-0000-0000-000000000003";
const itemId = "00000000-0000-0000-0000-000000000004";
const ticketId = "00000000-0000-0000-0000-000000000005";

beforeAll(async () => {
  const folder = resolve("drizzle");
  for (const file of readdirSync(folder).filter((f) => f.endsWith(".sql")).sort()) {
    await database.exec(readFileSync(resolve(folder, file), "utf8"));
  }
  await database.exec(`
    insert into "user" (id, clerk_user_id, email, name, identity_updated_at) values ('${userId}', 'user_test', 'test@example.com', 'Test', now());
    insert into venue (id, name, address, city) values ('${userId}', 'Test', 'Test', 'Lima');
    insert into event (id, slug, name, description, category, venue_id, organizer_id, created_by_id) values ('${eventId}', 'test', 'Test', 'Test', 'music', '${userId}', '${userId}', '${userId}');
    insert into ticket_type (id, event_id, name, price_cents, capacity, sales_start_at, sales_end_at) values ('${typeId}', '${eventId}', 'General', 1000, 100, now(), now() + interval '1 day');
    insert into "order" (id, buyer_email, buyer_name, subtotal_cents, total_cents) values ('${userId}', 'guest@example.com', 'Guest', 1000, 1000);
    insert into order_item (id, order_id, ticket_type_id, quantity, unit_price_cents, total_cents) values ('${itemId}', '${userId}', '${typeId}', 1, 1000, 1000);
    insert into ticket (id, order_item_id, unit_number, qr_token_hash) values ('${ticketId}', '${itemId}', 1, 'opaque-test-hash');
  `);
}, 30_000);
afterAll(async () => database.close());

describe("initial migration integrity", () => {
  it("creates all domain tables with foreign keys and indexes", async () => {
    const tables = await database.query<{ count: number }>("select count(*)::int as count from pg_tables where schemaname='public'");
    expect(tables.rows[0].count).toBe(29);
    const constraints = await database.query<{ count: number }>("select count(*)::int as count from pg_constraint where contype='f'");
    expect(constraints.rows[0].count).toBeGreaterThan(30);
    const indexes = await database.query<{ indexname: string }>("select indexname from pg_indexes where schemaname='public'");
    expect(indexes.rows.map((r) => r.indexname)).toContain("order_guest_email_idx");
  });
  it("allows a guest order and prevents deleting referenced financial identities", async () => {
    const order = await database.query<{ user_id: string | null }>(`select user_id from "order" where id='${userId}'`);
    expect(order.rows[0].user_id).toBeNull();
    await expect(database.exec(`delete from "user" where id='${userId}'`)).rejects.toThrow();
  });
  it("rejects invalid money and quantity", async () => {
    await expect(database.exec(`update ticket_type set price_cents=-1 where id='${typeId}'`)).rejects.toThrow();
    await expect(database.exec(`update order_item set quantity=0 where id='${itemId}'`)).rejects.toThrow();
    await expect(database.exec(`update "order" set total_cents=999 where id='${userId}'`)).rejects.toThrow();
  });
  it("gives a reservation exactly fifteen minutes", async () => {
    await database.exec(`insert into inventory_reservation (order_item_id, quantity) values ('${itemId}', 1)`);
    const result = await database.query<{ seconds: number }>("select extract(epoch from expires_at-created_at)::int as seconds from inventory_reservation");
    expect(result.rows[0].seconds).toBe(900);
  });
  it("prevents issuing the same unit twice and reusing a QR hash", async () => {
    await expect(database.exec(`insert into ticket (order_item_id, unit_number, qr_token_hash) values ('${itemId}', 1, 'another-hash')`)).rejects.toThrow();
    await expect(database.exec(`insert into ticket (order_item_id, unit_number, qr_token_hash) values ('${itemId}', 2, 'opaque-test-hash')`)).rejects.toThrow();
  });
  it("prevents a second check-in even for another day", async () => {
    await database.exec(`insert into check_in (ticket_id, event_id, scanned_by_id) values ('${ticketId}', '${eventId}', '${userId}')`);
    await expect(database.exec(`insert into check_in (ticket_id, event_id, scanned_by_id) values ('${ticketId}', '${eventId}', '${userId}')`)).rejects.toThrow();
  });
  it("rejects sessions from a different event for a ticket type", async () => {
    await database.exec(`insert into event (id, slug, name, description, category, venue_id, organizer_id, created_by_id) values ('${typeId}', 'other', 'Other', 'Test', 'music', '${userId}', '${userId}', '${userId}');
      insert into event_session (id, event_id, starts_at, ends_at) values ('${userId}', '${typeId}', now(), now()+interval '1 hour');`);
    await expect(database.exec(`insert into ticket_type_session (ticket_type_id, event_session_id, event_id) values ('${typeId}', '${userId}', '${eventId}')`)).rejects.toThrow();
  });
  it("durably deduplicates Stripe deliveries through the actual inbox service", async () => {
    const event = { provider: "stripe", externalEventId: "evt_duplicate", type: "payment_intent.succeeded", status: "pending", objectId: "pi_test", livemode: false, providerCreatedAt: new Date() };
    expect(await persistStripeEvent(event, client)).toBe(true);
    expect(await persistStripeEvent(event, client)).toBe(false);
    const rows = await database.query<{ count: number }>("select count(*)::int as count from webhook_event where external_event_id='evt_duplicate'");
    expect(rows.rows[0].count).toBe(1);
  });
});

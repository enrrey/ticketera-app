// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { AccessUser } from "@/modules/identity-access/types";
import { listDatabaseEvents, handleEventListing } from "./eventListing";
import { seedMockEvents } from "./eventSeed";
const state = vi.hoisted(() => ({ actor: null as AccessUser | null }));
vi.mock("@/modules/identity-access", () => ({ getCurrentAccessUser: async () => state.actor, AccessError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/db", () => ({ getDatabase: () => database }));
const pg = new PGlite();
const database = drizzle(pg);
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const actor: AccessUser = { id: owner, clerkUserId: "owner", email: "owner@example.com", name: "Owner", status: "active", roles: ["organizer"], permissions: ["events.manage"], overrides: {} };
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
  await pg.exec(`insert into "user" (id,clerk_user_id,email,name,identity_updated_at) values ('${owner}','owner','owner@example.com','Owner',now()),('${other}','other','other@example.com','Other',now()); insert into role(name) values ('organizer') on conflict do nothing; insert into user_role(user_id,role_id) select '${owner}',id from role where name='organizer'`);
  await seedMockEvents(database, owner);
  await pg.exec(`update event set organizer_id='${other}' where slug='mana'; update event set status='published' where slug='zayn';
    insert into ticket_type(event_id,name,price_cents,capacity,sales_start_at,sales_end_at) select id,'General',case when slug='zayn' then 10000 else 30000 end,100,now(),now()+interval '1 day' from event where slug in ('zayn','mana');
    insert into "order" (id,buyer_email,buyer_name,status,subtotal_cents,total_cents) values ('00000000-0000-0000-0000-000000000010','buyer@example.com','Buyer','partially_refunded',40000,40000);
    insert into order_item(order_id,ticket_type_id,quantity,unit_price_cents,total_cents) select '00000000-0000-0000-0000-000000000010',id,1,price_cents,price_cents from ticket_type;
    insert into payment(id,order_id,idempotency_key,amount_cents,status) values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000010','paid',40000,'partially_refunded');
    insert into payment(order_id,idempotency_key,amount_cents,status) values ('00000000-0000-0000-0000-000000000010','failed',40000,'failed');
    insert into refund(payment_id,idempotency_key,amount_cents,status,reason) values ('00000000-0000-0000-0000-000000000011','refund',8000,'succeeded','Test'),('00000000-0000-0000-0000-000000000011','refund_pending',2000,'pending','Test');
    insert into ticket(order_item_id,unit_number,qr_token_hash,status) select id,1,id::text,'valid' from order_item;`);
}, 60_000);
afterAll(async () => pg.close());
it("lists only published events publicly without sales data", async () => {
  await pg.exec(`update event set seating_layout='{"enabled":true,"template":"stadium","stagePosition":"south"}'::jsonb where slug='zayn'; update ticket_type set map_position='east' where event_id=(select id from event where slug='zayn')`);
  const rows = await listDatabaseEvents("public", null, database);
  expect(rows).toHaveLength(1); expect(rows[0].id).toBe("zayn");
  expect(rows[0]).not.toHaveProperty("netRevenueCents"); expect(rows[0]).not.toHaveProperty("ticketsIssued");
  expect(rows[0].featured).toBe(false);
  expect(rows[0]).toMatchObject({seatingLayout:{enabled:true,template:"stadium",stagePosition:"south"},ticketOptions:[{mapPosition:"east"}]});
});
it("reads persisted highlights and never exposes highlighted drafts",async()=>{
  await pg.exec("update event set featured=true where slug in ('zayn','mana')");
  const rows=await listDatabaseEvents("public",null,database);
  expect(rows.map((event)=>event.id)).toEqual(["zayn"]);expect(rows[0].featured).toBe(true);
});
it("isolates organizer ownership and allocates mixed-event paid orders without duplicate totals", async () => {
  const own = await listDatabaseEvents("organizer", actor, database);
  expect(own).toHaveLength(13); expect(own.some((event) => event.id === "mana")).toBe(false);
  expect(own.find((event) => event.id === "zayn")).toMatchObject({ status: "published", ticketsIssued: 1, netRevenueCents: 8000 });
  const foreign = await listDatabaseEvents("organizer", { ...actor, id: other }, database);
  expect(foreign[0]).toMatchObject({ id: "mana", ticketsIssued: 1, netRevenueCents: 24000 });
  expect(await listDatabaseEvents("organizer", { ...actor, roles:["admin"] }, database)).toHaveLength(14);
});
it("requires a session, active staff role and events permission even for forged client queries", async () => {
  await expect(listDatabaseEvents("organizer", null, database)).rejects.toMatchObject({ status: 401 });
  for (const invalid of [{ ...actor, roles: ["customer"] as const }, { ...actor, permissions: [] }, { ...actor, status: "inactive" }]) await expect(listDatabaseEvents("organizer", invalid as AccessUser, database)).rejects.toMatchObject({ status: 403 });
  state.actor = null;
  expect((await handleEventListing(new Request("http://localhost/api/events?scope=organizer"))).status).toBe(401);
  state.actor = actor;
  expect((await handleEventListing(new Request(`http://localhost/api/events?scope=organizer&organizerId=${other}`))).status).toBe(400);
  const response = await handleEventListing(new Request("http://localhost/api/events?scope=organizer"));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await response.json()).some((event: { id: string }) => event.id === "mana")).toBe(false);
});

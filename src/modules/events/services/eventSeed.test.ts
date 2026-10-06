// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { seedMockEvents, buildMockEventSeedPlan } from "./eventSeed";

const memory = new PGlite();
const database = drizzle(memory);
const organizerId = "00000000-0000-0000-0000-000000000001";
const otherId = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  const folder = resolve("drizzle");
  for (const file of readdirSync(folder).filter((file) => file.endsWith(".sql")).sort()) {
    await memory.exec(readFileSync(resolve(folder, file), "utf8"));
  }
}, 30_000);

afterAll(async () => memory.close());

it("keeps all seeded sessions in the future even when original mock dates have expired", async () => {
  const now = new Date("2050-01-01T15:00:00Z");
  const plan = await buildMockEventSeedPlan(now);
  expect(plan.every((event) => event.sessions.every((session) => session.startsAt > now && session.endsAt > now))).toBe(true);
  expect(plan.find((event) => event.slug === "hombres-g")?.sessions).toHaveLength(2);
});

it("requires an existing active organizer and imports idempotent drafts without sale inventory", async () => {
  await expect(seedMockEvents(database, "")).rejects.toThrow("UUID");
  await expect(seedMockEvents(database, organizerId)).rejects.toThrow("Organizer must exist");
  await memory.exec(`insert into "user" (id, clerk_user_id, email, name, identity_updated_at) values ('${organizerId}', 'seed_test', 'seed@example.com', 'Seed', now())`);
  await expect(seedMockEvents(database, organizerId)).rejects.toThrow("organizer role");
  await memory.exec(`insert into role (name) values ('organizer') on conflict (name) do nothing; insert into user_role (user_id, role_id) select '${organizerId}', id from role where name='organizer'; update "user" set status='inactive' where id='${organizerId}'`);
  await expect(seedMockEvents(database, organizerId)).rejects.toThrow("active");
  expect((await memory.query("select * from event")).rows).toHaveLength(0);
  await memory.exec(`update "user" set status='active' where id='${organizerId}'; insert into venue (name,address,city) values ('Costa 21','Existing verified address','Lima')`);
  expect(await seedMockEvents(database, organizerId)).toEqual({ created: 14, skipped: 0 });
  const rows = (await memory.query<{ organizer_id: string; created_by_id: string; status: string; description: string }>("select * from event")).rows;
  expect(rows).toHaveLength(14);
  expect(rows.every((row) => row.organizer_id === organizerId && row.created_by_id === organizerId && row.status === "draft" && row.description.includes("provisional"))).toBe(true);
  const sessions = await memory.query<{ starts_at: Date; ends_at: Date }>("select starts_at,ends_at from event_session join event on event.id=event_session.event_id where slug='hombres-g' order by starts_at");
  expect(sessions.rows.map((row) => new Date(row.starts_at).toISOString())).toEqual(["2026-10-30T01:00:00.000Z", "2026-10-31T01:00:00.000Z"]);
  expect(sessions.rows.every((row) => new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime() === 10_800_000)).toBe(true);
  await memory.exec("update event set status='published' where slug='zayn'");
  expect(await seedMockEvents(database, organizerId)).toEqual({ created: 0, skipped: 14 });
  expect((await memory.query("select * from venue")).rows).toHaveLength(6);
  expect((await memory.query("select * from event_session")).rows).toHaveLength(15);
  expect((await memory.query<{ address: string }>("select address from venue where name='Costa 21'")).rows[0].address).toBe("Existing verified address");
  expect((await memory.query<{ status: string }>("select status from event where slug='zayn'")).rows[0].status).toBe("published");
  for (const table of ["ticket_type", "ticket_type_session", "inventory_reservation", "ticket"]) {
    expect((await memory.query(`select * from ${table}`)).rows).toHaveLength(0);
  }
  await memory.exec(`insert into "user" (id,clerk_user_id,email,name,identity_updated_at) values ('${otherId}','other_seed','other@example.com','Other',now()); insert into user_role (user_id,role_id) select '${otherId}',id from role where name='organizer'; delete from event_session where event_id=(select id from event where slug='zayn'); delete from event where slug='zayn'`);
  await expect(seedMockEvents(database, otherId)).rejects.toThrow("another organizer");
  // Zayn would have been inserted before Maná's collision; the transaction rolls it back.
  expect((await memory.query("select * from event where slug='zayn'")).rows).toHaveLength(0);
}, 30_000);


it("randomly assigns new drafts among the selected organizers and keeps assignments on rerun", async () => {
  await memory.exec("delete from event_session; delete from event;");
  let index = 0;
  expect(await seedMockEvents(database, [organizerId, otherId], () => index++ % 2 ? 0.75 : 0.25)).toEqual({ created: 14, skipped: 0 });
  const before = (await memory.query<{ id: string; organizer_id: string }>("select id,organizer_id from event order by slug")).rows;
  expect(before.filter((row) => row.organizer_id === organizerId)).toHaveLength(7);
  expect(before.filter((row) => row.organizer_id === otherId)).toHaveLength(7);
  expect(await seedMockEvents(database, [organizerId, otherId], () => 0)).toEqual({ created: 0, skipped: 14 });
  expect((await memory.query("select id,organizer_id from event order by slug")).rows).toEqual(before);
}, 30_000);

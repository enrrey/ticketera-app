// Test-only helper: an in-memory PostgreSQL with every migration applied. Never imported by app code.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

export const ids = {
  user: "00000000-0000-4000-8000-0000000000a1",
  inactiveUser: "00000000-0000-4000-8000-0000000000a2",
  venue: "00000000-0000-4000-8000-0000000000b1",
  event: "00000000-0000-4000-8000-0000000000c1",
  otherEvent: "00000000-0000-4000-8000-0000000000c2",
  draftEvent: "00000000-0000-4000-8000-0000000000c3",
  session: "00000000-0000-4000-8000-0000000000d1",
  pastSession: "00000000-0000-4000-8000-0000000000d2",
  general: "00000000-0000-4000-8000-0000000000e1",
  vip: "00000000-0000-4000-8000-0000000000e2",
  closed: "00000000-0000-4000-8000-0000000000e3",
  upcoming: "00000000-0000-4000-8000-0000000000e4",
  pastEventType: "00000000-0000-4000-8000-0000000000e5",
  foreign: "00000000-0000-4000-8000-0000000000e6",
  draftType: "00000000-0000-4000-8000-0000000000e7",
};

export async function createTestDatabase() {
  const pg = new PGlite();
  for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
  await pg.exec(`
    insert into "user" (id, clerk_user_id, email, name, identity_updated_at) values ('${ids.user}', 'u1', 'u1@example.com', 'U1', now());
    insert into "user" (id, clerk_user_id, email, name, status, identity_updated_at) values ('${ids.inactiveUser}', 'u2', 'u2@example.com', 'U2', 'inactive', now());
    insert into venue (id, name, address, city) values ('${ids.venue}', 'Venue', 'Addr', 'Lima');
    insert into event (id, slug, name, description, category, status, venue_id, organizer_id, created_by_id) values
      ('${ids.event}', 'main-event', 'Main', 'd', 'concert', 'published', '${ids.venue}', '${ids.user}', '${ids.user}'),
      ('${ids.otherEvent}', 'other-event', 'Other', 'd', 'concert', 'published', '${ids.venue}', '${ids.user}', '${ids.user}'),
      ('${ids.draftEvent}', 'draft-event', 'Draft', 'd', 'concert', 'draft', '${ids.venue}', '${ids.user}', '${ids.user}');
    insert into event_session (id, event_id, starts_at, ends_at) values
      ('${ids.session}', '${ids.event}', now() + interval '10 days', now() + interval '10 days 3 hours'),
      ('${ids.pastSession}', '${ids.otherEvent}', now() - interval '3 days', now() - interval '3 days' + interval '3 hours');
    insert into ticket_type (id, event_id, name, price_cents, capacity, max_per_order, sales_start_at, sales_end_at) values
      ('${ids.general}', '${ids.event}', 'General', 10000, 5, 4, now() - interval '1 day', now() + interval '5 days'),
      ('${ids.vip}', '${ids.event}', 'VIP', 25050, 3, 6, now() - interval '1 day', now() + interval '5 days'),
      ('${ids.closed}', '${ids.event}', 'Closed', 5000, 10, 6, now() - interval '5 days', now() - interval '1 day'),
      ('${ids.upcoming}', '${ids.event}', 'Upcoming', 5000, 10, 6, now() + interval '1 day', now() + interval '5 days'),
      ('${ids.pastEventType}', '${ids.otherEvent}', 'Past', 5000, 10, 6, now() - interval '1 day', now() + interval '5 days'),
      ('${ids.draftType}', '${ids.draftEvent}', 'Draft type', 5000, 10, 6, now() - interval '1 day', now() + interval '5 days'),
      ('${ids.foreign}', '${ids.otherEvent}', 'Foreign', 5000, 10, 6, now() - interval '1 day', now() + interval '5 days');
    insert into ticket_type_session (ticket_type_id, event_session_id, event_id) values
      ('${ids.general}', '${ids.session}', '${ids.event}'), ('${ids.vip}', '${ids.session}', '${ids.event}'),
      ('${ids.closed}', '${ids.session}', '${ids.event}'), ('${ids.upcoming}', '${ids.session}', '${ids.event}'),
      ('${ids.pastEventType}', '${ids.pastSession}', '${ids.otherEvent}');
  `);
  return { pg, db: drizzle(pg) };
}

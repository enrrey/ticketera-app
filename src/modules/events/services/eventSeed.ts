import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getEvents } from "./eventsService";
import { events, eventSessions, roles, userRoles, users, venues } from "@/lib/db/schema";

export function validateOrganizerId(organizerId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizerId)) {
    throw new Error("An explicit organizer UUID is required");
  }
}

export async function buildMockEventSeedPlan(referenceDate = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(referenceDate);
  const tomorrow = new Date(`${today}T00:00:00Z`).getTime() + 86_400_000;
  return (await getEvents()).map((listing) => {
    const sessions: { startsAt: Date; endsAt: Date }[] = [];
    const first = new Date(`${listing.date}T00:00:00Z`);
    const last = new Date(`${listing.endDate ?? listing.date}T00:00:00Z`);
    if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || last < first) {
      throw new Error(`Invalid mock date range: ${listing.id}`);
    }
    const shift = Math.max(0, tomorrow - first.getTime());
    for (let day = first.getTime() + shift; day <= last.getTime() + shift; day += 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      sessions.push({ startsAt: new Date(`${date}T20:00:00-05:00`), endsAt: new Date(`${date}T23:00:00-05:00`) });
    }
    return {
      slug: listing.id, name: listing.title, category: listing.category,
      imageUrl: listing.imageUrl, venueName: listing.venue, city: listing.city, sessions,
      description: [listing.tour, listing.genre, "Borrador importado del catálogo mock. Horario provisional: 20:00–23:00 America/Lima, pendiente de confirmación. Dirección del recinto pendiente de confirmación. Precios, aforo y tipos de entrada pendientes de configuración.", listing.ticketUrl && `Referencia externa: ${listing.ticketUrl}`].filter(Boolean).join("\n"),
    };
  });
}

/** Explicitly invoked only; never creates identities or sale inventory. */
export async function seedMockEvents(database: PgDatabase<PgQueryResultHKT, Record<string, unknown>>, organizerIds: string | string[], random: () => number = Math.random) {
  const candidates = [...new Set(typeof organizerIds === "string" ? [organizerIds] : organizerIds)];
  if (!candidates.length) throw new Error("At least one organizer is required");
  candidates.forEach(validateOrganizerId);
  const plan = await buildMockEventSeedPlan();
  return database.transaction(async (tx) => {
    // Serialize this manual importer so simultaneous runs cannot duplicate venues/sessions.
    await tx.execute(sql`select pg_advisory_xact_lock(20260930, 14)`);
    for (const organizerId of candidates) {
      const [organizer] = await tx.select({ id: users.id }).from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(users.id, organizerId), eq(users.status, "active"), isNull(users.deletedAt), eq(roles.name, "organizer"))).limit(1);
    if (!organizer) throw new Error("Organizer must exist, be active and have the organizer role");
    }
    let created = 0;
    let skipped = 0;
    for (const entry of plan) {
      const [existing] = await tx.select().from(events).where(eq(events.slug, entry.slug)).limit(1);
      if (existing) {
        if (!candidates.includes(existing.organizerId)) throw new Error(`Event slug belongs to another organizer: ${entry.slug}`);
        skipped++;
        continue;
      }
      const organizerId = candidates[Math.floor(random() * candidates.length)];
      let [venue] = await tx.select({ id: venues.id }).from(venues)
        .where(and(eq(venues.name, entry.venueName), eq(venues.city, entry.city))).limit(1);
      if (!venue) [venue] = await tx.insert(venues).values({ name: entry.venueName, city: entry.city, address: "Pendiente de confirmación" }).returning({ id: venues.id });
      const [event] = await tx.insert(events).values({
        slug: entry.slug, name: entry.name, category: entry.category, description: entry.description,
        imageUrl: entry.imageUrl, venueId: venue.id, organizerId, createdById: organizerId, status: "draft",
      }).returning({ id: events.id });
      await tx.insert(eventSessions).values(entry.sessions.map((session) => ({ ...session, eventId: event.id })));
      created++;
    }
    return { created, skipped };
  });
}

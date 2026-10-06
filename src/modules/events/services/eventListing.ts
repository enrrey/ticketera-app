import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { events, venues } from "@/lib/db/schema";
import { AccessError, getCurrentAccessUser } from "@/modules/identity-access";
import type { AccessUser } from "@/modules/identity-access";
import type { Event, EventCategory, PublicTicketOption } from "../types";
import { managesAllEvents } from "./eventManagement";

export async function listDatabaseEvents(scope: "public" | "organizer", actor?: AccessUser | null, database: PgDatabase<PgQueryResultHKT, Record<string, unknown>> = getDatabase()): Promise<Event[]> {
  if (scope === "organizer") {
    if (!actor) throw new AccessError(401, "Debes iniciar sesión");
    if (actor.status !== "active" || !actor.roles.some((role) => ["organizer", "admin", "super_admin"].includes(role)) || !actor.permissions.includes("events.manage")) throw new AccessError(403, "No tienes permiso para consultar eventos");
  }
  const rows = await database.select({
    id: events.slug, title: events.name, category: events.category, imageUrl: events.imageUrl, venue: venues.name, city: venues.city, status: events.status,
    description:events.description,minimumAge:events.minimumAge,entryInstructions:events.entryInstructions,featured:events.featured,
    ticketOptions:sql<PublicTicketOption[]>`coalesce((select jsonb_agg(jsonb_build_object('id',tt.id,'name',tt.name,'zone',tt.zone,'seatingType',tt.seating_type,'description',tt.description,'priceCents',tt.price_cents,'capacity',tt.capacity,'maxPerOrder',tt.max_per_order,'peoplePerUnit',tt.people_per_unit,'seatRows',tt.seat_rows,'salesStartAt',tt.sales_start_at,'salesEndAt',tt.sales_end_at,'sessionDates',coalesce((select jsonb_agg(s.starts_at order by s.starts_at) from ticket_type_session ts join event_session s on s.id=ts.event_session_id where ts.ticket_type_id=tt.id),'[]'::jsonb)) order by tt.name,tt.id) from ticket_type tt where tt.event_id=${events.id}),'[]'::jsonb)`,
    date: sql<string | null>`(select to_char(min(starts_at) at time zone 'America/Lima', 'YYYY-MM-DD') from event_session where event_id=${events.id})`,
    endDate: sql<string | null>`(select to_char(max(starts_at) at time zone 'America/Lima', 'YYYY-MM-DD') from event_session where event_id=${events.id})`,
    price: sql<number | null>`(select min(price_cents)::float / 100 from ticket_type where event_id=${events.id})`,
    ...(scope === "organizer" ? {
      ticketsIssued: sql<number>`(select count(*)::int from ticket t join order_item oi on oi.id=t.order_item_id join ticket_type tt on tt.id=oi.ticket_type_id where tt.event_id=${events.id} and t.status in ('valid','used','refund_pending'))`,
      // Allocate captured payment totals and completed refunds by discounted line value.
      // This prevents an order containing several events from being counted in full for each.
      netRevenueCents: sql<number>`coalesce((select round(sum(oi.total_cents::numeric / nullif((select sum(all_items.total_cents) from order_item all_items where all_items.order_id=oi.order_id),0) * coalesce((select sum(p.amount_cents - coalesce((select sum(r.amount_cents) from refund r where r.payment_id=p.id and r.status='succeeded'),0)) from payment p where p.order_id=oi.order_id and p.status in ('succeeded','partially_refunded','refunded')),0)))::bigint from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id where tt.event_id=${events.id}),0)`,
    } : {}),
  }).from(events).innerJoin(venues, eq(venues.id, events.venueId)).where(scope === "public" ? eq(events.status, "published") : managesAllEvents(actor!) ? undefined : eq(events.organizerId, actor!.id)).orderBy(events.createdAt, events.slug);
  return rows.map((row) => ({ ...row, category: row.category as EventCategory, date: row.date ?? "", endDate: row.endDate ?? undefined, imageUrl: row.imageUrl || "/images/event-placeholder.svg", price: row.price === null ? null : Number(row.price), currency: "PEN",
    ...(scope === "organizer" ? { ticketsIssued: Number(row.ticketsIssued), netRevenueCents: Number(row.netRevenueCents) } : { status: undefined }),
  }));
}

export async function getPublishedEvent(slug: string) {
  return (await listDatabaseEvents("public")).find((event) => event.id === slug);
}

export async function handleEventListing(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "public";
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!["public", "organizer"].includes(scope) || [...url.searchParams.keys()].some((key) => key !== "scope")) return Response.json({ error: "Consulta inválida" }, { status: 400, headers });
  try {
    const actor = scope === "organizer" ? await getCurrentAccessUser() : null;
    return Response.json(await listDatabaseEvents(scope as "public" | "organizer", actor), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AccessError ? error.message : "No pudimos cargar los eventos" }, { status: error instanceof AccessError ? error.status : 503, headers });
  }
}

import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { events, inventoryReservations, orderItems, orderItemSeats, ticketTypes, seatHolds } from "@/lib/db/schema";
import { hashAccessToken } from './accessToken';

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
export const normalizeSeatLabel = (label: string) => label.trim().toLowerCase();
export const seatKey = (rowLabel: string, seatNumber: number) => JSON.stringify([normalizeSeatLabel(rowLabel), seatNumber]);

/** Mirrors inventory availability, including an expired hold awaiting Stripe reconciliation. */
export async function occupiedEventSeats(eventId: string, database: Database) {
  return database.select({ zone: ticketTypes.zone, rowLabel: orderItemSeats.rowLabel, seatNumber: orderItemSeats.seatNumber })
    .from(orderItemSeats).innerJoin(orderItems, eq(orderItems.id, orderItemSeats.orderItemId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId))
    .innerJoin(inventoryReservations, eq(inventoryReservations.orderItemId, orderItems.id))
    .where(and(eq(ticketTypes.eventId, eventId), sql`((${inventoryReservations.status} = 'converted' and not exists(select 1 from ticket t where t.order_item_id=${orderItems.id} and t.unit_number=${orderItemSeats.unitNumber} and t.status='refunded')) or (${inventoryReservations.status} = 'active' and (
      ${inventoryReservations.expiresAt} > now() or exists(select 1 from payment p join "order" o on o.id=p.order_id where p.order_id=${orderItems.orderId} and (o.status='pending' or exists(select 1 from refund rf where rf.payment_id=p.id and rf.reason='event_cancelled_before_payment' and rf.status<>'succeeded')))
    )))`));
}

export async function heldEventSeats(eventId:string,database:Database) {
  return database.select().from(seatHolds).where(and(eq(seatHolds.eventId,eventId),sql`${seatHolds.expiresAt}>clock_timestamp()`));
}

export async function getSeatAvailability(slug: string, database: Database = getDatabase(), ownerToken?:string|null) {
  const [event] = await database.select({ id: events.id }).from(events).where(and(eq(events.slug, slug), eq(events.status, "published"))).limit(1);
  if (!event) return null;
  const [types, seats, holds] = await Promise.all([
    database.select({ ticketTypeId: ticketTypes.id, zone: ticketTypes.zone }).from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), eq(ticketTypes.seatingType, "numbered"))),
    occupiedEventSeats(event.id, database),
    heldEventSeats(event.id,database),
  ]);
  const ownerHash=ownerToken?hashAccessToken(ownerToken):null;
  return types.map((type) => ({ ticketTypeId: type.ticketTypeId, occupied: [
    ...seats.filter((seat) => normalizeSeatLabel(seat.zone) === normalizeSeatLabel(type.zone)),
    ...holds.filter(hold=>hold.zoneKey===normalizeSeatLabel(type.zone)&&hold.ownerTokenHash!==ownerHash)
  ].map(({ rowLabel, seatNumber }) => ({ rowLabel, seatNumber })) }));
}

export async function handleGetSeatAvailability(slug: string,request?:Request) {
  try {
    const token=request?.headers.get('x-seat-hold-token');
    if(token&&!/^[a-zA-Z0-9_-]{32,128}$/.test(token)) return Response.json({error:'Token inválido'},{status:400});
    const database=getDatabase();
    const availability = await getSeatAvailability(slug,database,token);
    const [event]=availability?await database.select({id:events.id}).from(events).where(eq(events.slug,slug)):[];
    const holds=event&&token?(await heldEventSeats(event.id,database)).filter(hold=>hold.ownerTokenHash===hashAccessToken(token)):[];
    const items=[...new Set(holds.map(hold=>hold.ticketTypeId))].map(ticketTypeId=>({ticketTypeId,seats:holds.filter(hold=>hold.ticketTypeId===ticketTypeId).map(({rowLabel,seatNumber})=>({rowLabel,seatNumber}))}));
    const [clock]=await database.select({now:sql<Date>`clock_timestamp()`}).from(events).limit(1);
    return Response.json(availability ? { availability,own:holds.length?{items,expiresAt:new Date(Math.min(...holds.map(hold=>hold.expiresAt.getTime()))).toISOString()}:null,serverTime:new Date(clock?.now??Date.now()).toISOString() } : { error: "Evento no encontrado" }, { status: availability ? 200 : 404, headers: { "Cache-Control": "private, no-store",Vary:'x-seat-hold-token' } });
  } catch {
    return Response.json({ error: "No pudimos cargar los asientos" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

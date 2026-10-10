import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { events, inventoryReservations, orderItems, orderItemSeats, orders, ticketTypes,seatHolds } from "@/lib/db/schema";
import type { CreatedCheckout } from "../types";
import { generateAccessToken, hashAccessToken } from "./accessToken";
import { availableUnitsSql } from "./availability";
import type { CheckoutInput } from "./checkoutSchema";
import { normalizeSeatLabel, occupiedEventSeats, seatKey,heldEventSeats } from "./seatAvailability";
import {encryptBuyerDocument} from './buyerIdentity';

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
type Buyer = { id: string; status: string } | null;

export class CheckoutError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: { ticketTypeId: string; available: number }[]) {
    super(message);
  }
}

/**
 * Creates a pending order with a 10-minute inventory reservation in one transaction.
 * The event lock serializes seats shared by multiple ticket types or sessions.
 * Ticket types are then locked in ascending id order; availability is re-read
 * after the locks are held, so concurrent buyers can never oversell.
 */
export async function createCheckout(input: CheckoutInput, buyer: Buyer, database: Database = getDatabase()): Promise<CreatedCheckout> {
  if (buyer && buyer.status !== "active") throw new CheckoutError(403, "account_inactive", "Tu cuenta no puede comprar entradas");
  return database.transaction(async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(and(eq(events.slug, input.eventId), eq(events.status, "published"))).limit(1).for("update");
    if (!event) throw new CheckoutError(404, "not_found", "Evento no encontrado");

    const ids = input.items.map((item) => item.ticketTypeId).sort();
    const locked = await tx.select({
      id: ticketTypes.id, name: ticketTypes.name, priceCents: ticketTypes.priceCents, maxPerOrder: ticketTypes.maxPerOrder,
      seatingType: ticketTypes.seatingType, zone: ticketTypes.zone, seatRows: ticketTypes.seatRows,
      salesOpen: sql<boolean>`(${ticketTypes.salesStartAt} <= now() and ${ticketTypes.salesEndAt} > now())`,
      hasFutureSession: sql<boolean>`exists(select 1 from ticket_type_session tts join event_session es on es.id = tts.event_session_id where tts.ticket_type_id = ticket_type.id and es.ends_at > now())`,
    }).from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), inArray(ticketTypes.id, ids))).orderBy(ticketTypes.id).for("update");
    if (locked.length !== ids.length) throw new CheckoutError(404, "not_found", "Tipo de entrada no encontrado");

    const byId = new Map(locked.map((type) => [type.id, type]));
    const occupied = await occupiedEventSeats(event.id, tx);
    const held=await heldEventSeats(event.id,tx);
    const holdHash=input.seatHoldToken?hashAccessToken(input.seatHoldToken):null;
    const claimed = new Set(occupied.map((seat) => JSON.stringify([normalizeSeatLabel(seat.zone), seatKey(seat.rowLabel, seat.seatNumber)])));
    for(const seat of held.filter(seat=>seat.ownerTokenHash!==holdHash)) claimed.add(JSON.stringify([seat.zoneKey,seatKey(seat.rowLabel,seat.seatNumber)]));
    for (const item of input.items) {
      const type = byId.get(item.ticketTypeId)!;
      if (item.quantity > type.maxPerOrder) throw new CheckoutError(400, "invalid_quantity", `Máximo ${type.maxPerOrder} por compra para ${type.name}`);
      if (!type.salesOpen || !type.hasFutureSession) throw new CheckoutError(409, "sales_closed", `La venta de ${type.name} no está disponible`);
      if (type.seatingType !== "numbered") {
        if (item.seats?.length) throw new CheckoutError(400, "invalid_seats", "Esta entrada no tiene asientos numerados");
        continue;
      }
      if (item.seats?.length !== item.quantity) throw new CheckoutError(400, "invalid_seats", "Selecciona un asiento por entrada");
      const lineSeats = new Set<string>();
      for (const seat of item.seats) {
        const row = type.seatRows.find((row) => row.label === seat.rowLabel);
        const key = seatKey(seat.rowLabel, seat.seatNumber);
        if (!row || !Number.isInteger(seat.seatNumber) || seat.seatNumber < 1 || seat.seatNumber > row.seats || lineSeats.has(key)) throw new CheckoutError(400, "invalid_seats", "Revisa los asientos seleccionados");
        lineSeats.add(key);
        const physical = JSON.stringify([normalizeSeatLabel(type.zone), key]);
        if (claimed.has(physical)) throw new CheckoutError(409, "seat_unavailable", "Un asiento seleccionado ya está ocupado. Actualiza el mapa y elige otro.");
        if(holdHash&&!held.some(hold=>hold.ownerTokenHash===holdHash&&hold.ticketTypeId===type.id&&hold.rowLabel===seat.rowLabel&&hold.seatNumber===seat.seatNumber)) throw new CheckoutError(409,'hold_expired','La selección venció. Vuelve a elegir tus asientos.');
        claimed.add(physical);
      }
    }

    // New statement after the locks: READ COMMITTED sees reservations committed by the previous lock holder.
    const stock = await tx.select({ id: ticketTypes.id, available: availableUnitsSql(sql.raw("ticket_type.id"), sql.raw("ticket_type.capacity")) })
      .from(ticketTypes).where(inArray(ticketTypes.id, ids));
    const availability = new Map(stock.map((row) => [row.id, Number(row.available)]));
    const short = input.items.filter((item) => item.quantity > (availability.get(item.ticketTypeId) ?? 0))
      .map((item) => ({ ticketTypeId: item.ticketTypeId, available: availability.get(item.ticketTypeId) ?? 0 }));
    if (short.length > 0) throw new CheckoutError(409, "insufficient_inventory", "No hay cupo suficiente", short);

    const lines = input.items.map((item) => {
      const type = byId.get(item.ticketTypeId)!;
      return { ticketTypeId: type.id, name: type.name, quantity: item.quantity, unitPriceCents: type.priceCents, totalCents: item.quantity * type.priceCents, ...(item.seats?.length ? { seats: item.seats } : {}) };
    });
    const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
    const accessToken = buyer ? undefined : generateAccessToken();

    const [order] = await tx.insert(orders).values({
      userId: buyer?.id ?? null, buyerEmail: input.buyer.email, buyerName: input.buyer.name,
      buyerDocumentType: input.buyer.documentType ?? null,
      buyerDocumentEncrypted: input.buyer.documentNumber ? encryptBuyerDocument(input.buyer.documentNumber) : null,
      buyerPhone: input.buyer.phone ?? null,
      termsVersion: input.termsVersion ?? null, termsAcceptedAt: input.acceptedTerms ? sql`now()` : null,
      subtotalCents: totalCents, discountCents: 0, totalCents, accessTokenHash: accessToken ? hashAccessToken(accessToken) : null,
    }).returning({ id: orders.id });
    const items = await tx.insert(orderItems).values(lines.map((line) => ({
      orderId: order.id, ticketTypeId: line.ticketTypeId, quantity: line.quantity, unitPriceCents: line.unitPriceCents, discountCents: 0, totalCents: line.totalCents,
    }))).returning({ id: orderItems.id, ticketTypeId: orderItems.ticketTypeId });
    const assigned = items.flatMap((item) => (lines.find((line) => line.ticketTypeId === item.ticketTypeId)!.seats ?? []).map((seat, index) => ({ orderItemId: item.id, unitNumber: index + 1, ...seat })));
    if (assigned.length) await tx.insert(orderItemSeats).values(assigned);
    const reservations = await tx.insert(inventoryReservations).values(items.map((item) => ({
      orderItemId: item.id, quantity: lines.find((line) => line.ticketTypeId === item.ticketTypeId)!.quantity,
    }))).returning({ createdAt: inventoryReservations.createdAt, expiresAt: inventoryReservations.expiresAt });
    if(holdHash) await tx.delete(seatHolds).where(and(eq(seatHolds.eventId,event.id),eq(seatHolds.ownerTokenHash,holdHash)));

    // Reservation timestamps default to the transaction's now(), so created_at is the server clock.
    const { createdAt, expiresAt } = reservations[0];
    return {
      orderId: order.id, status: "pending", totalCents, currency: "pen",
      expiresAt: expiresAt.toISOString(), serverTime: createdAt.toISOString(), expired: false,
      items: lines, ...(accessToken ? { accessToken } : {}),
    };
  });
}

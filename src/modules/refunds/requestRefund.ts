import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { auditLogs, checkIns, events, eventSessions, orderItems, orders, payments, refunds, refundTickets, tickets, ticketTypes, ticketTypeSessions, users } from "@/lib/db/schema";
import { AccessError, getAccessUser, type AccessUser } from "@/modules/identity-access";
import type { PaymentDatabase } from "@/modules/payments/server";
import { ticketRefundAmount, withinRefundWindow } from "./refundPolicy";

const globalStaff = (actor: AccessUser) => actor.roles.some((role) => role === "admin" || role === "super_admin");
const refundStaff = (actor: AccessUser, organizerId: string) => actor.permissions.includes("refunds.manage") && (globalStaff(actor) || actor.roles.includes("organizer") && actor.id === organizerId);
async function lockActor(actorId: string, tx: PaymentDatabase) {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, actorId)).for("update");
  const actor = await getAccessUser(actorId, tx);
  if (actor.status !== "active") throw new AccessError(403, "Cuenta inactiva");
  return actor;
}

async function enqueueTickets(tx: PaymentDatabase, payment: typeof payments.$inferSelect, rows: { id: string; unitNumber: number; quantity: number; totalCents: number }[], reason: "customer_request" | "event_cancelled", actorId: string) {
  const allocated = rows.map((row) => ({ ticketId: row.id, amountCents: ticketRefundAmount(row.totalCents, row.quantity, row.unitNumber) }));
  const amountCents = allocated.reduce((sum, row) => sum + row.amountCents, 0);
  if (!amountCents) {
    // A free unit has no Stripe refund to issue, but is invalidated durably.
    await tx.update(tickets).set({ status: "refunded" }).where(inArray(tickets.id, rows.map((row) => row.id)));
    await tx.insert(auditLogs).values({ actorId, action: "ticket.free_refund", entity: "payment", entityId: payment.id });
    return { id: null, status: "succeeded", amountCents: 0 };
  }
  const existing = await tx.select({ amount: refunds.amountCents }).from(refunds).where(and(eq(refunds.paymentId, payment.id), sql`${refunds.status}<>'cancelled'`));
  if (existing.reduce((sum, row) => sum + row.amount, 0) + amountCents > payment.amountCents) throw new AccessError(409, "El reembolso supera el importe pagado");
  const id = randomUUID();
  const [refund] = await tx.insert(refunds).values({ id, paymentId: payment.id, amountCents, reason, idempotencyKey: `ticketera:refund:${id}` }).returning();
  await tx.insert(refundTickets).values(allocated.map((row) => ({ refundId: id, ...row })));
  await tx.update(tickets).set({ status: "refund_pending" }).where(inArray(tickets.id, rows.map((row) => row.id)));
  await tx.insert(auditLogs).values({ actorId, action: "refund.requested", entity: "refund", entityId: id, metadata: { reason, ticketCount: rows.length, amountCents } });
  return { id: refund.id, status: refund.status, amountCents };
}

export async function requestTicketRefund(actorId: string, ticketId: string, database: PaymentDatabase = getDatabase(), now = new Date()) {
  return database.transaction(async (tx) => {
    const actor = await lockActor(actorId, tx);
    const [reference] = await tx.select({ eventId: ticketTypes.eventId, orderId: orderItems.orderId, typeId: ticketTypes.id }).from(tickets)
      .innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId)).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).where(eq(tickets.id, ticketId));
    if (!reference) throw new AccessError(404, "Entrada no encontrada");
    const [event] = await tx.select().from(events).where(eq(events.id, reference.eventId)).for("update");
    const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
    if (order.userId !== actor.id && !refundStaff(actor, event.organizerId)) throw new AccessError(403, "No tienes permiso para solicitar este reembolso");
    const [ticket] = await tx.select({ id: tickets.id, status: tickets.status, unitNumber: tickets.unitNumber, quantity: orderItems.quantity, totalCents: orderItems.totalCents }).from(tickets)
      .innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId)).where(eq(tickets.id, ticketId)).for("update", { of: tickets });
    const [previous] = await tx.select({ id: refunds.id, status: refunds.status, amountCents: refunds.amountCents }).from(refundTickets).innerJoin(refunds, eq(refunds.id, refundTickets.refundId)).where(eq(refundTickets.ticketId, ticketId));
    if (previous) return previous;
    const [used] = await tx.select({ id: checkIns.id }).from(checkIns).where(eq(checkIns.ticketId, ticketId));
    if (used || ticket.status !== "valid" || !["paid", "partially_refunded"].includes(order.status)) throw new AccessError(409, "Esta entrada no permite reembolso");
    const assigned = await tx.select({ startsAt: eventSessions.startsAt }).from(ticketTypeSessions).innerJoin(eventSessions, eq(eventSessions.id, ticketTypeSessions.eventSessionId)).where(eq(ticketTypeSessions.ticketTypeId, reference.typeId)).orderBy(eventSessions.startsAt);
    const sessions = assigned.length ? assigned : await tx.select({ startsAt: eventSessions.startsAt }).from(eventSessions).where(eq(eventSessions.eventId, event.id)).orderBy(eventSessions.startsAt);
    if (!sessions.length || !withinRefundWindow(sessions[0].startsAt, now)) throw new AccessError(409, "Solo se permiten reembolsos hasta 48 horas antes del inicio");
    const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, order.id), inArray(payments.status, ["succeeded", "partially_refunded"]), eq(payments.amountCents, order.totalCents), eq(payments.currency, order.currency))).for("update");
    if (!payment?.stripePaymentIntentId) throw new AccessError(409, "Pago canónico no disponible para reembolso");
    return enqueueTickets(tx, payment, [ticket], "customer_request", actor.id);
  });
}

export async function requestCancelEvent(actorId: string, eventId: string, database: PaymentDatabase = getDatabase()) {
  return database.transaction(async (tx) => {
    const actor = await lockActor(actorId, tx);
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
    if (!event) throw new AccessError(404, "Evento no encontrado");
    if (!actor.permissions.includes("events.manage") || !refundStaff(actor, event.organizerId)) throw new AccessError(403, "No tienes permiso para cancelar este evento");
    if (event.status === "completed") throw new AccessError(409, "Un evento finalizado conserva su historial y no se puede cancelar");
    await tx.update(events).set({ status: "cancelled", updatedAt: new Date() }).where(eq(events.id, event.id));
    const references = await tx.selectDistinct({ orderId: orderItems.orderId }).from(orderItems).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).where(eq(ticketTypes.eventId, event.id)).orderBy(orderItems.orderId);
    let queued = 0;
    for (const reference of references) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
      // Pending reservations stay intact until Stripe expiry/payment reconciliation.
      if (order.status === "pending") continue;
      if (!["paid", "partially_refunded"].includes(order.status)) continue;
      const purchasedLines = await tx.select({ id: orderItems.id, quantity: orderItems.quantity }).from(orderItems)
        .innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).where(and(eq(orderItems.orderId, order.id), eq(ticketTypes.eventId, event.id)));
      const issued = await tx.select({ itemId: tickets.orderItemId, unitNumber: tickets.unitNumber }).from(tickets).where(inArray(tickets.orderItemId, purchasedLines.map((line) => line.id)));
      if (purchasedLines.some((line) => {
        const units = new Set(issued.filter((ticket) => ticket.itemId === line.id).map((ticket) => ticket.unitNumber));
        return units.size !== line.quantity || [...units].some((unit) => unit < 1 || unit > line.quantity);
      })) throw new AccessError(409, "Un pedido pagado requiere reconciliar su pago y emitir todas las entradas antes de cancelar");
      const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, order.id), inArray(payments.status, ["succeeded", "partially_refunded"]), eq(payments.amountCents, order.totalCents), eq(payments.currency, order.currency))).for("update");
      if (!payment?.stripePaymentIntentId) throw new AccessError(409, "Un pedido no tiene pago canónico para reembolso");
      const selected = await tx.select({ id: tickets.id, unitNumber: tickets.unitNumber, quantity: orderItems.quantity, totalCents: orderItems.totalCents }).from(tickets)
        .innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId)).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId))
        .where(and(eq(orderItems.orderId, order.id), eq(ticketTypes.eventId, event.id), inArray(tickets.status, ["valid", "used"]))).orderBy(tickets.id).for("update", { of: tickets });
      if (selected.length) { await enqueueTickets(tx, payment, selected, "event_cancelled", actor.id); queued++; }
    }
    await tx.insert(auditLogs).values({ actorId, action: "event.cancelled_refunds_queued", entity: "event", entityId: event.id, metadata: { queued } });
    return { eventId: event.id, status: "cancelled", queued };
  });
}

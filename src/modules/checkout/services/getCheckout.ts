import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { inventoryReservations, invoices, orderItems, orderItemSeats, orders, payments, refunds, ticketTypes } from "@/lib/db/schema";
import type { CheckoutSummary } from "../types";
import { accessTokenMatches } from "./accessToken";

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Order summary for its owner (session) or a guest holding the access token.
 * Returns null — never a reason — when the order is missing or access is not proven.
 */
export async function getCheckout(
  orderId: string,
  access: { userId: string | null; token: string | null },
  database: Database = getDatabase(),
): Promise<CheckoutSummary | null> {
  if (!uuidPattern.test(orderId)) return null;
  const [order] = await database.select({
    id: orders.id, userId: orders.userId, status: orders.status, totalCents: orders.totalCents, currency: orders.currency,
    accessTokenHash: orders.accessTokenHash, confirmationTokenHash: orders.confirmationTokenHash, serverTime: sql<Date>`now()`,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const isOwner = order.userId !== null && access.userId === order.userId;
  if (!isOwner && !(access.token && (accessTokenMatches(access.token, order.accessTokenHash) || accessTokenMatches(access.token, order.confirmationTokenHash)))) return null;

  const rows = await database.select({
    orderItemId: orderItems.id,
    ticketTypeId: orderItems.ticketTypeId, name: ticketTypes.name, quantity: orderItems.quantity,
    unitPriceCents: orderItems.unitPriceCents, totalCents: orderItems.totalCents, expiresAt: inventoryReservations.expiresAt,
  }).from(orderItems).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId))
    .innerJoin(inventoryReservations, eq(inventoryReservations.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, order.id)).orderBy(ticketTypes.name, orderItems.id);
  if (rows.length === 0) return null;
  const assignedSeats = await database.select().from(orderItemSeats).where(inArray(orderItemSeats.orderItemId, rows.map((row) => row.orderItemId))).orderBy(orderItemSeats.unitNumber);

  const expiresAt = new Date(Math.max(...rows.map((row) => row.expiresAt.getTime())));
  const serverTime = new Date(order.serverTime);
  const [refund] = await database.select({ status: refunds.status,reason:refunds.reason }).from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(and(eq(payments.orderId, order.id), inArray(refunds.reason, ["late_payment", "inventory_unavailable",'event_cancelled_before_payment']))).limit(1);
  const [invoice] = await database.select({ hostedUrl: invoices.hostedInvoiceUrl, pdfUrl: invoices.invoicePdfUrl }).from(invoices)
    .where(and(eq(invoices.orderId, order.id), eq(invoices.status, "paid"))).limit(1);
  return {
    orderId: order.id, status: order.status, totalCents: order.totalCents, currency: order.currency,
    expiresAt: expiresAt.toISOString(), serverTime: serverTime.toISOString(), expired: order.status === "pending" && expiresAt <= serverTime,
    ...(refund ? { latePayment: true, refundStatus: refund.status,refundReason:refund.reason } : {}),
    ...(invoice && ['paid','partially_refunded','refunded'].includes(order.status) ? { invoice } : {}),
    items: rows.map((row) => {
      const seats = assignedSeats.filter((seat) => seat.orderItemId === row.orderItemId).map(({ rowLabel, seatNumber }) => ({ rowLabel, seatNumber }));
      return { ticketTypeId: row.ticketTypeId, name: row.name, quantity: row.quantity, unitPriceCents: row.unitPriceCents, totalCents: row.totalCents, ...(seats.length ? { seats } : {}) };
    }),
  };
}

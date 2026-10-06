import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { inventoryReservations, orderItems, orders, ticketTypes } from "@/lib/db/schema";
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
    accessTokenHash: orders.accessTokenHash, serverTime: sql<Date>`now()`,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const isOwner = order.userId !== null && access.userId === order.userId;
  if (!isOwner && !(access.token && accessTokenMatches(access.token, order.accessTokenHash))) return null;

  const rows = await database.select({
    ticketTypeId: orderItems.ticketTypeId, name: ticketTypes.name, quantity: orderItems.quantity,
    unitPriceCents: orderItems.unitPriceCents, totalCents: orderItems.totalCents, expiresAt: inventoryReservations.expiresAt,
  }).from(orderItems).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId))
    .innerJoin(inventoryReservations, eq(inventoryReservations.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, order.id)).orderBy(ticketTypes.name, orderItems.id);
  if (rows.length === 0) return null;

  const expiresAt = new Date(Math.max(...rows.map((row) => row.expiresAt.getTime())));
  const serverTime = new Date(order.serverTime);
  return {
    orderId: order.id, status: order.status, totalCents: order.totalCents, currency: order.currency,
    expiresAt: expiresAt.toISOString(), serverTime: serverTime.toISOString(), expired: expiresAt <= serverTime,
    items: rows.map((row) => ({ ticketTypeId: row.ticketTypeId, name: row.name, quantity: row.quantity, unitPriceCents: row.unitPriceCents, totalCents: row.totalCents })),
  };
}

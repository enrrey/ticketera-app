import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { inventoryReservations, orderItems, orders, payments, tickets } from '@/lib/db/schema';
import { hashTicketCredential, ticketCredential } from './qrToken';
import { enqueueOrderConfirmation } from '@/modules/notifications/server';

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
/** Caller owns the order transaction. Unique(item,unit) and order lock make retries idempotent. */
export async function issueTickets(database: Database, orderId: string): Promise<void> {
  const [order] = await database.select().from(orders).where(eq(orders.id, orderId)).for('update');
  if (!order || order.status !== 'paid') return;
  const [payment] = await database.select({ id: payments.id }).from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, 'succeeded'), eq(payments.amountCents, order.totalCents))).limit(1);
  if (!payment) throw new Error('Paid order requires captured payment');
  const items = await database.select({ id: orderItems.id, quantity: orderItems.quantity, reservationStatus: inventoryReservations.status })
    .from(orderItems).innerJoin(inventoryReservations, eq(inventoryReservations.orderItemId, orderItems.id)).where(eq(orderItems.orderId, orderId));
  if (!items.length || items.some(item => item.reservationStatus !== 'converted')) throw new Error('Paid order requires converted inventory');
  const existing = await database.select({ itemId: tickets.orderItemId, unit: tickets.unitNumber }).from(tickets)
    .where(sql`${tickets.orderItemId} in (select id from order_item where order_id=${orderId})`);
  const found = new Set(existing.map(ticket => `${ticket.itemId}:${ticket.unit}`));
  for (const item of items) {
    const missing = Array.from({ length: item.quantity }, (_, i) => i+1).filter(unit => !found.has(`${item.id}:${unit}`));
    for (let offset=0; offset<missing.length; offset+=100) {
      const values = missing.slice(offset, offset+100).map(unitNumber => {
        const id = randomUUID();
        return { id, orderItemId: item.id, unitNumber, qrTokenHash: hashTicketCredential(ticketCredential(id)) };
      });
      await database.insert(tickets).values(values).onConflictDoNothing({ target: [tickets.orderItemId, tickets.unitNumber] });
    }
  }
  await enqueueOrderConfirmation(database, orderId);
}

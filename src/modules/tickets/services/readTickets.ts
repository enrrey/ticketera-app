import QRCode from 'qrcode';
import { and, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDatabase } from '@/lib/db';
import { events, orderItems, orderItemSeats, orders, tickets, ticketTypes, venues } from '@/lib/db/schema';
import { getCheckout } from '@/modules/checkout/server';
import type { TicketPage } from '../types';
import { hashTicketCredential, ticketCredential } from './qrToken';

/** A captured payment must still cover the original order, including after a partial refund. */
export const capturedTicketPayment = sql<boolean>`exists (select 1 from payment p where p.order_id="order"."id" and p.status in ('succeeded','partially_refunded') and p.amount_cents="order"."total_cents" and p.currency="order"."currency")`;

export async function renderTicketQr(ticket: { id: string; status: string; hash: string }, eligible: boolean): Promise<string|null> {
  if (!eligible || ticket.status !== 'valid') return null;
  const credential=ticketCredential(ticket.id);
  if (hashTicketCredential(credential)!==ticket.hash) throw new Error('Ticket credential cannot be reconstructed');
  return QRCode.toDataURL(credential,{errorCorrectionLevel:'M',margin:4,width:280});
}

export async function readTickets(orderId: string, access: { userId: string|null; token: string|null }, page=1, database: PgDatabase<PgQueryResultHKT,Record<string,unknown>>= getDatabase()): Promise<TicketPage|null> {
  const order=await getCheckout(orderId,access,database);
  if (!order) return null;
  const [payment] = await database.select({captured:capturedTicketPayment}).from(orders).where(eq(orders.id,orderId));
  const pageSize=24;
  const [count]=await database.select({ n:sql<number>`count(*)::int` }).from(tickets).innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).where(eq(orderItems.orderId,orderId));
  const rows=await database.select({ id:tickets.id,unitNumber:tickets.unitNumber,status:tickets.status,hash:tickets.qrTokenHash,
    eventName:events.name,zone:ticketTypes.zone,ticketTypeName:ticketTypes.name,venue:venues.name,
    date:sql<string|null>`(select min(s.starts_at)::text from ticket_type_session ts join event_session s on s.id=ts.event_session_id where ts.ticket_type_id=${ticketTypes.id})`,
    row:orderItemSeats.rowLabel,number:orderItemSeats.seatNumber })
    .from(tickets).innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).innerJoin(ticketTypes,eq(ticketTypes.id,orderItems.ticketTypeId))
    .innerJoin(events,eq(events.id,ticketTypes.eventId)).innerJoin(venues,eq(venues.id,events.venueId))
    .leftJoin(orderItemSeats,and(eq(orderItemSeats.orderItemId,orderItems.id),eq(orderItemSeats.unitNumber,tickets.unitNumber)))
    .where(eq(orderItems.orderId,orderId)).orderBy(orderItems.id,tickets.unitNumber).limit(pageSize).offset((page-1)*pageSize);
  const data=await Promise.all(rows.map(async ({hash,row,number,...ticket})=>{
    const qrImage=await renderTicketQr({...ticket,hash},['paid','partially_refunded'].includes(order.status) && payment.captured);
    return {...ticket,seat:row&&number?{row,number}:null,qrImage};
  }));
  return {tickets:data,total:Number(count.n),page,pageSize};
}

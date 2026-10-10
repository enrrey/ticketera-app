import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDatabase } from '@/lib/db';
import { events, orderItems, orderItemSeats, orders, tickets, ticketTypes, venues } from '@/lib/db/schema';
import { AccessError, getAccessUser } from '@/modules/identity-access';
import type { OwnTicket, OwnTicketPage } from '../types';
import { capturedTicketPayment, renderTicketQr } from './readTickets';

/** Ownership and effective permission come from persisted identity, never browser-supplied roles. */
export async function listOwnTickets(userId:string, requestedPage=1, database:PgDatabase<PgQueryResultHKT,Record<string,unknown>>=getDatabase()):Promise<OwnTicketPage> {
  const user=await getAccessUser(userId,database);
  if (user.status!=='active' || !user.permissions.includes('tickets.read_own')) throw new AccessError(403,'No tienes permiso para consultar entradas');
  const page=Number.isSafeInteger(requestedPage) && requestedPage>0 && requestedPage<=999999?requestedPage:1;
  const pageSize=24;
  const owner=eq(orders.userId,user.id);
  const [count]=await database.select({n:sql<number>`count(*)::int`}).from(tickets).innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).innerJoin(orders,eq(orders.id,orderItems.orderId)).where(owner);
  const rows=await database.select({id:tickets.id,unitNumber:tickets.unitNumber,status:tickets.status,hash:tickets.qrTokenHash,
    orderId:orders.id,orderStatus:orders.status,captured:capturedTicketPayment,eventName:events.name,zone:ticketTypes.zone,ticketTypeName:ticketTypes.name,venue:venues.name,
    sessions:sql<OwnTicket['sessions']>`coalesce((select json_agg(json_build_object('id',s.id,'startsAt',s.starts_at) order by s.starts_at,s.id) from ticket_type_session ts join event_session s on s.id=ts.event_session_id where ts.ticket_type_id=${ticketTypes.id}), '[]'::json)`,
    row:orderItemSeats.rowLabel,number:orderItemSeats.seatNumber})
    .from(tickets).innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).innerJoin(orders,eq(orders.id,orderItems.orderId))
    .innerJoin(ticketTypes,eq(ticketTypes.id,orderItems.ticketTypeId)).innerJoin(events,eq(events.id,ticketTypes.eventId)).innerJoin(venues,eq(venues.id,events.venueId))
    .leftJoin(orderItemSeats,and(eq(orderItemSeats.orderItemId,orderItems.id),eq(orderItemSeats.unitNumber,tickets.unitNumber)))
    .where(owner).orderBy(desc(orders.createdAt),orders.id,orderItems.id,tickets.unitNumber).limit(pageSize).offset((page-1)*pageSize);
  const data=await Promise.all(rows.map(async ({hash,row,number,orderStatus,captured,...ticket})=>({
    ...ticket,date:ticket.sessions[0]?.startsAt??null,seat:row&&number?{row,number}:null,
    qrImage:await renderTicketQr({...ticket,hash},['paid','partially_refunded'].includes(orderStatus)&&captured),
  })));
  return {tickets:data,total:Number(count.n),page,pageSize};
}

import {and,eq,inArray,sql} from 'drizzle-orm';
import type {PgDatabase,PgQueryResultHKT} from 'drizzle-orm/pg-core';
import {getDatabase} from '@/lib/db';
import {auditLogs,checkIns,events,orderItems,orders,payments,tickets,ticketTypes,users} from '@/lib/db/schema';
import {AccessError,getAccessUser,type AccessUser} from '@/modules/identity-access';
import {hashTicketCredential} from './qrToken';
import type {CheckInEvent,CheckInResult} from '../checkIn.types';
type Database=PgDatabase<PgQueryResultHKT,Record<string,unknown>>;
const allEvents=(actor:AccessUser)=>actor.roles.some(role=>role==='admin'||role==='super_admin');
function assertScanner(actor:AccessUser){
  if(actor.status!=='active'||!actor.roles.some(role=>['organizer','admin','super_admin'].includes(role))||!actor.permissions.includes('tickets.check_in'))throw new AccessError(403,'No tienes permiso para validar entradas');
  return actor;
}
export async function listCheckInEvents(actorId:string,database:Database=getDatabase()):Promise<CheckInEvent[]>{
  const actor=assertScanner(await getAccessUser(actorId,database));
  return database.select({slug:events.slug,name:events.name,status:events.status}).from(events)
    .where(and(inArray(events.status,['published','completed','cancelled']),allEvents(actor)?undefined:eq(events.organizerId,actor.id))).orderBy(events.name);
}
export async function checkInTicket(actorId:string,slug:string,credential:string,database:Database=getDatabase()):Promise<CheckInResult>{
  return database.transaction(async tx=>{
    const [identity]=await tx.select({clerkId:users.clerkUserId}).from(users).where(eq(users.id,actorId));
    if(!identity)throw new AccessError(403,'No tienes permiso para validar entradas');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity.clerkId},0))`);
    // Staff changes lock this row; hold it until QR consumption commits.
    await tx.select({id:users.id}).from(users).where(eq(users.id,actorId)).for('update');
    const actor=assertScanner(await getAccessUser(actorId,tx));
    const [event]=await tx.select({id:events.id,status:events.status}).from(events)
      .where(and(eq(events.slug,slug),allEvents(actor)?undefined:eq(events.organizerId,actor.id))).for('update');
    if(!event)throw new AccessError(404,'Evento no encontrado');
    if(event.status==='cancelled')return {code:'event_cancelled',message:'El evento está cancelado. No se permite el ingreso.'};
    if(!['published','completed'].includes(event.status)||!/^ticketera:v1:[a-zA-Z0-9_-]{43}$/.test(credential))return {code:'invalid',message:'Entrada inválida para este evento.'};
    const [reference]=await tx.select({id:tickets.id,orderId:orderItems.orderId}).from(tickets)
      .innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).innerJoin(ticketTypes,eq(ticketTypes.id,orderItems.ticketTypeId))
      .where(and(eq(tickets.qrTokenHash,hashTicketCredential(credential)),eq(ticketTypes.eventId,event.id))).limit(1);
    if(!reference)return {code:'invalid',message:'Entrada inválida para este evento.'};
    // Match payment/refund lock order: order before ticket. QR consumption is atomic.
    const [order]=await tx.select().from(orders).where(eq(orders.id,reference.orderId)).for('update');
    const [ticket]=await tx.select().from(tickets).where(eq(tickets.id,reference.id)).for('update');
    const [previous]=await tx.select({createdAt:checkIns.createdAt}).from(checkIns).where(eq(checkIns.ticketId,ticket.id));
    if(previous||ticket.status==='used')return {code:'already_used',message:'Esta entrada ya fue utilizada.',checkedAt:previous?.createdAt.toISOString()};
    if(['refund_pending','refunded'].includes(ticket.status))return {code:'refunded',message:'Esta entrada tiene un reembolso y no permite ingreso.'};
    const [payment]=await tx.select({id:payments.id}).from(payments).where(and(eq(payments.orderId,order.id),inArray(payments.status,['succeeded','partially_refunded']),eq(payments.amountCents,order.totalCents),eq(payments.currency,order.currency))).limit(1);
    if(ticket.status!=='valid'||!['paid','partially_refunded'].includes(order.status)||!payment)return {code:'invalid',message:'La entrada no tiene un pago válido para ingresar.'};
    const [record]=await tx.insert(checkIns).values({ticketId:ticket.id,eventId:event.id,scannedById:actor.id}).returning();
    await tx.update(tickets).set({status:'used'}).where(eq(tickets.id,ticket.id));
    await tx.insert(auditLogs).values({actorId:actor.id,action:'ticket.checked_in',entity:'ticket',entityId:ticket.id,metadata:{eventId:event.id,checkInId:record.id}});
    return {code:'accepted',message:'Entrada válida. Ingreso registrado.',ticketId:ticket.id,checkedAt:record.createdAt.toISOString()};
  });
}

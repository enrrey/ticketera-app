import { and,eq,inArray,sql } from 'drizzle-orm';
import type { PgDatabase,PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { events,seatHolds,ticketTypes } from '@/lib/db/schema';
import { isSameOrigin } from '@/lib/sameOrigin';
import { readRequestJson, RequestBodyTooLargeError } from '@/lib/requestBody';
import { generateAccessToken,hashAccessToken } from './accessToken';
import { heldEventSeats,normalizeSeatLabel,occupiedEventSeats,seatKey } from './seatAvailability';

type Database=PgDatabase<PgQueryResultHKT,Record<string,unknown>>;
const coordinate=z.object({rowLabel:z.string().trim().min(1).max(20),seatNumber:z.number().int().min(1).max(500)}).strict();
export const seatHoldSchema=z.object({items:z.array(z.object({ticketTypeId:z.uuid(),seats:z.array(coordinate).min(1).max(1000)}).strict()).max(10)
  .refine(items=>new Set(items.map(item=>item.ticketTypeId)).size===items.length,'Duplicate type')}).strict();
type HoldInput=z.infer<typeof seatHoldSchema>;
export class SeatHoldError extends Error {constructor(readonly status:number,readonly code:string,message:string){super(message);}}
const physicalKey=(zone:string,row:string,number:number)=>JSON.stringify([normalizeSeatLabel(zone),seatKey(row,number)]);

/** The event lock serializes selection against checkout, other buyers and organizer edits. */
export async function replaceSeatHolds(slug:string,input:HoldInput,token?:string|null,database:Database=getDatabase()) {
  const parsed=seatHoldSchema.parse(input);
  const holdToken=token??generateAccessToken();
  if(!/^[a-zA-Z0-9_-]{32,128}$/.test(holdToken)) throw new SeatHoldError(400,'invalid_token','Token inválido');
  const ownerHash=hashAccessToken(holdToken);
  return database.transaction(async tx=>{
    const [event]=await tx.select({id:events.id}).from(events).where(and(eq(events.slug,slug),eq(events.status,'published'))).for('update');
    if(!event) throw new SeatHoldError(404,'not_found','Evento no encontrado');
    const ids=parsed.items.map(item=>item.ticketTypeId).sort();
    const types=ids.length?await tx.select({id:ticketTypes.id,zone:ticketTypes.zone,seatingType:ticketTypes.seatingType,seatRows:ticketTypes.seatRows,maxPerOrder:ticketTypes.maxPerOrder,
      salesOpen:sql<boolean>`${ticketTypes.salesStartAt}<=clock_timestamp() and ${ticketTypes.salesEndAt}>clock_timestamp()`,
      future:sql<boolean>`exists(select 1 from ticket_type_session ts join event_session s on s.id=ts.event_session_id where ts.ticket_type_id=ticket_type.id and s.ends_at>clock_timestamp())`
    }).from(ticketTypes).where(and(eq(ticketTypes.eventId,event.id),inArray(ticketTypes.id,ids))).orderBy(ticketTypes.id).for('update'):[];
    if(types.length!==ids.length) throw new SeatHoldError(404,'not_found','Tribuna no encontrada');
    const [reserved,held]=await Promise.all([occupiedEventSeats(event.id,tx),heldEventSeats(event.id,tx)]);
    const unavailable=new Set([
      ...reserved.map(seat=>physicalKey(seat.zone,seat.rowLabel,seat.seatNumber)),
      ...held.filter(seat=>seat.ownerTokenHash!==ownerHash).map(seat=>physicalKey(seat.zoneKey,seat.rowLabel,seat.seatNumber))
    ]);
    const selections:typeof seatHolds.$inferInsert[]=[];
    const chosen=new Set<string>();
    const [clock]=await tx.select({now:sql<Date>`clock_timestamp()`}).from(events).where(eq(events.id,event.id));
    const serverNow=new Date(clock.now);
    const expiresAt=new Date(serverNow.getTime()+60000);
    for(const item of parsed.items){
      const type=types.find(type=>type.id===item.ticketTypeId)!;
      if(type.seatingType!=='numbered'||item.seats.length>type.maxPerOrder) throw new SeatHoldError(400,'invalid_seats','Revisa la cantidad y modalidad de la tribuna');
      if(!type.salesOpen||!type.future) throw new SeatHoldError(409,'sales_closed','La venta no está disponible');
      for(const seat of item.seats){
        const row=type.seatRows.find(row=>row.label===seat.rowLabel);
        if(!row||seat.seatNumber>row.seats) throw new SeatHoldError(400,'invalid_seats','El asiento no existe en esta tribuna');
        const key=physicalKey(type.zone,seat.rowLabel,seat.seatNumber);
        if(chosen.has(key)) throw new SeatHoldError(400,'invalid_seats','Selecciona cada asiento una sola vez');
        if(unavailable.has(key)) throw new SeatHoldError(409,'seat_unavailable','El asiento ya está ocupado. Elige otro.');
        chosen.add(key);
        unavailable.add(key);
        selections.push({eventId:event.id,ticketTypeId:type.id,zoneKey:normalizeSeatLabel(type.zone),rowKey:normalizeSeatLabel(seat.rowLabel),
          rowLabel:seat.rowLabel,seatNumber:seat.seatNumber,ownerTokenHash:ownerHash,createdAt:serverNow,expiresAt});
      }
    }
    // Replacing is all-or-nothing. Invalid new selections preserve previous holds.
    await tx.delete(seatHolds).where(and(eq(seatHolds.eventId,event.id),sql`(${seatHolds.ownerTokenHash}=${ownerHash} or ${seatHolds.expiresAt}<=clock_timestamp())`));
    if(selections.length) await tx.insert(seatHolds).values(selections);
    return {holdToken,expiresAt:selections.length?expiresAt.toISOString():null,serverTime:serverNow.toISOString(),items:parsed.items};
  });
}

export async function releaseSeatHolds(slug:string,token:string,database:Database=getDatabase()) {
  return database.transaction(async tx=>{
    const [event]=await tx.select({id:events.id}).from(events).where(eq(events.slug,slug)).for('update');
    if(event) await tx.delete(seatHolds).where(and(eq(seatHolds.eventId,event.id),eq(seatHolds.ownerTokenHash,hashAccessToken(token))));
  });
}

export async function handleSeatHolds(request:Request,slug:string){
  const headers={'Cache-Control':'private, no-store',Vary:'x-seat-hold-token'};
  if(!isSameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403,headers});
  try{
    const token=request.headers.get('x-seat-hold-token');
    if(token&&!/^[a-zA-Z0-9_-]{32,128}$/.test(token))throw new SeatHoldError(400,'invalid_token','Token inválido');
    if(request.method==='DELETE'){
      if(!token)throw new SeatHoldError(400,'invalid_token','Falta el token de selección');
      await releaseSeatHolds(slug,token);return new Response(null,{status:204,headers});
    }
    const input=seatHoldSchema.parse(await readRequestJson(request));
    return Response.json(await replaceSeatHolds(slug,input,token),{headers});
  }catch(error){
    if(error instanceof RequestBodyTooLargeError)return Response.json({error:error.message,code:'body_too_large'},{status:413,headers});
    const invalid=error instanceof z.ZodError||error instanceof SyntaxError;
    return Response.json({error:error instanceof SeatHoldError?error.message:invalid?'Revisa los asientos seleccionados':'No pudimos reservar los asientos',code:error instanceof SeatHoldError?error.code:invalid?'invalid_seats':'unavailable'},
      {status:error instanceof SeatHoldError?error.status:invalid?400:503,headers});
  }
}

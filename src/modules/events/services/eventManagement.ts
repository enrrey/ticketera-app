import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { auditLogs, events, eventSessions, ticketTypes, ticketTypeSessions, venues, promotionTicketTypes } from "@/lib/db/schema";
import { AccessError, getAccessUser, getCurrentAccessUser } from "@/modules/identity-access";
import type { AccessUser } from "@/modules/identity-access";
import type { EventInput, TicketTypeInput } from "../eventManagement.types";
import { isEventImageUrl } from "./eventImageUrl";

const imageSchema=z.string().trim().max(1000).refine(isEventImageUrl,"Usa una imagen local o una URL HTTPS pública");
const ticketSchema=z.object({ id:z.uuid().optional(),name:z.string().trim().min(1).max(100),zone:z.string().trim().min(1).max(100),seatingType:z.enum(["standing","seated","numbered","box"]),description:z.string().trim().max(1000),priceCents:z.number().int().min(0).max(99_999_999),capacity:z.number().int().min(1).max(100_000),maxPerOrder:z.number().int().min(1).max(1000),peoplePerUnit:z.number().int().min(1).max(50),seatRows:z.array(z.object({label:z.string().trim().min(1).max(20),seats:z.number().int().min(1).max(500)}).strict()).max(100).default([]),salesStartAt:z.iso.datetime({offset:true}),salesEndAt:z.iso.datetime({offset:true}),sessionIndexes:z.array(z.number().int().min(0).max(29)).min(1).max(30) }).strict();

function ticketInputs(records:(typeof ticketTypes.$inferSelect)[],sessions:(typeof eventSessions.$inferSelect)[],links:(typeof ticketTypeSessions.$inferSelect)[]):TicketTypeInput[] {
  return records.map((record)=>({id:record.id,name:record.name,zone:record.zone,seatingType:record.seatingType as TicketTypeInput["seatingType"],description:record.description,priceCents:record.priceCents,capacity:record.capacity,maxPerOrder:record.maxPerOrder,peoplePerUnit:record.peoplePerUnit,seatRows:record.seatRows,salesStartAt:record.salesStartAt.toISOString(),salesEndAt:record.salesEndAt.toISOString(),sessionIndexes:sessions.map((session,index)=>links.some((link)=>link.ticketTypeId===record.id&&link.eventSessionId===session.id)?index:-1).filter((index)=>index>=0)}));
}

const inputSchema = z.object({
  name: z.string().trim().min(2).max(160), category: z.enum(["concert","theater","sports","festival","conference","exhibition","family","comedy","cinema"]),
  description: z.string().trim().min(1).max(5000),
  imageUrl: imageSchema,
  venueName: z.string().trim().min(2).max(160), address: z.string().trim().min(2).max(300), city: z.string().trim().min(2).max(100),
  sessions: z.array(z.object({ startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) }).strict()).min(1).max(30),
  status: z.enum(["draft","published","cancelled"]).default("draft"),
  minimumAge:z.number().int().min(0).max(99).optional(),entryInstructions:z.string().trim().max(2000).optional(),ticketTypes:z.array(ticketSchema).max(50).optional(),featured:z.boolean().optional(),
}).strict();

export function assertEventManager(actor: AccessUser | null) {
  if (!actor) throw new AccessError(401, "Debes iniciar sesión");
  if (actor.status !== "active" || !actor.roles.some((role) => ["admin","super_admin","organizer"].includes(role)) || !actor.permissions.includes("events.manage")) throw new AccessError(403, "No tienes permiso para gestionar eventos");
  return actor;
}
export const managesAllEvents = (actor: AccessUser) => actor.roles.some((role) => role === "admin" || role === "super_admin");

export async function manageEvent(actorId: string, method: "GET" | "POST" | "PATCH" | "DELETE", slug?: string, rawInput?: unknown, database: PgDatabase<PgQueryResultHKT, Record<string, unknown>> = getDatabase()) {
  const coverOnly=method==="PATCH" && typeof rawInput==="object" && rawInput!==null && Object.keys(rawInput).every((key)=>["imageUrl","featured"].includes(key)) && "imageUrl" in rawInput;
  const featuredOnly=method==="PATCH" && typeof rawInput==="object" && rawInput!==null && Object.keys(rawInput).length===1 && "featured" in rawInput;
  const input = method === "POST" || method === "PATCH" ? featuredOnly ? z.object({featured:z.boolean()}).strict().parse(rawInput) : coverOnly ? z.object({imageUrl:imageSchema,featured:z.boolean().optional()}).strict().parse(rawInput) : inputSchema.parse(rawInput) : undefined;
  return database.transaction(async (tx) => {
    // Serialize mutations and re-check current permissions within the transaction.
    await tx.execute(sql`select id from "user" where id=${actorId}::uuid for update`);
    const actor = assertEventManager(await getAccessUser(actorId, tx));
    const [existing] = slug ? await tx.select().from(events).where(managesAllEvents(actor) ? eq(events.slug, slug) : and(eq(events.slug, slug), eq(events.organizerId, actor.id))).for("update") : [];
    if (method !== "POST" && !existing) throw new AccessError(404, "Evento no encontrado");
    const featured = (input as EventInput | undefined)?.featured;
    if (featured !== undefined && (featuredOnly || featured !== (existing?.featured ?? false)) && !managesAllEvents(actor)) throw new AccessError(403, "Solo administración puede destacar eventos");
    if (featuredOnly) {
      await tx.update(events).set({featured:featured!,updatedAt:new Date()}).where(eq(events.id,existing!.id));
      await tx.insert(auditLogs).values({actorId,action:"event.featured_updated",entity:"event",entityId:existing!.id,metadata:{featured}});
      return {id:existing!.id,slug:existing!.slug,status:existing!.status,featured};
    }
    // Order-item foreign keys take key-share locks on ticket types. Locking those rows
    // before checking purchases prevents a checkout from racing a schedule mutation.
    const lockedTypes = existing && method !== "GET" ? await tx.select().from(ticketTypes).where(eq(ticketTypes.eventId, existing.id)).orderBy(ticketTypes.id).for("update") : [];
    const hasOrders = existing ? await tx.select({ count: sql<number>`(select count(*) from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id where tt.event_id=${existing.id})` }).from(events).where(eq(events.id,existing.id)) : [];
    const purchased = Number(hasOrders[0]?.count ?? 0) > 0;
    if (method === "GET") {
      const [venue] = await tx.select().from(venues).where(eq(venues.id, existing!.venueId));
      const sessions = await tx.select().from(eventSessions).where(eq(eventSessions.eventId, existing!.id)).orderBy(eventSessions.startsAt);
      const options=await tx.select().from(ticketTypes).where(eq(ticketTypes.eventId,existing!.id)).orderBy(ticketTypes.id);
      const links=await tx.select().from(ticketTypeSessions).where(eq(ticketTypeSessions.eventId,existing!.id));
      return { id: existing!.id, slug: existing!.slug, organizerId: existing!.organizerId, name: existing!.name, category: existing!.category, description: existing!.description, imageUrl: existing!.imageUrl ?? "", status: existing!.status, featured:existing!.featured, venueName: venue.name, address: venue.address, city: venue.city,minimumAge:existing!.minimumAge,entryInstructions:existing!.entryInstructions,ticketTypes:ticketInputs(options,sessions,links), sessions: sessions.map((session) => ({ startsAt: session.startsAt.toISOString(), endsAt: session.endsAt.toISOString() })), hasOrders: purchased };
    }
    if (method === "DELETE") {
      if (existing!.status !== "draft" || purchased) throw new AccessError(409, "Solo puedes eliminar borradores sin pedidos");
      const dependencies = await tx.select({ count: sql<number>`(select count(*) from promotion where event_id=${existing!.id})+(select count(*) from payout where event_id=${existing!.id})` }).from(events).where(eq(events.id,existing!.id));
      if (Number(dependencies[0].count)) throw new AccessError(409, "El evento tiene promociones o liquidaciones asociadas");
      await tx.delete(ticketTypeSessions).where(eq(ticketTypeSessions.eventId, existing!.id));
      await tx.delete(ticketTypes).where(eq(ticketTypes.eventId, existing!.id));
      await tx.delete(eventSessions).where(eq(eventSessions.eventId, existing!.id));
      await tx.delete(events).where(eq(events.id, existing!.id));
      await tx.insert(auditLogs).values({ actorId, action: "event.deleted", entity: "event", entityId: existing!.id });
      return null;
    }
    if (existing && ["cancelled","completed"].includes(existing.status)) throw new AccessError(409, "Un evento cancelado o finalizado conserva su historial y no se puede modificar");
    if(coverOnly){
      await tx.update(events).set({featured:featured??existing!.featured,imageUrl:(input as EventInput).imageUrl||null,updatedAt:new Date()}).where(eq(events.id,existing!.id));
      await tx.insert(auditLogs).values({actorId,action:"event.cover_updated",entity:"event",entityId:existing!.id});
      return {id:existing!.id,slug:existing!.slug,status:existing!.status};
    }
    if (purchased) throw new AccessError(409, "El evento tiene pedidos. Sus condiciones no se pueden modificar desde este formulario");
    const values = input as EventInput;
    if (method === "POST" && values.status !== "draft") throw new AccessError(400, "Los eventos nuevos se crean como borrador");
    if (existing?.status === "published" && values.status === "draft") throw new AccessError(409, "Un evento publicado no puede volver a borrador");
    if (existing?.status === "published" && values.status !== "published" && !actor.permissions.includes("events.publish")) throw new AccessError(403, "No tienes permiso para retirar un evento publicado");
    const sessions = values.sessions.map((session) => ({ startsAt: new Date(session.startsAt), endsAt: new Date(session.endsAt) }));
    if (sessions.some((session) => session.startsAt.getTime() <= Date.now() || session.endsAt <= session.startsAt)) throw new AccessError(400, "Las sesiones deben comenzar en el futuro y terminar después del inicio");
    const sorted = [...sessions].sort((a,b) => a.startsAt.getTime()-b.startsAt.getTime());
    if (sorted.some((session,index) => index > 0 && session.startsAt < sorted[index-1].endsAt)) throw new AccessError(400, "Las sesiones no pueden superponerse");
    const oldSessions = existing ? await tx.select().from(eventSessions).where(eq(eventSessions.eventId, existing.id)).orderBy(eventSessions.startsAt) : [];
    const oldLinks=existing?await tx.select().from(ticketTypeSessions).where(eq(ticketTypeSessions.eventId,existing.id)):[];
    const options=values.ticketTypes??ticketInputs(lockedTypes,oldSessions,oldLinks);
    const optionIds=options.flatMap((option)=>option.id?[option.id]:[]);
    if(new Set(optionIds).size!==optionIds.length || options.some((option)=>option.id&&!lockedTypes.some((record)=>record.id===option.id))) throw new AccessError(400,"Tipo de entrada inválido para este evento");
    if(new Set(options.map((option)=>`${option.zone.toLowerCase()}:${option.name.toLowerCase()}`)).size!==options.length) throw new AccessError(400,"Evita nombres de entrada duplicados en la misma zona");
    for(const option of options){
      if(new Set(option.sessionIndexes).size!==option.sessionIndexes.length || option.sessionIndexes.some((index)=>!sessions[index])) throw new AccessError(400,"Selecciona sesiones válidas para cada entrada");
      const firstStart=Math.min(...option.sessionIndexes.map((index)=>sessions[index].startsAt.getTime()));
      if(!option.sessionIndexes.length || new Date(option.salesEndAt)<=new Date(option.salesStartAt) || new Date(option.salesEndAt).getTime()>firstStart) throw new AccessError(400,"La venta debe terminar antes del inicio de las sesiones incluidas");
      if(option.seatingType!=="box"&&option.peoplePerUnit!==1) throw new AccessError(400,"Solo mesas o boxes pueden incluir varias personas por unidad");
      if(option.seatingType==="numbered" ? !option.seatRows.length || option.seatRows.reduce((total,row)=>total+row.seats,0)!==option.capacity || new Set(option.seatRows.map((row)=>row.label.toLowerCase())).size!==option.seatRows.length : option.seatRows.length>0) throw new AccessError(400,"Revisa filas y aforo de los asientos numerados");
    }
    if (values.status === "published") {
      if (!actor.permissions.includes("events.publish")) throw new AccessError(403, "No tienes permiso para publicar eventos");
      if (/pendiente/i.test(values.address)) throw new AccessError(400, "Confirma la dirección del recinto antes de publicar");
      if(!options.length || new Set(options.flatMap((option)=>option.sessionIndexes)).size!==sessions.length || options.some((option)=>new Date(option.salesEndAt).getTime()<=Date.now())) throw new AccessError(400,"Configura entradas y venta vigente para todas las sesiones antes de publicar");
    }
    const scheduleChanged = oldSessions.length !== sorted.length || oldSessions.some((session,index) => session.startsAt.getTime() !== sorted[index].startsAt.getTime() || session.endsAt.getTime() !== sorted[index].endsAt.getTime());
    if (scheduleChanged && lockedTypes.length && values.ticketTypes===undefined) throw new AccessError(409, "Actualiza también la validez de las entradas al modificar las sesiones");
    const [oldVenue] = existing ? await tx.select().from(venues).where(eq(venues.id, existing.venueId)) : [];
    const venue = oldVenue && oldVenue.name === values.venueName && oldVenue.address === values.address && oldVenue.city === values.city ? oldVenue : (await tx.insert(venues).values({ name: values.venueName, address: values.address, city: values.city }).returning())[0];
    const fields = { featured:values.featured??existing?.featured??false, name: values.name, category: values.category, description: values.description, imageUrl: values.imageUrl || null, venueId: venue.id, status: values.status,minimumAge:values.minimumAge??existing?.minimumAge??0,entryInstructions:values.entryInstructions??existing?.entryInstructions??"" };
    const [saved] = existing ? await tx.update(events).set({ ...fields, updatedAt: new Date() }).where(eq(events.id, existing.id)).returning() : await tx.insert(events).values({ ...fields, slug: `${values.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0,75)}-${randomUUID().slice(0,8)}`, organizerId: actorId, createdById: actorId }).returning();
    if (scheduleChanged) {
      if(existing) await tx.delete(ticketTypeSessions).where(eq(ticketTypeSessions.eventId,existing.id));
      if (existing) await tx.delete(eventSessions).where(eq(eventSessions.eventId, existing.id));
      await tx.insert(eventSessions).values(sorted.map((session) => ({ ...session, eventId: saved.id })));
    }
    if(values.ticketTypes!==undefined){
      for(const removed of lockedTypes.filter((record)=>!optionIds.includes(record.id))){
        const [promotion]=await tx.select().from(promotionTicketTypes).where(eq(promotionTicketTypes.ticketTypeId,removed.id)).limit(1);
        if(promotion) throw new AccessError(409,"Una entrada con promociones asociadas no se puede eliminar");
        await tx.delete(ticketTypeSessions).where(eq(ticketTypeSessions.ticketTypeId,removed.id));
        await tx.delete(ticketTypes).where(eq(ticketTypes.id,removed.id));
      }
      const savedSessions=await tx.select().from(eventSessions).where(eq(eventSessions.eventId,saved.id)).orderBy(eventSessions.startsAt);
      for(const option of options){
        const fields={name:option.name,zone:option.zone,seatingType:option.seatingType,description:option.description,priceCents:option.priceCents,capacity:option.capacity,maxPerOrder:option.maxPerOrder,peoplePerUnit:option.peoplePerUnit,seatRows:option.seatRows,salesStartAt:new Date(option.salesStartAt),salesEndAt:new Date(option.salesEndAt)};
        const [type]=option.id?await tx.update(ticketTypes).set(fields).where(and(eq(ticketTypes.id,option.id),eq(ticketTypes.eventId,saved.id))).returning():await tx.insert(ticketTypes).values({...fields,eventId:saved.id}).returning();
        await tx.delete(ticketTypeSessions).where(eq(ticketTypeSessions.ticketTypeId,type.id));
        await tx.insert(ticketTypeSessions).values(option.sessionIndexes.map((index)=>({eventId:saved.id,ticketTypeId:type.id,eventSessionId:savedSessions.find((session)=>session.startsAt.getTime()===sessions[index].startsAt.getTime())!.id})));
      }
    }
    await tx.insert(auditLogs).values({ actorId, action: existing ? "event.updated" : "event.created", entity: "event", entityId: saved.id });
    return { id: saved.id, slug: saved.slug, status: saved.status };
  });
}

export async function handleEventManagement(request: Request, slug?: string) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const actor = assertEventManager(await getCurrentAccessUser());
    const method = request.method as "GET" | "POST" | "PATCH" | "DELETE";
    if (!((slug && ["GET","PATCH","DELETE"].includes(method)) || (!slug && method === "POST"))) throw new AccessError(405, "Método no permitido");
    if (slug && !/^[a-zA-Z0-9-]{1,120}$/.test(slug)) throw new AccessError(400, "Evento inválido");
    if (method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) throw new AccessError(403, "Origen no permitido");
    let input: unknown;
    if (["POST","PATCH"].includes(method)) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AccessError(400, "Envía los datos como JSON");
      const body = await request.text(); if (body.length > 64_000) throw new AccessError(413, "El formulario es demasiado grande");
      input = JSON.parse(body);
    }
    const result = await manageEvent(actor.id, method, slug, input);
    return method === "DELETE" ? new Response(null, { status: 204, headers }) : Response.json(result, { status: method === "POST" ? 201 : 200, headers });
  } catch (error) {
    return Response.json({ error: error instanceof AccessError ? error.message : error instanceof z.ZodError || error instanceof SyntaxError ? "Revisa los datos del evento" : "No pudimos guardar el evento" }, { status: error instanceof AccessError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503, headers });
  }
}



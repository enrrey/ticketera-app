// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import type { AccessUser } from "@/modules/identity-access/types";
import { getAccessUser } from "@/modules/identity-access";
import { manageEvent, handleEventManagement } from "./eventManagement";
const state = vi.hoisted(() => ({ actor: null as AccessUser | null }));
vi.mock("@/modules/identity-access", async (original) => ({ ...await original<typeof import("@/modules/identity-access")>(), getCurrentAccessUser: async () => state.actor }));
vi.mock("@/lib/db", () => ({ getDatabase: () => database }));
const pg = new PGlite(); const database = drizzle(pg);
const owner = "00000000-0000-0000-0000-000000000021", other = "00000000-0000-0000-0000-000000000022", admin = "00000000-0000-0000-0000-000000000023", customer = "00000000-0000-0000-0000-000000000024";
const input = () => ({ name:"Evento real", category:"concert", description:"Descripción real", imageUrl:"", venueName:"Recinto", address:"Avenida Real 123", city:"Lima", status:"draft", sessions:[{ startsAt:new Date(Date.now()+86_400_000).toISOString(), endsAt:new Date(Date.now()+90_000_000).toISOString() }],ticketTypes:[{name:"General",zone:"Platea",seatingType:"seated",description:"Asiento libre",priceCents:12550,capacity:100,maxPerOrder:6,peoplePerUnit:1,seatRows:[],salesStartAt:new Date().toISOString(),salesEndAt:new Date(Date.now()+80_000_000).toISOString(),sessionIndexes:[0]}] });
const request = (method: string, body?: unknown, origin="http://localhost") => new Request("http://localhost/api/events", { method, headers:{ origin,"content-type":"application/json" }, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((f)=>f.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle",file),"utf8"));
  for (const [id,role] of [[owner,"organizer"],[other,"organizer"],[admin,"admin"],[customer,"customer"]]) await pg.exec(`insert into "user" (id,clerk_user_id,email,name,identity_updated_at) values ('${id}','${id}','${id}@example.com','Test',now()); insert into user_role(user_id,role_id) select '${id}',id from role where name='${role}'`);
},60_000);
afterAll(async()=>pg.close());
it("lets super admin create and feature events while rejecting organizer feature changes", async()=>{
  await pg.exec(`insert into user_role(user_id,role_id) select '${admin}',id from role where name='super_admin' on conflict do nothing`);
  const created=await manageEvent(admin,"POST",undefined,{...input(),featured:true},database);
  expect(await manageEvent(admin,"GET",created!.slug,undefined,database)).toMatchObject({featured:true});
  await manageEvent(admin,"PATCH",created!.slug,{featured:false},database);
  expect(await manageEvent(admin,"GET",created!.slug,undefined,database)).toMatchObject({featured:false});
  const own=await manageEvent(owner,"POST",undefined,input(),database);
  await expect(manageEvent(owner,"PATCH",own!.slug,{featured:true},database)).rejects.toMatchObject({status:403});
  await expect(manageEvent(owner,"POST",undefined,{...input(),featured:true},database)).rejects.toMatchObject({status:403});
  await manageEvent(admin,"DELETE",created!.slug,undefined,database);
  await manageEvent(owner,"DELETE",own!.slug,undefined,database);
  await pg.exec("delete from audit_log");
});
it("persists draft creation, detail, edits and deletion with audit history", async()=>{
  const created = await manageEvent(owner,"POST",undefined,input(),database);
  const detail = await manageEvent(owner,"GET",created!.slug,undefined,database);
  expect(detail).toMatchObject({ name:"Evento real", status:"draft", organizerId:owner });
  const edit = { ...input(),name:"Actualizado" };
  await manageEvent(owner,"PATCH",created!.slug,edit,database);
  expect(await manageEvent(owner,"GET",created!.slug,undefined,database)).toMatchObject({ name:"Actualizado" });
  await manageEvent(owner,"DELETE",created!.slug,undefined,database);
  await expect(manageEvent(owner,"GET",created!.slug,undefined,database)).rejects.toMatchObject({status:404});
  expect((await pg.query("select * from audit_log where entity='event'")).rows).toHaveLength(3);
});
it("enforces organizer ownership, admin access, customers and current permission overrides",async()=>{
  const created = await manageEvent(owner,"POST",undefined,input(),database);
  for (const method of ["GET","PATCH","DELETE"] as const) await expect(manageEvent(other,method,created!.slug,method==="PATCH"?input():undefined,database)).rejects.toMatchObject({status:404});
  expect(await manageEvent(admin,"GET",created!.slug,undefined,database)).toMatchObject({organizerId:owner});
  await expect(manageEvent(customer,"POST",undefined,input(),database)).rejects.toMatchObject({status:403});
  await pg.exec(`insert into user_permission(user_id,permission_id,allowed) select '${other}',id,false from permission where name='events.manage'`);
  await expect(manageEvent(other,"POST",undefined,input(),database)).rejects.toMatchObject({status:403});
});
it("protects publication permissions, future expiration and irreversible public status",async()=>{
  const data=input();
  await expect(manageEvent(owner,"POST",undefined,{...data,status:"published"},database)).rejects.toMatchObject({status:400});
  await expect(manageEvent(owner,"POST",undefined,{...data,sessions:[{startsAt:"2020-01-01T00:00:00Z",endsAt:"2020-01-02T00:00:00Z"}]},database)).rejects.toMatchObject({status:400});
  const created=await manageEvent(owner,"POST",undefined,data,database);
  await pg.exec(`insert into user_permission(user_id,permission_id,allowed) select '${owner}',id,false from permission where name='events.publish'`);
  await expect(manageEvent(owner,"PATCH",created!.slug,{...data,status:"published"},database)).rejects.toMatchObject({status:403});
  await pg.exec(`delete from user_permission where user_id='${owner}'`);
  await expect(manageEvent(owner,"PATCH",created!.slug,{...data,address:"Pendiente de confirmación",status:"published"},database)).rejects.toMatchObject({status:400});
  await manageEvent(owner,"PATCH",created!.slug,{...data,status:"published"},database);
  await expect(manageEvent(owner,"DELETE",created!.slug,undefined,database)).rejects.toMatchObject({status:409});
  await expect(manageEvent(owner,"PATCH",created!.slug,data,database)).rejects.toMatchObject({status:409});
});
it("preserves purchased events and rejects ownership injection, cross-origin writes and anonymous requests",async()=>{
  const data=input(); const created=await manageEvent(owner,"POST",undefined,data,database);
  await pg.exec(`insert into ticket_type(event_id,name,price_cents,capacity,sales_start_at,sales_end_at) values ('${created!.id}','General',1000,100,now(),now()+interval '1 day'); insert into "order"(id,buyer_email,buyer_name,subtotal_cents,total_cents) values ('00000000-0000-0000-0000-000000000030','test@example.com','Test',1000,1000); insert into order_item(order_id,ticket_type_id,quantity,unit_price_cents,total_cents) select '00000000-0000-0000-0000-000000000030',id,1,1000,1000 from ticket_type where event_id='${created!.id}'`);
  await expect(manageEvent(owner,"DELETE",created!.slug,undefined,database)).rejects.toMatchObject({status:409});
  await expect(manageEvent(admin,"PATCH",created!.slug,data,database)).rejects.toMatchObject({status:409});
  await manageEvent(owner,"PATCH",created!.slug,{imageUrl:"https://cdn.example.com/updated-cover.jpg"},database);
  expect(await manageEvent(owner,"GET",created!.slug,undefined,database)).toMatchObject({imageUrl:"https://cdn.example.com/updated-cover.jpg",hasOrders:true});
  state.actor=null; expect((await handleEventManagement(request("POST",data))).status).toBe(401);
  state.actor=await getAccessUser(owner,database);
  expect((await handleEventManagement(request("POST",data,"https://evil.example"))).status).toBe(403);
  expect((await handleEventManagement(request("POST",{...data,organizerId:other}))).status).toBe(400);
  const response=await handleEventManagement(request("POST",data)); expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("persists editable remote cover and zone inventory without creating purchases or revenue",async()=>{
  const data={...input(),imageUrl:"https://cdn.example.com/event.jpg",minimumAge:18,entryInstructions:"Presentar documento"};
  const created=await manageEvent(owner,"POST",undefined,data,database);
  const detail=await manageEvent(owner,"GET",created!.slug,undefined,database);
  expect(detail).toMatchObject({imageUrl:data.imageUrl,minimumAge:18,entryInstructions:data.entryInstructions,ticketTypes:[{zone:"Platea",priceCents:12550,capacity:100,seatingType:"seated",sessionIndexes:[0]}]});
  const row=detail as unknown as {ticketTypes:typeof data.ticketTypes};
  await manageEvent(owner,"PATCH",created!.slug,{...data,ticketTypes:row.ticketTypes.map((item)=>({...item,priceCents:18075,capacity:120}))},database);
  expect(await manageEvent(owner,"GET",created!.slug,undefined,database)).toMatchObject({ticketTypes:[{priceCents:18075,capacity:120}]});
  expect((await pg.query("select * from payment")).rows).toHaveLength(0);
  await expect(manageEvent(owner,"PATCH",created!.slug,{imageUrl:"javascript:alert(1)"},database)).rejects.toThrow();
  await expect(manageEvent(owner,"PATCH",created!.slug,{imageUrl:"https://127.0.0.1/file"},database)).rejects.toThrow();
});
it("validates numbered capacity, session ownership, sales windows and cross-event ticket ids",async()=>{
  const data=input();const option=data.ticketTypes[0];
  await expect(manageEvent(owner,"POST",undefined,{...data,ticketTypes:[{...option,sessionIndexes:[1]}]},database)).rejects.toMatchObject({status:400});
  await expect(manageEvent(owner,"POST",undefined,{...data,ticketTypes:[{...option,seatingType:"numbered",seatRows:[{label:"A",seats:10}],capacity:11}]},database)).rejects.toMatchObject({status:400});
  await expect(manageEvent(owner,"POST",undefined,{...data,ticketTypes:[{...option,salesEndAt:data.sessions[0].endsAt}]},database)).rejects.toMatchObject({status:400});
  const first=await manageEvent(owner,"POST",undefined,data,database); const detail=await manageEvent(owner,"GET",first!.slug,undefined,database);
  await expect(manageEvent(owner,"POST",undefined,{...data,ticketTypes:(detail as unknown as {ticketTypes:unknown[]}).ticketTypes},database)).rejects.toMatchObject({status:400});
  const numbered=await manageEvent(owner,"POST",undefined,{...data,ticketTypes:[{...option,seatingType:"numbered",seatRows:[{label:"A",seats:10},{label:"B",seats:10}],capacity:20}]},database);
  expect(await manageEvent(owner,"GET",numbered!.slug,undefined,database)).toMatchObject({ticketTypes:[{capacity:20,seatingType:"numbered",seatRows:[{label:"A",seats:10},{label:"B",seats:10}]}]});
});

// @vitest-environment node
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase,ids } from '@/modules/checkout/testing';
import { orders,tickets } from '@/lib/db/schema';
import { createCheckout } from '@/modules/checkout/services/createCheckout';
import { listPurchases } from '@/modules/checkout/services/listPurchases';
import { issueTickets } from './issueTickets';
import { readTickets } from './readTickets';
import { hashTicketCredential,ticketCredential } from './qrToken';
let ctx:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{vi.stubEnv('QR_SIGNING_SECRET','b'.repeat(64));ctx=await createTestDatabase();},60000);
afterAll(async()=>{await ctx.pg.close();vi.unstubAllEnvs();});
describe('Entradas y compras privadas',()=>{
  it('emite tres QR distintos solo al pagar; reintento no duplica y otro comprador no accede',async()=>{
    const order=await createCheckout({eventId:'main-event',buyer:{email:'u1@example.com',name:'Buyer'},items:[{ticketTypeId:ids.general,quantity:3}]},{id:ids.user,status:'active'},ctx.db);
    await ctx.db.transaction(tx=>issueTickets(tx,order.orderId));
    expect(await ctx.db.select().from(tickets)).toHaveLength(0);
    await ctx.pg.exec(`update "order" set status='paid' where id='${order.orderId}';update inventory_reservation set status='converted';insert into payment(order_id,idempotency_key,amount_cents,status) values ('${order.orderId}','test-paid',30000,'succeeded');`);
    await ctx.db.transaction(tx=>issueTickets(tx,order.orderId));
    const first=await ctx.db.select().from(tickets);
    await ctx.db.transaction(tx=>issueTickets(tx,order.orderId));
    expect(await ctx.db.select().from(tickets)).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first.map(ticket=>ticket.qrTokenHash)).size).toBe(3);
    for (const ticket of first) {
      const credential=ticketCredential(ticket.id);
      expect(credential).not.toContain('u1@example.com');
      expect(hashTicketCredential(credential)).toBe(ticket.qrTokenHash);
    }
    expect(await readTickets(order.orderId,{userId:ids.inactiveUser,token:null},1,ctx.db)).toBeNull();
    const page=await readTickets(order.orderId,{userId:ids.user,token:null},1,ctx.db);
    expect(page?.total).toBe(3);
    expect(new Set(page!.tickets.map(ticket=>ticket.qrImage)).size).toBe(3);
    expect(page!.tickets.every(ticket=>ticket.qrImage?.startsWith('data:image/png;base64,'))).toBe(true);
    const purchases=(await listPurchases(ids.user,1,ctx.db)).orders;
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({units:3,eventNames:'Main'});
    expect((await listPurchases(ids.inactiveUser,1,ctx.db)).orders).toHaveLength(0);
    await ctx.db.update(orders).set({status:'refunded'}).where(eq(orders.id,order.orderId));
    expect((await readTickets(order.orderId,{userId:ids.user,token:null},1,ctx.db))!.tickets.every(ticket=>ticket.qrImage===null)).toBe(true);
  });
  it('el invitado necesita el token privado y un pago sin inventario convertido no emite entradas',async()=>{
    const order=await createCheckout({eventId:'main-event',buyer:{email:'guest@example.com',name:'Guest'},items:[{ticketTypeId:ids.vip,quantity:1}]},null,ctx.db);
    expect(await readTickets(order.orderId,{userId:null,token:'wrong'},1,ctx.db)).toBeNull();
    expect((await readTickets(order.orderId,{userId:null,token:order.accessToken!},1,ctx.db))?.total).toBe(0);
    await ctx.pg.exec(`update "order" set status='paid' where id='${order.orderId}';insert into payment(order_id,idempotency_key,amount_cents,status) values ('${order.orderId}','test-paid-guest',25050,'succeeded');`);
    await expect(ctx.db.transaction(tx=>issueTickets(tx,order.orderId))).rejects.toThrow('converted inventory');
  });
});

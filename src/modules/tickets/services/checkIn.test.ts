// @vitest-environment node
import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {createTestDatabase,ids} from '@/modules/checkout/testing';
import {ticketCredential,hashTicketCredential} from './qrToken';
import {checkInTicket,listCheckInEvents} from './checkIn';
let ctx:Awaited<ReturnType<typeof createTestDatabase>>;
const ticketId='00000000-0000-4000-8000-0000000000f1';
beforeAll(async()=>{ctx=await createTestDatabase();},60000);
afterAll(async()=>{await ctx.pg.close();vi.unstubAllEnvs();});
beforeEach(async()=>{
  vi.stubEnv('QR_SIGNING_SECRET','b'.repeat(64));
  await ctx.pg.exec(`delete from audit_log;delete from check_in;delete from ticket;delete from payment;delete from order_item;delete from "order";delete from user_role;delete from user_permission;
    update "user" set status='active';update event set status='published',organizer_id='${ids.user}' where id='${ids.event}';
    insert into user_role(user_id,role_id) select '${ids.user}',id from role where name='organizer';
    insert into "order"(id,buyer_email,buyer_name,status,subtotal_cents,total_cents) values('${ticketId}','buyer@example.com','Buyer','paid',10000,10000);
    insert into order_item(id,order_id,ticket_type_id,quantity,unit_price_cents,total_cents) values('${ticketId}','${ticketId}','${ids.general}',1,10000,10000);
    insert into payment(order_id,idempotency_key,status,amount_cents,currency) values('${ticketId}','test-check-in','succeeded',10000,'pen');`);
  await ctx.pg.query('insert into ticket(id,order_item_id,unit_number,qr_token_hash) values($1,$1,1,$2)',[ticketId,hashTicketCredential(ticketCredential(ticketId))]);
});
describe('Check-in único y autorizado',()=>{
  it('consume una sola vez bajo escaneos concurrentes y no audita el token',async()=>{
    const result=await Promise.all([checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db),checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)]);
    expect(result.map(item=>item.code).sort()).toEqual(['accepted','already_used']);
    expect((await ctx.pg.query<{n:number}>('select count(*)::int n from check_in')).rows[0].n).toBe(1);
    const audit=await ctx.pg.query('select metadata from audit_log');expect(JSON.stringify(audit.rows)).not.toContain(ticketCredential(ticketId));
  });
  it('rechaza evento ajeno, cuenta inactiva y permiso revocado sin consumir',async()=>{
    await expect(checkInTicket(ids.user,'other-event',ticketCredential(ticketId),ctx.db)).resolves.toMatchObject({code:'invalid'});
    await ctx.pg.exec(`update event set organizer_id='${ids.inactiveUser}' where id='${ids.event}'`);
    await expect(checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).rejects.toMatchObject({status:404});
    await ctx.pg.exec(`update event set organizer_id='${ids.user}' where id='${ids.event}';insert into user_permission(user_id,permission_id,allowed) select '${ids.user}',id,false from permission where name='tickets.check_in'`);
    await expect(checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).rejects.toMatchObject({status:403});
    await ctx.pg.exec(`delete from user_permission;update "user" set status='inactive' where id='${ids.user}'`);
    await expect(listCheckInEvents(ids.user,ctx.db)).rejects.toMatchObject({status:403});
    expect((await ctx.pg.query<{n:number}>('select count(*)::int n from check_in')).rows[0].n).toBe(0);
  });
  it('rechaza reembolsado, no pagado o cancelado y admite otros tickets válidos de reembolso parcial',async()=>{
    await ctx.pg.exec(`update ticket set status='refunded' where id='${ticketId}'`);
    expect(await checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).toMatchObject({code:'refunded'});
    await ctx.pg.exec(`update ticket set status='valid';update "order" set status='pending'`);
    expect(await checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).toMatchObject({code:'invalid'});
    await ctx.pg.exec(`update "order" set status='partially_refunded';update payment set status='partially_refunded';update event set status='cancelled' where id='${ids.event}'`);
    expect(await checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).toMatchObject({code:'event_cancelled'});
    await ctx.pg.exec(`update event set status='published' where id='${ids.event}'`);
    expect(await checkInTicket(ids.user,'main-event',ticketCredential(ticketId),ctx.db)).toMatchObject({code:'accepted'});
  });
});

// @vitest-environment node
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest';
import { createTestDatabase,ids } from './testDatabase';
import { createCheckout } from './createCheckout';
import { getSeatAvailability } from './seatAvailability';
import { replaceSeatHolds,releaseSeatHolds } from './seatHolds';
let ctx:Awaited<ReturnType<typeof createTestDatabase>>;
const a='a'.repeat(43),b='b'.repeat(43);
const seat={rowLabel:'A',seatNumber:1};
const selection=(id=ids.general)=>({items:[{ticketTypeId:id,seats:[seat]}]});
const checkout=(token?:string)=>({eventId:'main-event',buyer:{email:'guest@example.com',name:'Guest'},items:[{ticketTypeId:ids.general,quantity:1,seats:[seat]}],...(token?{seatHoldToken:token}:{})});
beforeAll(async()=>{ctx=await createTestDatabase();await ctx.pg.exec(`update ticket_type set seating_type='numbered',zone='Platea',seat_rows='[{"label":"A","seats":5}]',capacity=5 where id in ('${ids.general}','${ids.vip}')`);},60000);
beforeEach(async()=>{await ctx.pg.exec('delete from seat_hold;delete from order_item_seat;delete from inventory_reservation;delete from order_item;delete from "order";');});
afterAll(async()=>ctx.pg.close());
describe('Bloqueo al seleccionar',()=>{
  it('bloquea por 60 segundos, oculta propiedad y no permite otra compra de la misma tribuna',async()=>{
    const hold=await replaceSeatHolds('main-event',selection(),a,ctx.db);
    expect(new Date(hold.expiresAt!).getTime()-new Date(hold.serverTime).getTime()).toBe(60000);
    expect(await getSeatAvailability('main-event',ctx.db)).toContainEqual({ticketTypeId:ids.vip,occupied:[seat]});
    expect(await getSeatAvailability('main-event',ctx.db,a)).toContainEqual({ticketTypeId:ids.general,occupied:[]});
    await expect(replaceSeatHolds('main-event',selection(ids.vip),b,ctx.db)).rejects.toMatchObject({status:409});
    await expect(createCheckout(checkout(),null,ctx.db)).rejects.toMatchObject({code:'seat_unavailable'});
    await releaseSeatHolds('main-event',b,ctx.db);
    await expect(createCheckout(checkout(),null,ctx.db)).rejects.toMatchObject({code:'seat_unavailable'});
  });
  it('libera al vencer o deseleccionar y conserva bloqueos propios tras una selección inválida',async()=>{
    await replaceSeatHolds('main-event',selection(),a,ctx.db);
    await expect(replaceSeatHolds('main-event',{items:[{ticketTypeId:ids.general,seats:[{rowLabel:'Z',seatNumber:1}]}]},a,ctx.db)).rejects.toMatchObject({status:400});
    await expect(replaceSeatHolds('main-event',selection(),b,ctx.db)).rejects.toMatchObject({status:409});
    await ctx.pg.exec("update seat_hold set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 second'");
    expect(await getSeatAvailability('main-event',ctx.db)).toContainEqual({ticketTypeId:ids.general,occupied:[]});
    await expect(createCheckout(checkout(a),null,ctx.db)).rejects.toMatchObject({code:'hold_expired'});
    await replaceSeatHolds('main-event',selection(),b,ctx.db);
    await replaceSeatHolds('main-event',{items:[]},b,ctx.db);
    await expect(replaceSeatHolds('main-event',selection(),a,ctx.db)).resolves.toMatchObject({items:selection().items});
  });
  it('convierte a pedido atómicamente; el bloqueo deja de existir pero el asiento sigue ocupado',async()=>{
    await replaceSeatHolds('main-event',selection(),a,ctx.db);
    const order=await createCheckout(checkout(a),null,ctx.db);
    expect(order.status).toBe('pending');
    expect((await ctx.pg.query<{n:number}>('select count(*)::int as n from seat_hold')).rows[0].n).toBe(0);
    await expect(replaceSeatHolds('main-event',selection(),b,ctx.db)).rejects.toMatchObject({status:409});
  });
});

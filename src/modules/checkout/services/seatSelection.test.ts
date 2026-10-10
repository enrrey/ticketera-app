// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase, ids } from "./testDatabase";
import { createCheckout } from "./createCheckout";
import { getSeatAvailability } from "./seatAvailability";
import { getCheckout } from "./getCheckout";

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { ctx = await createTestDatabase(); }, 60_000);
afterAll(async () => ctx.pg.close());

it("requires a configured seat and prevents two types sharing a zone from selling it twice", async () => {
  await ctx.pg.exec(`update ticket_type set seating_type='numbered',zone='Platea',seat_rows='[{"label":"A","seats":5}]',capacity=5 where id in ('${ids.general}','${ids.vip}')`);
  const request = (id: string, seats?: { rowLabel: string; seatNumber: number }[]) => ({ eventId: "main-event", buyer: { name: "Ana", email: "ana@example.com" }, items: [{ ticketTypeId: id, quantity: 1, seats }] });
  await expect(createCheckout(request(ids.general), null, ctx.db)).rejects.toMatchObject({ code: "invalid_seats" });
  await expect(createCheckout(request(ids.general, [{ rowLabel: "A", seatNumber: 6 }]), null, ctx.db)).rejects.toMatchObject({ code: "invalid_seats" });
  const first = await createCheckout(request(ids.general, [{ rowLabel: "A", seatNumber: 1 }]), null, ctx.db);
  expect(first.items[0]).toMatchObject({ seats: [{ rowLabel: "A", seatNumber: 1 }] });
  expect((await getCheckout(first.orderId, { userId: null, token: first.accessToken! }, ctx.db))?.items[0].seats).toEqual([{ rowLabel: "A", seatNumber: 1 }]);
  expect(await getSeatAvailability("main-event", ctx.db)).toContainEqual({ ticketTypeId: ids.vip, occupied: [{ rowLabel: "A", seatNumber: 1 }] });
  await expect(createCheckout(request(ids.vip, [{ rowLabel: "A", seatNumber: 1 }]), null, ctx.db)).rejects.toMatchObject({ code: "seat_unavailable" });
  await ctx.pg.exec(`update inventory_reservation set status='converted'`);
  await expect(createCheckout(request(ids.vip, [{ rowLabel: "A", seatNumber: 1 }]), null, ctx.db)).rejects.toMatchObject({ code: "seat_unavailable" });
  await ctx.pg.exec(`update inventory_reservation set status='released'`);
  await expect(createCheckout(request(ids.vip, [{ rowLabel: "A", seatNumber: 1 }]), null, ctx.db)).resolves.toMatchObject({ status: "pending" });
});

it("rejects repeated seats and assignments for general admission", async () => {
  const buyer = { name: "Ana", email: "ana@example.com" };
  await expect(createCheckout({ eventId: "main-event", buyer, items: [{ ticketTypeId: ids.general, quantity: 2, seats: [{ rowLabel: "A", seatNumber: 2 }, { rowLabel: "A", seatNumber: 2 }] }] }, null, ctx.db)).rejects.toMatchObject({ code: "invalid_seats" });
  await expect(createCheckout({ eventId: "main-event", buyer, items: [{ ticketTypeId: ids.general, quantity: 1 }, { ticketTypeId: ids.vip, quantity: 1 }] }, null, ctx.db)).rejects.toMatchObject({ code: "invalid_seats" });
  await ctx.pg.exec(`update ticket_type set sales_start_at=now()-interval '1 day' where id='${ids.upcoming}'`);
  await expect(createCheckout({ eventId: "main-event", buyer, items: [{ ticketTypeId: ids.upcoming, quantity: 1, seats: [{ rowLabel: "A", seatNumber: 1 }] }] }, null, ctx.db)).rejects.toMatchObject({ code: "invalid_seats" });
});

it("keeps an expired seat occupied while a Stripe payment still needs reconciliation", async () => {
  const order = await createCheckout({ eventId: "main-event", buyer: { name: "Ana", email: "ana@example.com" }, items: [{ ticketTypeId: ids.general, quantity: 1, seats: [{ rowLabel: "A", seatNumber: 2 }] }] }, null, ctx.db);
  await ctx.pg.exec(`insert into payment(order_id,idempotency_key,amount_cents) values('${order.orderId}','seat-retention',10000);
    update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes' where order_item_id in(select id from order_item where order_id='${order.orderId}')`);
  expect(await getSeatAvailability("main-event", ctx.db)).toContainEqual(expect.objectContaining({ ticketTypeId: ids.general, occupied: expect.arrayContaining([{ rowLabel: "A", seatNumber: 2 }]) }));
  await expect(createCheckout({ eventId: "main-event", buyer: { name: "Luis", email: "luis@example.com" }, items: [{ ticketTypeId: ids.vip, quantity: 1, seats: [{ rowLabel: "A", seatNumber: 2 }] }] }, null, ctx.db)).rejects.toMatchObject({ code: "seat_unavailable" });
});

it("retains expired numbered seats for cancelled-event refunds until canonical success", async () => {
  const order = await createCheckout({ eventId: "main-event", buyer: { name: "Ana", email: "ana@example.com" }, items: [{ ticketTypeId: ids.general, quantity: 1, seats: [{ rowLabel: "A", seatNumber: 3 }] }] }, null, ctx.db);
  await ctx.pg.exec(`insert into payment(order_id,idempotency_key,amount_cents,status) values('${order.orderId}','cancelled-seat-refund',10000,'succeeded');
    update "order" set status='cancelled' where id='${order.orderId}';
    update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes' where order_item_id in(select id from order_item where order_id='${order.orderId}');
    insert into refund(payment_id,idempotency_key,amount_cents,reason,status) select id,'cancelled-seat-refund-request',10000,'event_cancelled_before_payment','pending' from payment where order_id='${order.orderId}';`);
  const request = { eventId: "main-event", buyer: { name: "Luis", email: "luis@example.com" }, items: [{ ticketTypeId: ids.vip, quantity: 1, seats: [{ rowLabel: "A", seatNumber: 3 }] }] };
  for (const status of ["pending", "failed"]) {
    await ctx.pg.exec(`update refund set status='${status}' where idempotency_key='cancelled-seat-refund-request'`);
    expect(await getSeatAvailability("main-event", ctx.db)).toContainEqual(expect.objectContaining({ ticketTypeId: ids.vip, occupied: expect.arrayContaining([{ rowLabel: "A", seatNumber: 3 }]) }));
    await expect(createCheckout(request, null, ctx.db)).rejects.toMatchObject({ code: "seat_unavailable" });
  }
  await ctx.pg.exec("update refund set status='succeeded' where idempotency_key='cancelled-seat-refund-request'");
  expect(await getSeatAvailability("main-event", ctx.db)).toContainEqual(expect.objectContaining({ ticketTypeId: ids.vip, occupied: expect.not.arrayContaining([{ rowLabel: "A", seatNumber: 3 }]) }));
  await expect(createCheckout(request, null, ctx.db)).resolves.toMatchObject({ status: "pending" });
});

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDatabase, ids } from "@/modules/checkout/testing";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn(), clerkClient: vi.fn() }));
import { getTicketTypeMetrics } from "./ticketTypeMetrics";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
const admin = "00000000-0000-4000-8000-000000000088";
const customer = "00000000-0000-4000-8000-000000000089";
beforeAll(async () => {
  fixture = await createTestDatabase();
  await fixture.pg.exec(`
    insert into "user" (id,clerk_user_id,email,name,identity_updated_at) values
      ('${admin}','type-admin','type-admin@example.com','Admin',now()),
      ('${customer}','type-customer','type-customer@example.com','Customer',now());
    insert into user_role(user_id,role_id) select '${admin}',id from role where name='admin';
    insert into user_role(user_id,role_id) select '${ids.user}',id from role where name='organizer';
    insert into user_role(user_id,role_id) select '${customer}',id from role where name='customer';
    update event set organizer_id='${admin}' where id='${ids.otherEvent}';
    insert into "order"(id,buyer_email,buyer_name,status,subtotal_cents,discount_cents,total_cents) values
      ('11000000-0000-4000-8000-000000000001','buyer@example.com','Buyer','partially_refunded',30003,101,29902),
      ('11000000-0000-4000-8000-000000000002','buyer@example.com','Buyer','refunded',3333,0,3333),
      ('11000000-0000-4000-8000-000000000003','buyer@example.com','Buyer','pending',20000,0,20000),
      ('11000000-0000-4000-8000-000000000004','other@example.com','Other','paid',7777,0,7777);
    insert into order_item(id,order_id,ticket_type_id,quantity,unit_price_cents,discount_cents,total_cents) values
      ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','${ids.general}',3,10001,101,29902),
      ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','${ids.general}',1,3333,0,3333),
      ('21000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000003','${ids.general}',2,10000,0,20000),
      ('21000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000004','${ids.pastEventType}',1,7777,0,7777);
    insert into ticket(id,order_item_id,unit_number,qr_token_hash,status) values
      ('41000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',1,'type-qr-1','used'),
      ('41000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001',2,'type-qr-2','valid'),
      ('41000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001',3,'type-qr-3','refunded'),
      ('41000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000002',1,'type-qr-4','refunded');
    insert into inventory_reservation(order_item_id,quantity,status) values
      ('21000000-0000-4000-8000-000000000001',3,'converted'),
      ('21000000-0000-4000-8000-000000000002',1,'converted'),
      ('21000000-0000-4000-8000-000000000003',2,'active');
    insert into check_in(ticket_id,event_id,scanned_by_id) values ('41000000-0000-4000-8000-000000000001','${ids.event}','${ids.user}');
    insert into payment(id,order_id,idempotency_key,amount_cents,status) values
      ('31000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','type-payment-1',29902,'partially_refunded'),
      ('31000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','type-payment-retry',29902,'failed');
    insert into refund(payment_id,idempotency_key,amount_cents,status,reason) values
      ('31000000-0000-4000-8000-000000000001','type-refund-1',10000,'succeeded','requested'),
      ('31000000-0000-4000-8000-000000000001','type-refund-2',10000,'failed','requested');
  `);
}, 30000);
afterAll(async () => { await fixture.pg.close(); });

it("returns only owned types with exact discounted snapshots and refund-aware inventory, without multiplying line totals", async () => {
  const own = await getTicketTypeMetrics(ids.user, 1, fixture.db);
  expect(own).toMatchObject({ scope: "organizer", page: 1, pageSize: 50, hasNextPage: false });
  expect(own.items).toHaveLength(5);
  expect(own.items.some(item => item.eventId === ids.otherEvent)).toBe(false);
  expect(own.items.find(item => item.ticketTypeId === ids.general)).toEqual({ eventId: ids.event, eventName: "Main", ticketTypeId: ids.general, ticketTypeName: "General", soldTickets: 2, paidSalesCents: 33235, capacity: 5, committedUnits: 4, availableUnits: 1, committedPercentage: 80, checkIns: 1 });
  expect(own.items.reduce((sum, item) => sum + item.paidSalesCents, 0)).toBe(33235);
  const all = await getTicketTypeMetrics(admin, 1, fixture.db);
  expect(all.scope).toBe("global");
  expect(all.items).toHaveLength(7);
  expect(all.items.reduce((sum, item) => sum + item.paidSalesCents, 0)).toBe(41012);
  const audits = await fixture.pg.query<{ metadata: unknown }>("select metadata from audit_log where action='reporting.ticket_types_read' order by created_at");
  expect(audits.rows).toEqual([{ metadata: { scope: "organizer", page: 1 } }, { metadata: { scope: "global", page: 1 } }]);
});

it("keeps refund-pending units committed until reconciliation confirms their refund", async () => {
  await fixture.pg.exec("update ticket set status='refund_pending' where id='41000000-0000-4000-8000-000000000003'");
  const result = await getTicketTypeMetrics(ids.user, 1, fixture.db);
  expect(result.items.find(item => item.ticketTypeId === ids.general)).toMatchObject({ soldTickets: 2, committedUnits: 5, availableUnits: 0, committedPercentage: 100, paidSalesCents: 33235 });
  await fixture.pg.exec("update ticket set status='refunded' where id='41000000-0000-4000-8000-000000000003'");
});

it("revalidates active roles and effective DB permission overrides", async () => {
  await expect(getTicketTypeMetrics(customer, 1, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`insert into user_permission(user_id,permission_id,allowed) select '${customer}',id,true from permission where name='events.manage'`);
  await expect(getTicketTypeMetrics(customer, 1, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`delete from user_permission where user_id='${customer}'`);
  await expect(getTicketTypeMetrics(ids.inactiveUser, 1, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`insert into user_permission(user_id,permission_id,allowed) select '${ids.user}',id,false from permission where name='events.manage'`);
  await expect(getTicketTypeMetrics(ids.user, 1, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`delete from user_permission where user_id='${ids.user}'`);
});

it("paginates deterministically in groups of 50, including empty and invalid pages", async () => {
  await fixture.pg.exec(`insert into ticket_type(event_id,name,price_cents,capacity,sales_start_at,sales_end_at)
    select '${ids.event}', 'Extra ' || lpad(n::text,3,'0'),100,10,now()-interval '1 day',now()+interval '1 day' from generate_series(1,52) n`);
  const first = await getTicketTypeMetrics(ids.user, 1, fixture.db);
  const repeat = await getTicketTypeMetrics(ids.user, 1, fixture.db);
  const second = await getTicketTypeMetrics(ids.user, 2, fixture.db);
  expect(first.items).toHaveLength(50);
  expect(first.hasNextPage).toBe(true);
  expect(repeat.items).toEqual(first.items);
  expect(second.items).toHaveLength(7);
  expect(second.hasNextPage).toBe(false);
  const combined = [...first.items, ...second.items];
  expect(new Set(combined.map(item => item.ticketTypeId)).size).toBe(57);
  expect(combined.reduce((sum, item) => sum + item.paidSalesCents, 0)).toBe(33235);
  expect(combined.some(item => item.eventId === ids.otherEvent)).toBe(false);
  expect((await getTicketTypeMetrics(ids.user, 3, fixture.db)).items).toEqual([]);
  for (const page of [0, -1, 1.5, NaN, Infinity, 1_000_001]) await expect(getTicketTypeMetrics(ids.user, page, fixture.db)).rejects.toMatchObject({ status: 400 });
});

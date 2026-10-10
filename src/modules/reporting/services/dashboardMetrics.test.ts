import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDatabase, ids } from "@/modules/checkout/testing";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn(), clerkClient: vi.fn() }));
import { getDashboardMetrics } from "./dashboardMetrics";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
const admin = "00000000-0000-4000-8000-000000000099";
beforeAll(async () => {
  fixture = await createTestDatabase();
  await fixture.pg.exec(`
    insert into "user" (id, clerk_user_id, email, name, identity_updated_at) values ('${admin}','admin-reporting','admin@example.com','Admin',now());
    insert into user_role(user_id,role_id) select '${admin}',id from role where name='admin';
    insert into user_role(user_id,role_id) select '${ids.user}',id from role where name='organizer';
    update event set organizer_id='${admin}' where id='${ids.otherEvent}';
    insert into "order" (id,buyer_email,buyer_name,status,subtotal_cents,discount_cents,total_cents) values
      ('10000000-0000-4000-8000-000000000001','buyer@example.com','Buyer','partially_refunded',30000,1000,29000),
      ('10000000-0000-4000-8000-000000000002','other@example.com','Other','paid',5000,0,5000);
    insert into order_item (id,order_id,ticket_type_id,quantity,unit_price_cents,discount_cents,total_cents) values
      ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','${ids.general}',2,10000,1000,19000),
      ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','${ids.closed}',2,5000,0,10000),
      ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','${ids.pastEventType}',1,5000,0,5000);
    insert into payment (id,order_id,idempotency_key,amount_cents,status) values
      ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','captured-1',29000,'partially_refunded'),
      ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','failed-retry',29000,'failed'),
      ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','captured-2',5000,'succeeded');
    insert into ticket(id,order_item_id,unit_number,qr_token_hash,status) values
      ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'qr-reporting-1','used'),
      ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',2,'qr-reporting-2','refunded'),
      ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',1,'qr-reporting-3','valid'),
      ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002',2,'qr-reporting-4','refund_pending'),
      ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003',1,'qr-reporting-5','valid');
    insert into refund(payment_id,idempotency_key,amount_cents,status,reason) values
      ('30000000-0000-4000-8000-000000000001','refund-confirmed',9500,'succeeded','requested'),
      ('30000000-0000-4000-8000-000000000001','refund-pending',5000,'pending','requested'),
      ('30000000-0000-4000-8000-000000000001','refund-failed',5000,'failed','requested');
    insert into check_in(ticket_id,event_id,scanned_by_id) values ('40000000-0000-4000-8000-000000000001','${ids.event}','${ids.user}');
  `);
}, 30000);
afterAll(async () => { await fixture.pg.close(); });

it("separates organizer ownership from global totals without multiplying money by tickets or retries", async () => {
  const own = await getDashboardMetrics(ids.user, fixture.db);
  expect(own).toEqual({ scope: "organizer", soldTickets: 2, grossSalesCents: 30000, capturedCents: 29000, confirmedRefundCents: 9500, netCapturedCents: 19500, checkIns: 1, events: { draft: 1, published: 1, cancelled: 0, completed: 0 } });
  const all = await getDashboardMetrics(admin, fixture.db);
  expect(all).toMatchObject({ scope: "global", soldTickets: 3, grossSalesCents: 35000, capturedCents: 34000, confirmedRefundCents: 9500, netCapturedCents: 24500 });
  expect(all.events.published).toBe(2);
  const logs = await fixture.pg.query<{metadata: unknown}>("select metadata from audit_log where action='reporting.dashboard_read'");
  expect(logs.rows).toEqual([{ metadata: { scope: "organizer" } }, { metadata: { scope: "global" } }]);
});

it("rechecks current DB status and effective permission overrides", async () => {
  await expect(getDashboardMetrics(ids.inactiveUser, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`insert into user_permission(user_id,permission_id,allowed) select '${ids.user}',id,false from permission where name='events.manage'`);
  await expect(getDashboardMetrics(ids.user, fixture.db)).rejects.toMatchObject({ status: 403 });
  await fixture.pg.exec(`delete from user_permission where user_id='${ids.user}'`);
});

it("preserves captured and gross history after a full confirmed refund while excluding refunded units", async () => {
  await fixture.pg.exec(`
    update "order" set status='refunded' where id='10000000-0000-4000-8000-000000000001';
    update payment set status='refunded' where id='30000000-0000-4000-8000-000000000001';
    update ticket set status='refunded' where order_item_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
    insert into refund(payment_id,idempotency_key,amount_cents,status,reason) values ('30000000-0000-4000-8000-000000000001','refund-rest',19500,'succeeded','requested');
  `);
  expect(await getDashboardMetrics(ids.user, fixture.db)).toMatchObject({ soldTickets: 0, grossSalesCents: 30000, capturedCents: 29000, confirmedRefundCents: 29000, netCapturedCents: 0, checkIns: 1 });
});

// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase, ids } from "@/modules/checkout/testing";
import { events, inventoryReservations, orders, payments, refunds, refundTickets, tickets } from "@/lib/db/schema";
import type { PaymentGateway } from "@/modules/payments/server";
import { requestCancelEvent, requestTicketRefund } from "./requestRefund";
import { processTicketRefunds, reconcileTicketRefund } from "./processRefunds";

const orderId = "00000000-0000-4000-8000-0000000000f0";
const first = "00000000-0000-4000-8000-0000000000f1";
const second = "00000000-0000-4000-8000-0000000000f2";
let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
let gateway: PaymentGateway;
beforeAll(async () => { ctx = await createTestDatabase(); }, 60_000);
afterAll(async () => ctx.pg.close());
beforeEach(async () => {
  await ctx.pg.exec(`delete from audit_log; delete from refund_ticket; delete from refund; delete from check_in; delete from ticket; delete from invoice; delete from payment; delete from inventory_reservation; delete from order_item_seat; delete from order_item; delete from "order"; delete from user_permission; delete from user_role;
    update "user" set status='active'; update event set status='published',organizer_id='${ids.user}' where id='${ids.event}';
    update event_session set starts_at=now()+interval '10 days',ends_at=now()+interval '10 days 3 hours' where id='${ids.session}';
    insert into user_role(user_id,role_id) select '${ids.user}',id from role where name='organizer';
    insert into user_permission(user_id,permission_id,allowed) select '${ids.user}',id,true from permission where name='refunds.manage';
    insert into user_role(user_id,role_id) select '${ids.inactiveUser}',id from role where name='customer';
    insert into "order"(id,user_id,buyer_email,buyer_name,status,subtotal_cents,discount_cents,total_cents) values('${orderId}','${ids.inactiveUser}','buyer@example.test','Private Buyer','paid',10002,1,10001);
    insert into order_item(id,order_id,ticket_type_id,quantity,unit_price_cents,discount_cents,total_cents) values('${orderId}','${orderId}','${ids.general}',2,5001,1,10001);
    insert into inventory_reservation(order_item_id,quantity,status) values('${orderId}',2,'converted');
    insert into payment(id,order_id,stripe_payment_intent_id,stripe_checkout_session_id,idempotency_key,status,amount_cents,currency) values('${orderId}','${orderId}','pi_refund_test','cs_refund_test','refund-fixture-payment','succeeded',10001,'pen');
    insert into ticket(id,order_item_id,unit_number,qr_token_hash) values('${first}','${orderId}',1,'refund-hash1'),('${second}','${orderId}',2,'refund-hash2');`);
  gateway = {
    livemode: false, createSession: vi.fn(), expireSession: vi.fn(), readEvent: vi.fn(), readInvoice: vi.fn(),
    readSession: vi.fn().mockResolvedValue({ id: "cs_refund_test", orderId, paymentId: orderId, livemode: false, status: "complete", paymentStatus: "paid", amountCents: 10001, currency: "pen", url: null, intentStatus: "succeeded", intent: { id: "pi_refund_test", chargeId: "ch_refund_test", amountCents: 10001, currency: "pen", paidAt: new Date() } }),
    refund: vi.fn(async (_intent, amountCents, key) => ({ id: `re_${key.split(":").at(-1)}`, status: "succeeded", amountCents })),
  };
});

describe("durable ticket refunds", () => {
  it("deduplicates buyer requests, blocks tickets, and reconciles partial/full money amounts", async () => {
    const results = await Promise.all([requestTicketRefund(ids.inactiveUser, first, ctx.db), requestTicketRefund(ids.inactiveUser, first, ctx.db)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await ctx.db.select().from(refunds)).toHaveLength(1);
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, first)))[0].status).toBe("refund_pending");
    expect(gateway.refund).not.toHaveBeenCalled();
    await processTicketRefunds({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("partially_refunded");
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, second)))[0].status).toBe("valid");
    await requestTicketRefund(ids.inactiveUser, second, ctx.db);
    await processTicketRefunds({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("refunded");
    expect((await ctx.db.select().from(payments))[0].status).toBe("refunded");
    expect((await ctx.db.select().from(refundTickets)).reduce((sum, row) => sum + row.amountCents, 0)).toBe(10001);
    const audit = await ctx.pg.query("select metadata from audit_log");
    expect(JSON.stringify(audit.rows)).not.toMatch(/Private Buyer|buyer@example|refund-hash/);
  });
  it("rejects past-cutoff, used tickets, inactive buyers and foreign organizers", async () => {
    const [session] = (await ctx.pg.query<{ starts_at: Date }>("select starts_at from event_session where id=$1", [ids.session])).rows;
    await expect(requestTicketRefund(ids.inactiveUser, first, ctx.db, new Date(new Date(session.starts_at).getTime() - 48 * 3600_000 + 1))).rejects.toMatchObject({ status: 409 });
    await ctx.pg.exec(`update ticket set status='used' where id='${first}'`);
    await expect(requestTicketRefund(ids.inactiveUser, first, ctx.db)).rejects.toMatchObject({ status: 409 });
    await ctx.pg.exec(`update "user" set status='inactive' where id='${ids.inactiveUser}'`);
    await expect(requestTicketRefund(ids.inactiveUser, second, ctx.db)).rejects.toMatchObject({ status: 403 });
    await ctx.pg.exec(`update event set organizer_id='${ids.inactiveUser}' where id='${ids.event}'`);
    await expect(requestTicketRefund(ids.user, second, ctx.db)).rejects.toMatchObject({ status: 403 });
    expect(await ctx.db.select().from(refunds)).toHaveLength(0);
  });
  it("retries lost responses with one idempotency key and does not release before success", async () => {
    await requestTicketRefund(ids.inactiveUser, first, ctx.db);
    vi.mocked(gateway.refund).mockRejectedValueOnce(new Error("lost Stripe response"));
    await processTicketRefunds({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, first)))[0].status).toBe("refund_pending");
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
    await ctx.pg.exec("update refund set next_attempt_at=now()-interval '1 second'");
    await processTicketRefunds({ database: ctx.db, gateway });
    expect(vi.mocked(gateway.refund).mock.calls[0][2]).toBe(vi.mocked(gateway.refund).mock.calls[1][2]);
    expect((await ctx.db.select().from(refunds))[0].status).toBe("succeeded");
  });
  it("quarantines mismatched canonical refund amounts and never releases tickets", async () => {
    await requestTicketRefund(ids.inactiveUser, first, ctx.db);
    vi.mocked(gateway.refund).mockResolvedValue({ id: "re_wrong", amountCents: 1, status: "succeeded" });
    await processTicketRefunds({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(refunds))[0].status).toBe("requires_action");
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, first)))[0].status).toBe("refund_pending");
    expect((await ctx.db.select().from(payments))[0].status).toBe("succeeded");
  });
  it("caps retries and excludes automatic late-payment refunds", async () => {
    await requestTicketRefund(ids.inactiveUser, first, ctx.db);
    await ctx.pg.exec("update refund set attempts=5");
    await ctx.db.insert(refunds).values({ paymentId: orderId, amountCents: 1, reason: "late_payment", idempotencyKey: "automatic-fixture" });
    await processTicketRefunds({ database: ctx.db, gateway });
    expect(gateway.refund).not.toHaveBeenCalled();
    const all = await ctx.db.select().from(refunds);
    expect(all.find((row) => row.reason === "customer_request")?.status).toBe("requires_action");
    expect(all.find((row) => row.reason === "late_payment")?.status).toBe("pending");
  });
  it("recovers exhausted refunds from an existing canonical refund without resetting retries", async () => {
    const refund = await requestTicketRefund(ids.inactiveUser, first, ctx.db);
    await ctx.pg.exec("update refund set status='requires_action',attempts=5,stripe_refund_id='re_recovered'");
    vi.mocked(gateway.refund).mockResolvedValue({ id: "re_recovered", amountCents: 5001, status: "succeeded" });
    expect(await reconcileTicketRefund(refund.id!, "re_recovered", { database: ctx.db, gateway })).toBe(true);
    expect(gateway.refund).toHaveBeenCalledWith("pi_refund_test", 5001, `ticketera:refund:${refund.id}`, "re_recovered");
    expect(gateway.readSession).not.toHaveBeenCalled();
    const [saved] = await ctx.db.select().from(refunds);
    expect(saved.status).toBe("succeeded"); expect(saved.attempts).toBe(5);
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, first)))[0].status).toBe("refunded");
    expect((await ctx.db.select().from(orders))[0].status).toBe("partially_refunded");
    expect(await reconcileTicketRefund(refund.id!, "re_recovered", { database: ctx.db, gateway })).toBe(false);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });
  it("rejects recovery with a conflicting external reference or amount", async () => {
    const refund = await requestTicketRefund(ids.inactiveUser, first, ctx.db);
    await ctx.pg.exec("update refund set status='requires_action',attempts=5,stripe_refund_id='re_expected'");
    await expect(reconcileTicketRefund(refund.id!, "re_foreign", { database: ctx.db, gateway })).rejects.toThrow("reference mismatch");
    expect(gateway.refund).not.toHaveBeenCalled();
    vi.mocked(gateway.refund).mockResolvedValue({ id: "re_expected", amountCents: 1, status: "succeeded" });
    await expect(reconcileTicketRefund(refund.id!, "re_expected", { database: ctx.db, gateway })).rejects.toThrow("refund mismatch");
    expect((await ctx.db.select().from(refunds))[0].status).toBe("requires_action");
    expect((await ctx.db.select().from(tickets).where(eq(tickets.id, first)))[0].status).toBe("refund_pending");
  });
  it("mass cancellation queues paid tickets once and keeps pending reservations active", async () => {
    const pending = "00000000-0000-4000-8000-0000000000f3";
    await ctx.pg.exec(`insert into "order"(id,buyer_email,buyer_name,status,subtotal_cents,total_cents) values('${pending}','pending@example.test','Pending','pending',10000,10000);
      insert into order_item(id,order_id,ticket_type_id,quantity,unit_price_cents,total_cents) values('${pending}','${pending}','${ids.general}',1,10000,10000);
      insert into inventory_reservation(order_item_id,quantity,status) values('${pending}',1,'active');`);
    expect((await requestCancelEvent(ids.user, ids.event, ctx.db)).queued).toBe(1);
    expect((await requestCancelEvent(ids.user, ids.event, ctx.db)).queued).toBe(0);
    expect(await ctx.db.select().from(refunds)).toHaveLength(1);
    expect((await ctx.db.select().from(events).where(eq(events.id, ids.event)))[0].status).toBe("cancelled");
    expect((await ctx.db.select().from(orders).where(eq(orders.id, pending)))[0].status).toBe("pending");
    expect((await ctx.db.select().from(inventoryReservations)).some((row) => row.orderItemId === pending && row.status === "active")).toBe(true);
    await processTicketRefunds({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders).where(eq(orders.id, orderId)))[0].status).toBe("refunded");
  });
  it("denies cancellation after its persisted refund permission is revoked", async () => {
    await ctx.pg.exec(`update user_permission set allowed=false where user_id='${ids.user}'`);
    await expect(requestCancelEvent(ids.user, ids.event, ctx.db)).rejects.toMatchObject({ status: 403 });
    expect((await ctx.db.select().from(events).where(eq(events.id, ids.event)))[0].status).toBe("published");
    expect(await ctx.db.select().from(refunds)).toHaveLength(0);
  });
  it("rolls back cancellation when a legacy paid order has missing ticket issuance", async () => {
    await ctx.pg.exec("delete from ticket");
    await expect(requestCancelEvent(ids.user, ids.event, ctx.db)).rejects.toMatchObject({ status: 409 });
    expect((await ctx.db.select().from(events).where(eq(events.id, ids.event)))[0].status).toBe("published");
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
    expect(await ctx.db.select().from(refunds)).toHaveLength(0);
  });
  it("preserves completed events when cancellation is requested", async () => {
    await ctx.pg.exec(`update event set status='completed' where id='${ids.event}'`);
    await expect(requestCancelEvent(ids.user, ids.event, ctx.db)).rejects.toMatchObject({ status: 409 });
    expect((await ctx.db.select().from(events).where(eq(events.id, ids.event)))[0].status).toBe("completed");
    expect((await ctx.db.select().from(tickets)).every((ticket) => ticket.status === "valid")).toBe(true);
    expect(await ctx.db.select().from(refunds)).toHaveLength(0);
  });
});

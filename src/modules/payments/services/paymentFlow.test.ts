// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { events, inventoryReservations, orders, payments, refunds, ticketTypes, webhookEvents } from "@/lib/db/schema";
import { createTestDatabase, ids } from "@/modules/checkout/testing";
import { availableUnitsSql, getCheckout } from "@/modules/checkout/server";
import { createPayment } from "./createPayment";
import { processWebhookInbox } from "./processWebhookInbox";
import { expireReservations } from "./expireReservations";
import type { PaymentGateway, CanonicalSession } from "../types";

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { ctx = await createTestDatabase(); }, 60_000);
afterAll(async () => { await ctx.pg.close(); });
let gateway: PaymentGateway;
let session: CanonicalSession;
let orderId: string;
const token = "guest-test-token";
beforeEach(async () => {
  vi.stubEnv('QR_SIGNING_SECRET','a'.repeat(64));
  await ctx.pg.exec('delete from audit_log; delete from invoice; delete from webhook_event; delete from refund; delete from payment; delete from ticket; delete from order_item_seat; delete from inventory_reservation; delete from order_item; delete from "order";');
  await ctx.db.update(events).set({ status: "published" }).where(eq(events.id, ids.event));
  const { createHash } = await import("node:crypto");
  const [{ id }] = await ctx.db.insert(orders).values({ buyerEmail: "test@example.com", buyerName: "Test", subtotalCents: 10000, totalCents: 10000, accessTokenHash: createHash("sha256").update(token).digest("hex") }).returning();
  orderId = id;
  await ctx.pg.exec(`insert into order_item (order_id,ticket_type_id,quantity,unit_price_cents,total_cents) values ('${orderId}','${ids.general}',1,10000,10000); insert into inventory_reservation(order_item_id,quantity) select id,1 from order_item where order_id='${orderId}';`);
  session = { id: "cs_test_1", paymentId: "", orderId, livemode: false, status: "open", paymentStatus: "unpaid", amountCents: 10000, currency: "pen", url: "https://checkout.stripe.com/c/pay/cs_test_1", intentStatus: null };
  gateway = {
    livemode: false,
    createSession: vi.fn(async (input) => { session.paymentId = input.paymentId; return session; }),
    readSession: vi.fn(async () => session), expireSession: vi.fn(async () => { session = { ...session, status: "expired" }; return session; }),
    readEvent: vi.fn(async (id) => ({ id, type: "checkout.session.completed", objectId: session.id, livemode: false, paymentId: session.paymentId })),
    refund: vi.fn(async () => ({ id: "re_test", status: "succeeded", amountCents: 10000 })),
    readInvoice: vi.fn(),
  };
});
const pay = () => createPayment(orderId, { userId: null, token }, { database: ctx.db, gateway, appUrl: "http://localhost:3000" });
const send = async (id = "evt_test", type = "checkout.session.completed") => ctx.db.insert(webhookEvents).values({ provider: "stripe", externalEventId: id, type, objectId: session.id, livemode: false, providerCreatedAt: new Date() });
const succeed = async (late = false) => {
  const [reservation] = await ctx.db.select().from(inventoryReservations);
  session = { ...session, status: "complete", paymentStatus: "paid", intentStatus: "succeeded", intent: { id: "pi_test", chargeId: "ch_test", amountCents: 10000, currency: "pen", paidAt: new Date(reservation.expiresAt.getTime() + (late ? 1000 : 0)) } };
};
const stock = async () => (await ctx.db.select({ n: availableUnitsSql(sql`ticket_type.id`, sql`ticket_type.capacity`) }).from(ticketTypes).where(eq(ticketTypes.id, ids.general)))[0].n;

describe("Stripe payment flow", () => {
  it("retries a lost Elements response using the persisted UI mode and idempotency key", async () => {
    session = { ...session, url: null, clientSecret: "cs_test_secret" };
    vi.mocked(gateway.createSession).mockRejectedValueOnce(new Error("lost response"));
    const integrated = () => createPayment(orderId, { userId: null, token }, { database: ctx.db, gateway, uiMode: "elements" });
    await expect(integrated()).rejects.toThrow("lost response");
    const [attempt] = await ctx.db.select().from(payments);
    expect(attempt.uiMode).toBe("elements");
    expect(await integrated()).toEqual({ clientSecret: "cs_test_secret" });
    expect(gateway.createSession).toHaveBeenCalledTimes(2);
    for (const [input] of vi.mocked(gateway.createSession).mock.calls) expect(input).toMatchObject({ uiMode: "elements", idempotencyKey: attempt.idempotencyKey, paymentId: attempt.id });
    expect(await ctx.db.select().from(payments)).toHaveLength(1);
  });
  it("recovers expiration of a lost Elements session using its original UI mode", async () => {
    session = { ...session, url: null, clientSecret: "cs_expiration_secret" };
    vi.mocked(gateway.createSession).mockRejectedValueOnce(new Error("lost response"));
    await expect(createPayment(orderId, { userId: null, token }, { database: ctx.db, gateway, uiMode: "elements" })).rejects.toThrow();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await expireReservations({ database: ctx.db, gateway });
    const [attempt] = await ctx.db.select().from(payments);
    expect(attempt.uiMode).toBe("elements");
    expect(gateway.createSession).toHaveBeenLastCalledWith(expect.objectContaining({ uiMode: "elements", idempotencyKey: attempt.idempotencyKey, paymentId: attempt.id }));
    expect(gateway.expireSession).toHaveBeenCalledWith(session.id);
    expect((await ctx.db.select().from(orders))[0].status).toBe("expired");
    expect(await stock()).toBe(5);
  });
  it("keeps cancelled-event inventory occupied until the pending-payment refund succeeds", async () => {
    await pay();
    await ctx.db.update(events).set({ status: "cancelled" }).where(eq(events.id, ids.event));
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await succeed(true); await send();
    vi.mocked(gateway.refund).mockResolvedValueOnce({ id: "re_test", status: "pending", amountCents: 10000 });
    const fulfill = vi.fn();
    await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    expect(fulfill).not.toHaveBeenCalled();
    expect((await ctx.db.select().from(refunds))[0]).toMatchObject({ reason: "event_cancelled_before_payment", status: "pending" });
    expect((await ctx.db.select().from(inventoryReservations))[0].status).toBe("active");
    expect(await stock()).toBe(4);
    expect(await getCheckout(orderId, { userId: null, token }, ctx.db)).toMatchObject({ status: "cancelled", latePayment: true, refundStatus: "pending" });
    await ctx.pg.exec("update refund set status='failed',attempts=5");
    expect(await stock()).toBe(4);
    expect(await getCheckout(orderId, { userId: null, token }, ctx.db)).toMatchObject({ refundStatus: "failed" });
    await ctx.db.insert(webhookEvents).values({ provider: "stripe", externalEventId: "evt_cancel_refund", type: "refund.updated", objectId: "re_test", livemode: false, providerCreatedAt: new Date() });
    vi.mocked(gateway.readEvent).mockResolvedValueOnce({ id: "evt_cancel_refund", type: "refund.updated", objectId: "re_test", livemode: false, paymentId: session.paymentId });
    await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    expect((await ctx.db.select().from(refunds))[0].status).toBe("succeeded");
    expect((await ctx.db.select().from(inventoryReservations))[0].status).toBe("released");
    expect(await stock()).toBe(5);
    expect(await getCheckout(orderId, { userId: null, token }, ctx.db)).toMatchObject({ refundStatus: "succeeded" });
    expect(gateway.refund).toHaveBeenLastCalledWith("pi_test", 10000, expect.any(String), "re_test");
  });
  it("creates/reuses one durable payment and sends only server totals without guest token", async () => {
    expect(await pay()).toEqual({ url: session.url });
    expect(await pay()).toEqual({ url: session.url });
    expect(await ctx.db.select().from(payments)).toHaveLength(1);
    expect(gateway.createSession).toHaveBeenCalledTimes(1);
    expect(gateway.createSession).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 10000, currency: "pen", orderId }));
    expect(JSON.stringify(vi.mocked(gateway.createSession).mock.calls)).not.toContain(token);
  });
  it("hides missing and unauthorized orders and refuses expired reservations without Stripe", async () => {
    await expect(createPayment(orderId, { userId: null, token: "wrong" }, { database: ctx.db, gateway })).rejects.toMatchObject({ status: 404 });
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await expect(pay()).rejects.toMatchObject({ status: 409 });
    expect(gateway.createSession).not.toHaveBeenCalled();
    expect(await ctx.db.select().from(payments)).toHaveLength(0);
  });
  it("retains the same idempotency key after a lost Stripe response", async () => {
    vi.mocked(gateway.createSession).mockRejectedValueOnce(new Error("network"));
    await expect(pay()).rejects.toThrow();
    const [attempt] = await ctx.db.select().from(payments);
    await pay();
    expect(await ctx.db.select().from(payments)).toHaveLength(1);
    expect(gateway.createSession).toHaveBeenLastCalledWith(expect.objectContaining({ paymentId: attempt.id, idempotencyKey: attempt.idempotencyKey }));
  });
  it("confirms a payment at the deadline exactly once even with duplicate/out of order notifications", async () => {
    await pay(); await succeed(); await send();
    const fulfill = vi.fn();
    await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    await send("evt_second");
    await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
    expect((await ctx.db.select().from(inventoryReservations))[0].status).toBe("converted");
    expect(fulfill).toHaveBeenCalledTimes(1);
    expect(await stock()).toBe(4);
    expect((await ctx.db.select().from(webhookEvents)).every((e) => e.status === "processed")).toBe(true);
  });
  it("does not accept a mismatched canonical amount", async () => {
    await pay(); await succeed(); session.amountCents = 999; await send();
    await processWebhookInbox({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("pending");
    expect((await ctx.db.select().from(webhookEvents))[0].status).toBe("failed");
  });
  it("honors a punctual payment delivered after expiry and never downgrades success on a later failure", async () => {
    await pay();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await succeed(); await send();
    await processWebhookInbox({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
    session = { ...session, paymentStatus: "unpaid", intentStatus: "requires_payment_method", intent: undefined };
    await send("evt_failure"); await processWebhookInbox({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(payments))[0].status).toBe("succeeded");
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
  });
  it("recovers the same refund after a network failure without selling the late order", async () => {
    await pay(); await succeed(true); await send();
    vi.mocked(gateway.refund).mockRejectedValueOnce(new Error("lost response"));
    await processWebhookInbox({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("cancelled");
    expect((await ctx.db.select().from(refunds))[0].status).toBe("pending");
    await ctx.pg.exec("update webhook_event set next_attempt_at=now()-interval '1 minute'; update refund set next_attempt_at=now()-interval '1 minute'");
    await processWebhookInbox({ database: ctx.db, gateway });
    expect(await ctx.db.select().from(refunds)).toHaveLength(1);
    expect(vi.mocked(gateway.refund).mock.calls[0][2]).toBe(vi.mocked(gateway.refund).mock.calls[1][2]);
    expect((await ctx.db.select().from(payments))[0].status).toBe("refunded");
  });
  it("persists a post-payment invoice without a second charge", async () => {
    await pay(); await succeed(); session.invoiceId = "in_test";
    vi.mocked(gateway.readInvoice).mockResolvedValue({ id: "in_test", paymentId: session.paymentId, orderId, customerId: "cus_test", livemode: false, status: "paid", amountCents: 10000, currency: "pen", hostedUrl: "https://invoice.stripe.com/i/test", pdfUrl: "https://pay.stripe.com/invoice/test/pdf" });
    await send(); await processWebhookInbox({ database: ctx.db, gateway });
    const rows = await ctx.pg.query("select * from invoice");
    expect(rows.rows).toHaveLength(1);
    expect(await ctx.db.select().from(payments)).toHaveLength(1);
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
  });
  it("ignores unsupported events and rejects the wrong Stripe mode", async () => {
    await send("evt_unknown", "customer.created");
    await processWebhookInbox({ database: ctx.db, gateway });
    expect(gateway.readEvent).not.toHaveBeenCalled();
    await ctx.db.insert(webhookEvents).values({ provider: "stripe", externalEventId: "evt_live", type: "checkout.session.completed", objectId: "cs_live", livemode: true, providerCreatedAt: new Date() });
    await processWebhookInbox({ database: ctx.db, gateway });
    const records = await ctx.db.select().from(webhookEvents);
    expect(records.find((e) => e.externalEventId === "evt_unknown")?.status).toBe("processed");
    expect(records.find((e) => e.externalEventId === "evt_live")?.status).toBe("failed");
  });
  it("recovers a lost session reference during expiration using the durable attempt", async () => {
    vi.mocked(gateway.createSession).mockRejectedValueOnce(new Error("lost response"));
    await expect(pay()).rejects.toThrow();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await expireReservations({ database: ctx.db, gateway });
    expect(gateway.createSession).toHaveBeenCalledTimes(2);
    expect(gateway.expireSession).toHaveBeenCalledWith(session.id);
    expect((await ctx.db.select().from(orders))[0].status).toBe("expired");
    expect(await stock()).toBe(5);
  });
  it("keeps inventory for a completed session whose intent is still processing", async () => {
    await pay();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    session = { ...session, status: "complete", paymentStatus: "unpaid", intentStatus: "processing" };
    await expireReservations({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("pending");
    expect(await stock()).toBe(4);
  });
  it("releases a completed session after Stripe confirms its intent was canceled", async () => {
    await pay();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    session = { ...session, status: "complete", paymentStatus: "unpaid", intentStatus: "canceled" };
    await expireReservations({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("expired");
    expect(await stock()).toBe(5);
  });
  it("reconciles a genuine refund notification after local retries were exhausted", async () => {
    await pay(); await succeed(true); await send();
    vi.mocked(gateway.refund).mockResolvedValueOnce({ id: "re_test", status: "pending", amountCents: 10000 });
    await processWebhookInbox({ database: ctx.db, gateway });
    await ctx.pg.exec("update refund set status='failed',attempts=5");
    await ctx.db.insert(webhookEvents).values({ provider: "stripe", externalEventId: "evt_refund", type: "refund.updated", objectId: "re_test", livemode: false, providerCreatedAt: new Date() });
    vi.mocked(gateway.readEvent).mockResolvedValueOnce({ id: "evt_refund", type: "refund.updated", objectId: "re_test", livemode: false, paymentId: session.paymentId });
    await processWebhookInbox({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(refunds))[0].status).toBe("succeeded");
    expect((await ctx.db.select().from(payments))[0].status).toBe("refunded");
    expect(gateway.refund).toHaveBeenLastCalledWith("pi_test", 10000, expect.any(String), "re_test");
  });
  it("recovers a refund discovered during expiration without needing another webhook", async () => {
    await pay();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    await succeed(true);
    vi.mocked(gateway.refund).mockRejectedValueOnce(new Error("offline"));
    await expireReservations({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(orders))[0].status).toBe("cancelled");
    await ctx.pg.exec("update refund set next_attempt_at=now()-interval '1 minute'");
    await expireReservations({ database: ctx.db, gateway });
    expect((await ctx.db.select().from(payments))[0].status).toBe("refunded");
    expect(gateway.refund).toHaveBeenCalledTimes(2);
  });
  it("refunds a late payment once without confirming the order or issuing tickets", async () => {
    await pay(); await succeed(true); await send();
    const fulfill = vi.fn();
    await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    await send("evt_second"); await processWebhookInbox({ database: ctx.db, gateway, fulfill });
    expect((await ctx.db.select().from(orders))[0].status).toBe("cancelled");
    expect((await ctx.db.select().from(payments))[0].status).toBe("refunded");
    expect(await ctx.db.select().from(refunds)).toHaveLength(1);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect(fulfill).not.toHaveBeenCalled();
  });
  it("keeps expired inventory protected until Stripe can be reconciled then closes and releases it", async () => {
    await pay();
    await ctx.pg.exec("update inventory_reservation set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'");
    expect(await stock()).toBe(4);
    vi.mocked(gateway.readSession).mockRejectedValueOnce(new Error("offline"));
    await expireReservations({ database: ctx.db, gateway });
    expect(await stock()).toBe(4);
    expect((await ctx.db.select().from(orders))[0].status).toBe("pending");
    await expireReservations({ database: ctx.db, gateway });
    expect(gateway.expireSession).toHaveBeenCalledWith(session.id);
    expect((await ctx.db.select().from(orders))[0].status).toBe("expired");
    expect(await stock()).toBe(5);
  });
  it("retries transient failures with backoff, recovers stale leases, and stops at five attempts", async () => {
    await pay(); await send(); vi.mocked(gateway.readEvent).mockRejectedValue(new Error("offline"));
    await processWebhookInbox({ database: ctx.db, gateway });
    let [event] = await ctx.db.select().from(webhookEvents);
    expect(event).toMatchObject({ status: "pending", attempts: 1 });
    await processWebhookInbox({ database: ctx.db, gateway });
    expect(gateway.readEvent).toHaveBeenCalledTimes(1);
    await ctx.pg.exec("update webhook_event set status='processing',attempts=4,claimed_at=now()-interval '6 minutes',next_attempt_at=now()-interval '1 minute'");
    await processWebhookInbox({ database: ctx.db, gateway });
    [event] = await ctx.db.select().from(webhookEvents);
    expect(event).toMatchObject({ status: "failed", attempts: 5 });
  });
  it("allows only the new lease owner to confirm an event after a stalled worker resumes", async () => {
    await pay(); await succeed(); await send();
    const event = { id: "evt_test", type: "checkout.session.completed", objectId: session.id, livemode: false, paymentId: session.paymentId };
    let resume!: (value: typeof event) => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    vi.mocked(gateway.readEvent).mockImplementationOnce(() => new Promise((resolve) => { resume = resolve; entered(); }));
    const fulfill = vi.fn();
    const stalled = processWebhookInbox({ database: ctx.db, gateway, fulfill, limit: 1 });
    await ready;
    await ctx.pg.exec("update webhook_event set claimed_at=now()-interval '6 minutes'");
    await processWebhookInbox({ database: ctx.db, gateway, fulfill, limit: 1 });
    resume(event); await stalled;
    expect(fulfill).toHaveBeenCalledTimes(1);
    expect((await ctx.db.select().from(webhookEvents))[0]).toMatchObject({ status: "processed", attempts: 2 });
    expect((await ctx.db.select().from(orders))[0].status).toBe("paid");
  });
});

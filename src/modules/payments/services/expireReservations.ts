import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { auditLogs, inventoryReservations, orderItems, orders, payments } from "@/lib/db/schema";
import type { PaymentDependencies } from "../types";
import { createStripeGateway } from "./stripeClient";
import { applySession, completeAutomaticRefund, processAutomaticRefunds } from "./reconcilePayment";

export async function expireReservations(options: Partial<PaymentDependencies> & { limit?: number } = {}) {
  const dependencies: PaymentDependencies = { database: options.database ?? getDatabase(), gateway: options.gateway ?? createStripeGateway(), fulfill: options.fulfill };
  const { database, gateway } = dependencies;
  const candidates = await database.select({ id: orders.id }).from(orders).where(and(eq(orders.status, "pending"), sql`exists(select 1 from inventory_reservation r join order_item oi on oi.id=r.order_item_id where oi.order_id=${orders.id} and r.status='active' and r.expires_at<=now())`)).orderBy(orders.updatedAt, orders.id).limit(Math.min(options.limit ?? 20, 100));
  const result = { expired: 0, deferred: 0 };
  for (const order of candidates) {
    try {
      // Lookup/create recovery happens outside an inventory transaction, with a durable idempotency key.
      const [payment] = await database.select().from(payments).where(eq(payments.orderId, order.id));
      if (payment) {
        let session;
        if (payment.stripeCheckoutSessionId) session = await gateway.readSession(payment.stripeCheckoutSessionId);
        else {
          const [buyer] = await database.select().from(orders).where(eq(orders.id, order.id));
          session = await gateway.createSession({ paymentId: payment.id, orderId: order.id, idempotencyKey: payment.idempotencyKey, amountCents: payment.amountCents, currency: payment.currency, buyerEmail: buyer.buyerEmail, appUrl: new URL(process.env.APP_URL ?? "http://localhost:3000").origin, ...(payment.uiMode==='elements'?{uiMode:payment.uiMode}:{}) });
          await database.update(payments).set({ stripeCheckoutSessionId: session.id }).where(eq(payments.id, payment.id));
        }
        if (session.status === "open") session = await gateway.expireSession(session.id);
        await applySession(session, dependencies);
        if (session.paymentStatus === "paid") { await completeAutomaticRefund(payment.id, dependencies); continue; }
        if (session.status !== "expired" && session.intentStatus !== "canceled") throw new Error("Stripe payment has not reached a terminal state");
      }
      await database.transaction(async (tx) => {
        const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
        if (current.status !== "pending") return;
        const [latest] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
        if (latest?.id !== payment?.id) throw new Error("Payment appeared during expiry; retry reconciliation");
        const items = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, order.id));
        await tx.update(inventoryReservations).set({ status: "released" }).where(and(inArray(inventoryReservations.orderItemId, items.map((item) => item.id)), eq(inventoryReservations.status, "active")));
        await tx.update(orders).set({ status: "expired", updatedAt: new Date() }).where(eq(orders.id, order.id));
        await tx.insert(auditLogs).values({ action: "order.expired", entity: "order", entityId: order.id });
        result.expired++;
      });
    } catch {
      // Rotate deferred orders so a slow Stripe payment cannot starve every other expired reservation.
      await database.update(orders).set({ updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
      result.deferred++;
    }
  }
  await processAutomaticRefunds(dependencies);
  return result;
}

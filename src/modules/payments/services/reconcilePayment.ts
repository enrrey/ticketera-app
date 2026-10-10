import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, events, inventoryReservations, invoices, orderItems, orders, payments, refunds, ticketTypes } from "@/lib/db/schema";
import { ReconciliationError, type CanonicalInvoice, type CanonicalSession, type PaymentDatabase, type PaymentDependencies } from "../types";
import { issueTickets } from "@/modules/tickets/server";

export async function saveInvoice(invoice: CanonicalInvoice, dependencies: PaymentDependencies) {
  const { database, gateway } = dependencies;
  await database.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, invoice.paymentId));
    if (!payment || payment.orderId !== invoice.orderId || payment.amountCents !== invoice.amountCents || payment.currency !== invoice.currency || gateway.livemode !== invoice.livemode || !invoice.customerId) throw new ReconciliationError("Invoice mismatch");
    await tx.insert(invoices).values({ orderId: payment.orderId, paymentId: payment.id, stripeInvoiceId: invoice.id, stripeCustomerId: invoice.customerId,
      status: invoice.status, amountCents: invoice.amountCents, currency: invoice.currency, hostedInvoiceUrl: invoice.hostedUrl, invoicePdfUrl: invoice.pdfUrl })
      .onConflictDoUpdate({ target: invoices.stripeInvoiceId, set: { status: invoice.status, hostedInvoiceUrl: invoice.hostedUrl, invoicePdfUrl: invoice.pdfUrl, updatedAt: new Date() } });
  });
}

/** All inventory/order effects and the future ticket insertion hook share one transaction. */
export async function applySession(session: CanonicalSession, dependencies: PaymentDependencies, transaction?: PaymentDatabase) {
  const { database, gateway, fulfill } = dependencies;
  const apply = async (tx: PaymentDatabase) => {
    const [reference] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, session.paymentId));
    if (!reference) throw new ReconciliationError("Payment not found");
    const eventStates=await tx.select({id:events.id,status:events.status}).from(events).where(sql`exists(select 1 from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id where oi.order_id=${reference.orderId} and tt.event_id=${events.id})`).orderBy(events.id).for('update');
    const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
    const [payment] = await tx.select().from(payments).where(eq(payments.id, session.paymentId)).for("update");
    if (session.orderId !== order.id || session.amountCents !== payment.amountCents || session.currency !== payment.currency || order.totalCents !== payment.amountCents || gateway.livemode !== session.livemode || (payment.stripeCheckoutSessionId && payment.stripeCheckoutSessionId !== session.id)) throw new ReconciliationError("Payment references or amount mismatch");
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!lines.length) throw new ReconciliationError("Order has no inventory");
    await tx.select({ id: ticketTypes.id }).from(ticketTypes).where(inArray(ticketTypes.id, lines.map((item) => item.ticketTypeId))).orderBy(ticketTypes.id).for("update");
    const reservations = await tx.select().from(inventoryReservations).where(inArray(inventoryReservations.orderItemId, lines.map((item) => item.id))).for("update");
    if (reservations.length !== lines.length) throw new ReconciliationError("Incomplete reservation");
    const reservationIds = reservations.map((reservation) => reservation.id);
    if (session.paymentStatus === "paid") {
      const intent = session.intent;
      if (!intent || !Number.isFinite(intent.paidAt.getTime()) || intent.amountCents !== payment.amountCents || intent.currency !== payment.currency || (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== intent.id)) throw new ReconciliationError("Canonical success mismatch");
      if (["paid", "partially_refunded", "refunded"].includes(order.status)) return;
      await tx.update(payments).set({ status: payment.status === "refunded" ? "refunded" : "succeeded", stripeCheckoutSessionId: session.id, stripePaymentIntentId: intent.id, stripeChargeId: intent.chargeId, paidAt: intent.paidAt, updatedAt: new Date() }).where(eq(payments.id, payment.id));
      if (session.customerId) await tx.update(orders).set({ stripeCustomerId: session.customerId }).where(eq(orders.id, order.id));
      const onTime = reservations.every((reservation) => intent.paidAt <= reservation.expiresAt);
      const cancelledEvent=eventStates.some(event=>event.status==='cancelled');
      if (onTime && !cancelledEvent && order.status === "pending" && reservations.every((reservation) => reservation.status === "active")) {
        await tx.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, order.id));
        await tx.update(inventoryReservations).set({ status: "converted" }).where(inArray(inventoryReservations.id, reservationIds));
        await (fulfill ?? issueTickets)(tx, order.id);
        await tx.insert(auditLogs).values({ action: "payment.confirmed", entity: "order", entityId: order.id, metadata: { paymentId: payment.id } });
      } else {
        // Never consume released or re-sold inventory, including exceptional reconciliation races.
        await tx.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));
        if(!cancelledEvent) await tx.update(inventoryReservations).set({ status: "released" }).where(and(inArray(inventoryReservations.id, reservationIds), eq(inventoryReservations.status, "active")));
        await tx.insert(refunds).values({ paymentId: payment.id, amountCents: payment.amountCents, idempotencyKey: `ticketera:late:${payment.id}`, reason: cancelledEvent ? 'event_cancelled_before_payment' : onTime ? "inventory_unavailable" : "late_payment" }).onConflictDoNothing({ target: refunds.idempotencyKey });
      }
    } else if (!["succeeded", "refunded", "partially_refunded"].includes(payment.status)) {
      const status = session.status === "expired" || session.intentStatus === "canceled" ? "cancelled" : session.intentStatus === "requires_payment_method" ? "failed" : session.intentStatus === "processing" ? "processing" : "pending";
      await tx.update(payments).set({ status, stripeCheckoutSessionId: session.id, updatedAt: new Date() }).where(eq(payments.id, payment.id));
    }
  };
  if (transaction) await apply(transaction); else await database.transaction(apply);
}

export async function completeAutomaticRefund(paymentId: string, dependencies: PaymentDependencies, canonicalId?: string) {
  const { database, gateway } = dependencies;
  const refund = await database.transaction(async (tx) => {
    const [due] = await tx.select().from(refunds).where(and(eq(refunds.paymentId, paymentId), canonicalId ? sql`${refunds.status}<>'succeeded'` : eq(refunds.status, "pending"),
      inArray(refunds.reason, ["late_payment", "inventory_unavailable",'event_cancelled_before_payment']), canonicalId ? sql`true` : sql`${refunds.nextAttemptAt}<=now()`)).for("update", { skipLocked: true });
    if (!due) return null;
    // The future retry time also leases this request to one worker. Stripe calls time out within 5 minutes.
    const [claimed] = await tx.update(refunds).set({ attempts: due.attempts + 1, nextAttemptAt: new Date(Date.now() + 300_000) }).where(eq(refunds.id, due.id)).returning();
    return claimed;
  });
  if (!refund) return;
  const [payment] = await database.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment?.stripePaymentIntentId) throw new ReconciliationError("Refund requires canonical payment intent");
  let canonical;
  try {
    if (refund.attempts > 5 && !canonicalId) throw new ReconciliationError("Refund retry budget exhausted");
    canonical = await gateway.refund(payment.stripePaymentIntentId, refund.amountCents, refund.idempotencyKey, canonicalId ?? refund.stripeRefundId);
    if (canonical.amountCents !== refund.amountCents || !["pending", "requires_action", "succeeded", "failed", "cancelled"].includes(canonical.status)) throw new ReconciliationError("Refund mismatch");
  } catch (error) {
    const terminal = error instanceof ReconciliationError || refund.attempts >= 5;
    await database.transaction(async (tx) => {
      await tx.update(refunds).set({ status: terminal ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (refund.attempts - 1)), updatedAt: new Date() }).where(and(eq(refunds.id, refund.id), eq(refunds.attempts, refund.attempts)));
      if (terminal) await tx.insert(auditLogs).values({ action: "payment.refund_needs_attention", entity: "refund", entityId: refund.id, metadata: { reason: "retry_exhausted_or_mismatch" } });
    });
    throw error;
  }
  await database.transaction(async (tx) => {
    await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for("update");
    const changed=await tx.update(refunds).set({ stripeRefundId: canonical.id, status: canonical.status, nextAttemptAt: new Date(Date.now() + 60_000), updatedAt: new Date() }).where(and(eq(refunds.id, refund.id), eq(refunds.attempts, refund.attempts))).returning({id:refunds.id});
    if (canonical.status === "succeeded" && changed.length) {
      await tx.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, payment.id));
      if(refund.reason==='event_cancelled_before_payment'){
        await tx.update(inventoryReservations).set({status:'released'}).where(sql`${inventoryReservations.orderItemId} in (select oi.id from order_item oi where oi.order_id=${payment.orderId}) and ${inventoryReservations.status}='active'`);
      }
    }
  });
  if (["failed", "cancelled", "requires_action"].includes(canonical.status)) {
    await database.insert(auditLogs).values({ action: "payment.refund_needs_attention", entity: "refund", entityId: refund.id, metadata: { status: canonical.status } });
  }
}

/** Recover refunds discovered by expiry even when no further webhook arrives. */
export async function processAutomaticRefunds(dependencies: PaymentDependencies) {
  const due = await dependencies.database.select({ paymentId: refunds.paymentId }).from(refunds).where(and(eq(refunds.status, "pending"),
    inArray(refunds.reason, ["late_payment", "inventory_unavailable",'event_cancelled_before_payment']), sql`${refunds.nextAttemptAt}<=now()`)).limit(20);
  const result = { checked: 0, deferred: 0 };
  for (const refund of due) {
    try { await completeAutomaticRefund(refund.paymentId, dependencies); result.checked++; }
    catch { result.deferred++; }
  }
  return result;
}

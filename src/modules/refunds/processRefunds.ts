import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { auditLogs, events, orderItems, orders, payments, refunds, refundTickets, tickets, ticketTypes } from "@/lib/db/schema";
import { createStripeGateway, type PaymentDatabase, type PaymentGateway } from "@/modules/payments/server";
import { maxRefundAttempts, refundReasons } from "./refundPolicy";

class RefundMismatch extends Error {}
type Dependencies = { database: PaymentDatabase; gateway: PaymentGateway };
type Refund = typeof refunds.$inferSelect;

async function finalize(claim: Refund, canonical: Awaited<ReturnType<PaymentGateway["refund"]>>, database: PaymentDatabase) {
  return database.transaction(async (tx) => {
    const [reference] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, claim.paymentId));
    if (!reference) throw new RefundMismatch("Missing payment");
    const eventRefs = await tx.selectDistinct({ id: ticketTypes.eventId }).from(refundTickets).innerJoin(tickets, eq(tickets.id, refundTickets.ticketId)).innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId)).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).where(eq(refundTickets.refundId, claim.id)).orderBy(ticketTypes.eventId);
    if (!eventRefs.length) throw new RefundMismatch("Missing ticket links");
    await tx.select({ id: events.id }).from(events).where(inArray(events.id, eventRefs.map((row) => row.id))).orderBy(events.id).for("update");
    const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
    const [payment] = await tx.select().from(payments).where(eq(payments.id, claim.paymentId)).for("update");
    const [owned] = await tx.select().from(refunds).where(and(eq(refunds.id, claim.id), eq(refunds.attempts, claim.attempts), inArray(refunds.status, ["pending", "failed", "requires_action"]))).for("update");
    if (!owned) return false;
    const links = await tx.select({ ticketId: refundTickets.ticketId, amountCents: refundTickets.amountCents, orderId: orderItems.orderId }).from(refundTickets).innerJoin(tickets, eq(tickets.id, refundTickets.ticketId)).innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId)).where(eq(refundTickets.refundId, claim.id));
    await tx.select({ id: tickets.id }).from(tickets).where(inArray(tickets.id, links.map((row) => row.ticketId))).orderBy(tickets.id).for("update");
    if (links.some((link) => link.orderId !== order.id) || links.reduce((sum, link) => sum + link.amountCents, 0) !== owned.amountCents || payment.amountCents !== order.totalCents || payment.currency !== order.currency) throw new RefundMismatch("Refund allocation mismatch");
    const successful = await tx.select({ amountCents: refunds.amountCents }).from(refunds).where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, "succeeded")));
    const refundedCents = successful.reduce((sum, row) => sum + row.amountCents, 0) + (canonical.status === "succeeded" ? claim.amountCents : 0);
    if (refundedCents > payment.amountCents) throw new RefundMismatch("Refund exceeds payment");
    const terminalFailure = ["failed", "cancelled", "requires_action"].includes(canonical.status);
    const status = canonical.status === "cancelled" ? "failed" : canonical.status;
    await tx.update(refunds).set({ stripeRefundId: canonical.id, status, attempts: terminalFailure ? maxRefundAttempts : claim.attempts,
      nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (claim.attempts - 1)), updatedAt: new Date() }).where(eq(refunds.id, claim.id));
    if (canonical.status === "succeeded") {
      await tx.update(tickets).set({ status: "refunded" }).where(inArray(tickets.id, links.map((row) => row.ticketId)));
      const paymentStatus = refundedCents === payment.amountCents ? "refunded" : "partially_refunded";
      await tx.update(payments).set({ status: paymentStatus, updatedAt: new Date() }).where(eq(payments.id, payment.id));
      await tx.update(orders).set({ status: paymentStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(auditLogs).values({ action: "refund.succeeded", entity: "refund", entityId: claim.id, metadata: { amountCents: claim.amountCents, ticketCount: links.length } });
    } else if (terminalFailure) await tx.insert(auditLogs).values({ action: "refund.needs_attention", entity: "refund", entityId: claim.id, metadata: { status: canonical.status } });
    return true;
  });
}

/** A canonical webhook can recover a completed refund after its polling budget was exhausted. */
export async function reconcileTicketRefund(refundId: string, canonicalRefundId: string, { database, gateway }: Dependencies) {
  const [claim] = await database.select().from(refunds).where(and(eq(refunds.id, refundId), inArray(refunds.reason, [...refundReasons])));
  if (!claim || ["succeeded", "cancelled"].includes(claim.status)) return false;
  if (!canonicalRefundId || claim.stripeRefundId && claim.stripeRefundId !== canonicalRefundId) throw new RefundMismatch("Canonical refund reference mismatch");
  const [payment] = await database.select().from(payments).where(eq(payments.id, claim.paymentId));
  if (!payment?.stripePaymentIntentId) throw new RefundMismatch("Missing canonical payment intent");
  // Supplying existingId always retrieves Stripe's persisted refund; never creates one.
  const canonical = await gateway.refund(payment.stripePaymentIntentId, claim.amountCents, claim.idempotencyKey, canonicalRefundId);
  if (canonical.id !== canonicalRefundId || canonical.amountCents !== claim.amountCents || !["pending", "requires_action", "succeeded", "failed", "cancelled"].includes(canonical.status)) throw new RefundMismatch("Canonical refund mismatch");
  return finalize(claim, canonical, database);
}

/** Stripe calls run outside transactions; attempts and nextAttemptAt form a recoverable lease. */
export async function processTicketRefunds(options: Partial<Dependencies> & { limit?: number } = {}) {
  const database = options.database ?? getDatabase();
  const gateway = options.gateway ?? createStripeGateway();
  const result = { checked: 0, deferred: 0, needsAttention: 0 };
  for (let index = 0; index < Math.min(Math.max(options.limit ?? 20, 0), 100); index++) {
    const claim = await database.transaction(async (tx) => {
      const [due] = await tx.select().from(refunds).where(and(inArray(refunds.reason, [...refundReasons]), inArray(refunds.status, ["pending", "failed"]), sql`${refunds.nextAttemptAt} <= now()`)).orderBy(refunds.nextAttemptAt, refunds.id).limit(1).for("update", { skipLocked: true });
      if (!due) return null;
      if (due.attempts >= maxRefundAttempts) {
        await tx.update(refunds).set({ status: "requires_action", updatedAt: new Date() }).where(eq(refunds.id, due.id));
        await tx.insert(auditLogs).values({ action: "refund.needs_attention", entity: "refund", entityId: due.id, metadata: { reason: "attempts_exhausted" } });
        return { ...due, exhausted: true };
      }
      const [owned] = await tx.update(refunds).set({ attempts: due.attempts + 1, nextAttemptAt: new Date(Date.now() + 300_000), updatedAt: new Date() }).where(eq(refunds.id, due.id)).returning();
      return { ...owned, exhausted: false };
    });
    if (!claim) break;
    if (claim.exhausted) { result.needsAttention++; continue; }
    try {
      const [payment] = await database.select().from(payments).where(eq(payments.id, claim.paymentId));
      if (!payment?.stripePaymentIntentId || !payment.stripeCheckoutSessionId || !["succeeded", "partially_refunded"].includes(payment.status)) throw new RefundMismatch("Missing canonical payment");
      const session = await gateway.readSession(payment.stripeCheckoutSessionId);
      if (session.id !== payment.stripeCheckoutSessionId || session.paymentId !== payment.id || session.orderId !== payment.orderId || session.livemode !== gateway.livemode || session.paymentStatus !== "paid" || session.amountCents !== payment.amountCents || session.currency !== payment.currency || session.intent?.id !== payment.stripePaymentIntentId || session.intent.amountCents !== payment.amountCents || session.intent.currency !== payment.currency) throw new RefundMismatch("Canonical payment mismatch");
      const canonical = await gateway.refund(payment.stripePaymentIntentId, claim.amountCents, claim.idempotencyKey, claim.stripeRefundId);
      if (!canonical.id || canonical.amountCents !== claim.amountCents || claim.stripeRefundId && claim.stripeRefundId !== canonical.id || !["pending", "requires_action", "succeeded", "failed", "cancelled"].includes(canonical.status)) throw new RefundMismatch("Canonical refund mismatch");
      if (await finalize(claim, canonical, database)) result.checked++;
    } catch (error) {
      const terminal = error instanceof RefundMismatch || claim.attempts >= maxRefundAttempts;
      await database.transaction(async (tx) => {
        const updated = await tx.update(refunds).set({ status: terminal ? "requires_action" : "failed", nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (claim.attempts - 1)), updatedAt: new Date() }).where(and(eq(refunds.id, claim.id), eq(refunds.attempts, claim.attempts), inArray(refunds.status, ["pending", "failed"]))).returning({ id: refunds.id });
        if (terminal && updated.length) await tx.insert(auditLogs).values({ action: "refund.needs_attention", entity: "refund", entityId: claim.id, metadata: { reason: error instanceof RefundMismatch ? "canonical_mismatch" : "attempts_exhausted" } });
      });
      if (terminal) result.needsAttention++; else result.deferred++;
    }
  }
  return result;
}

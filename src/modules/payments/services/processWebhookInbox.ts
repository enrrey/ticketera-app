import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { auditLogs, payments, refunds, webhookEvents } from "@/lib/db/schema";
import { ReconciliationError, type PaymentDependencies } from "../types";
import { createStripeGateway } from "./stripeClient";
import { applySession, completeAutomaticRefund, processAutomaticRefunds, saveInvoice } from "./reconcilePayment";

const handled = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled", "invoice.paid", "invoice.finalized", "invoice.updated", "refund.updated", "refund.failed", "refund.created"]);

export async function processWebhookInbox(options: Partial<PaymentDependencies> & { limit?: number } = {}) {
  const dependencies: PaymentDependencies = { database: options.database ?? getDatabase(), gateway: options.gateway ?? createStripeGateway(), fulfill: options.fulfill };
  const { database, gateway } = dependencies;
  const result = { processed: 0, retried: 0, failed: 0 };
  for (let count = 0; count < Math.min(options.limit ?? 20, 100); count++) {
    const claim = await database.transaction(async (tx) => {
      const [event] = await tx.select().from(webhookEvents).where(and(eq(webhookEvents.provider, "stripe"), or(
        and(eq(webhookEvents.status, "pending"), sql`${webhookEvents.nextAttemptAt} <= now()`),
        and(eq(webhookEvents.status, "processing"), sql`${webhookEvents.claimedAt} < now() - interval '5 minutes'`),
      ))).orderBy(webhookEvents.nextAttemptAt, webhookEvents.id).limit(1).for("update", { skipLocked: true });
      if (!event) return null;
      if (event.attempts >= 5) {
        await tx.update(webhookEvents).set({ status: "failed", claimToken: null }).where(eq(webhookEvents.id, event.id));
        await tx.insert(auditLogs).values({ action: "stripe.webhook_failed", entity: "webhook_event", entityId: event.id, metadata: { reason: "attempts_exhausted" } });
        return { ...event, exhausted: true };
      }
      const [claimed] = await tx.update(webhookEvents).set({ status: "processing", attempts: event.attempts + 1, claimedAt: new Date(), claimToken: randomUUID() }).where(eq(webhookEvents.id, event.id)).returning();
      return { ...claimed, exhausted: false };
    });
    if (!claim) break;
    if (claim.exhausted) { result.failed++; continue; }
    const ownsClaim = and(eq(webhookEvents.id, claim.id), eq(webhookEvents.status, "processing"), eq(webhookEvents.claimToken, claim.claimToken!));
    try {
      if (claim.livemode !== gateway.livemode) throw new ReconciliationError("Stripe mode mismatch");
      if (handled.has(claim.type)) {
        const event = await gateway.readEvent(claim.externalEventId);
        if (event.id !== claim.externalEventId || event.type !== claim.type || event.objectId !== claim.objectId || event.livemode !== gateway.livemode) throw new ReconciliationError("Canonical event mismatch");
        if (event.type.startsWith("refund.")) {
          const [refund] = await database.select().from(refunds).where(event.refundId ? eq(refunds.id,event.refundId) : event.paymentId ? eq(refunds.paymentId, event.paymentId) : eq(refunds.stripeRefundId, event.objectId));
          if (refund && ["late_payment", "inventory_unavailable",'event_cancelled_before_payment'].includes(refund.reason)) await completeAutomaticRefund(refund.paymentId, dependencies, event.objectId);
          else if(refund && ['customer_request','event_cancelled'].includes(refund.reason)) await reconcileTicketRefund(refund.id,event.objectId,dependencies);
        } else if (event.type.startsWith("invoice.")) {
          const invoice = await gateway.readInvoice(event.objectId);
          // Ignore unrelated invoices belonging to other Stripe integrations.
          if (invoice.paymentId) await saveInvoice(invoice, dependencies);
        } else {
          const conditions = event.paymentId ? eq(payments.id, event.paymentId) : event.type.startsWith("checkout.") ? eq(payments.stripeCheckoutSessionId, event.objectId) : eq(payments.stripePaymentIntentId, event.objectId);
          const [payment] = await database.select().from(payments).where(conditions);
          if (payment) {
            const sessionId = payment.stripeCheckoutSessionId ?? (event.type.startsWith("checkout.") ? event.objectId : null);
            // A response can be lost after creating Checkout. Retry until its durable attempt has the session reference.
            if (!sessionId) throw new Error("Awaiting Checkout session association");
            const session = await gateway.readSession(sessionId, event);
            if (!event.type.startsWith("checkout.") && session.intent?.id && session.intent.id !== event.objectId) throw new ReconciliationError("Payment intent mismatch");
            await database.transaction(async (tx) => {
              const [owned] = await tx.select().from(webhookEvents).where(ownsClaim).for("update");
              if (owned) await applySession(session, dependencies, tx);
            });
            await completeAutomaticRefund(payment.id, dependencies);
            if (session.invoiceId) await saveInvoice(await gateway.readInvoice(session.invoiceId), dependencies);
          } else if (event.paymentId) throw new ReconciliationError("Linked payment missing");
        }
      }
      const updated = await database.update(webhookEvents).set({ status: "processed", processedAt: new Date(), claimToken: null }).where(ownsClaim).returning({ id: webhookEvents.id });
      result.processed += updated.length;
    } catch (error) {
      const terminal = error instanceof ReconciliationError || claim.attempts >= 5;
      await database.transaction(async (tx) => {
        const updated = await tx.update(webhookEvents).set({ status: terminal ? "failed" : "pending", claimToken: null,
          nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (claim.attempts - 1)) }).where(ownsClaim).returning({ id: webhookEvents.id });
        if (terminal && updated.length) await tx.insert(auditLogs).values({ action: "stripe.webhook_failed", entity: "webhook_event", entityId: claim.id, metadata: { reason: error instanceof ReconciliationError ? "reconciliation_rejected" : "attempts_exhausted", attempts: claim.attempts } });
      });
      if (terminal) result.failed++; else result.retried++;
    }
  }
  await processAutomaticRefunds(dependencies);
  return result;
}
import {reconcileTicketRefund} from '@/modules/refunds/server';

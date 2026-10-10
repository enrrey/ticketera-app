import Stripe from "stripe";
import type { CanonicalEvent, CanonicalInvoice, CanonicalSession, PaymentGateway, SessionInput } from "../types";
import { PaymentError } from "../types";

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new PaymentError(503, "El pago no está disponible temporalmente");
  return new Stripe(key, { apiVersion: "2026-09-30.endive", maxNetworkRetries: 2, timeout: 15_000 });
}

const reference = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

export function createStripeGateway(stripe = getStripeClient()): PaymentGateway {
  const livemode = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  async function normalize(session: Stripe.Checkout.Session, event?: CanonicalEvent): Promise<CanonicalSession> {
    const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
    let success: CanonicalSession["intent"];
    if (intent?.status === "succeeded") {
      const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
      if (!charge?.id || intent.amount_received !== session.amount_total) throw new Error("Canonical charge not available");
      let paidAt = event?.type === "payment_intent.succeeded" && event.objectId === intent.id ? event.paidAt : undefined;
      if (!paidAt) {
        // Charge.created and webhook receipt time are not completion timestamps.
        // Read Stripe's canonical success event, including when reconciling an expired reservation.
        let scanned = 0;
        for await (const candidate of stripe.events.list({ type: "payment_intent.succeeded", created: { gte: intent.created }, limit: 100 })) {
          if ("id" in candidate.data.object && candidate.data.object.id === intent.id) { paidAt = new Date(candidate.created * 1000); break; }
          if (++scanned >= 1000) break;
        }
      }
      if (!paidAt) throw new Error("Awaiting canonical payment completion timestamp");
      success = { id: intent.id, chargeId: charge.id, amountCents: intent.amount_received, currency: intent.currency, paidAt };
    }
    if (!["open", "complete", "expired"].includes(session.status ?? "") || !["paid", "unpaid", "no_payment_required"].includes(session.payment_status)) throw new Error("Unsupported canonical session state");
    return {
      id: session.id, orderId: session.client_reference_id ?? "", paymentId: session.metadata?.payment_id ?? "",
      livemode: session.livemode, status: session.status as CanonicalSession["status"], paymentStatus: session.payment_status as CanonicalSession["paymentStatus"],
      amountCents: session.amount_total ?? -1, currency: session.currency ?? "", url: session.url,
      ...(session.client_secret ? {clientSecret:session.client_secret} : {}),
      intentStatus: intent?.status ?? null, ...(success ? { intent: success } : {}),
      ...(reference(session.customer) ? { customerId: reference(session.customer) } : {}),
      ...(reference(session.invoice) ? { invoiceId: reference(session.invoice) } : {}),
    };
  }
  const readSession = async (id: string, event?: CanonicalEvent) => normalize(await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent.latest_charge"] }), event);
  return {
    livemode,
    async createSession(input: SessionInput) {
      const metadata = { order_id: input.orderId, payment_id: input.paymentId };
      const suffix = input.paymentId.replace(/-/g, "").slice(0, 8).split("").map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
      return normalize(await stripe.checkout.sessions.create({
        mode: "payment", locale: "es-419", client_reference_id: input.orderId, metadata,
        integration_identifier: `ticketera-${input.uiMode ?? 'hosted'}-${suffix}`,
        customer_email: input.buyerEmail, customer_creation: "always",
        invoice_creation: { enabled: true, invoice_data: { metadata, description: `Pedido Ticketera ${input.orderId}` } },
        payment_intent_data: { metadata }, adaptive_pricing: { enabled: false },
        line_items: [{ quantity: 1, price_data: { currency: input.currency, unit_amount: input.amountCents, product_data: { name: `Pedido Ticketera ${input.orderId}` } } }],
        ...(input.uiMode === 'elements' ? {ui_mode:'elements' as const, return_url:`${input.appUrl}/pedidos/${input.orderId}/pago/exito?session_id={CHECKOUT_SESSION_ID}`} : {
          success_url: `${input.appUrl}/pedidos/${input.orderId}/pago/exito`,
          cancel_url: `${input.appUrl}/pedidos/${input.orderId}/pago/cancelado`,
        }),
      }, { idempotencyKey: input.idempotencyKey }));
    },
    readSession,
    async expireSession(id) {
      try { await stripe.checkout.sessions.expire(id); }
      catch (error) { if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error; }
      // An expiry can race with a completed payment; read again instead of assuming it closed.
      return readSession(id);
    },
    async readEvent(id) {
      const event = await stripe.events.retrieve(id);
      const object = event.data.object as { id: string; metadata?: { payment_id?: string;refund_id?:string }; payment_status?: string };
      const succeeded = event.type === "payment_intent.succeeded";
      return { id: event.id, type: event.type, objectId: object.id, livemode: event.livemode,
        paymentId: object.metadata?.payment_id,refundId:object.metadata?.refund_id, ...(succeeded ? { paidAt: new Date(event.created * 1000) } : {}) };
    },
    async refund(intentId, amountCents, idempotencyKey, existingId) {
      const metadata:Stripe.MetadataParam=idempotencyKey.startsWith('ticketera:refund:')?{refund_id:idempotencyKey.split(':').at(-1)??''}:{payment_id:idempotencyKey.split(':').at(-1)??''};
      const refund = existingId ? await stripe.refunds.retrieve(existingId) : await stripe.refunds.create({ payment_intent: intentId, amount: amountCents, metadata }, { idempotencyKey });
      if (reference(refund.payment_intent) !== intentId) throw new Error("Refund intent mismatch");
      return { id: refund.id, status: refund.status === "canceled" ? "cancelled" : refund.status ?? "pending", amountCents: refund.amount };
    },
    async readInvoice(id): Promise<CanonicalInvoice> {
      const invoice = await stripe.invoices.retrieve(id);
      if (!["draft", "open", "paid", "uncollectible", "void"].includes(invoice.status ?? "")) throw new Error("Unsupported canonical invoice state");
      return { id: invoice.id, paymentId: invoice.metadata?.payment_id ?? "", orderId: invoice.metadata?.order_id ?? "",
        customerId: reference(invoice.customer) ?? "", livemode: invoice.livemode, status: invoice.status as CanonicalInvoice["status"],
        amountCents: invoice.total, currency: invoice.currency, hostedUrl: invoice.hosted_invoice_url ?? null, pdfUrl: invoice.invoice_pdf ?? null };
    },
  };
}

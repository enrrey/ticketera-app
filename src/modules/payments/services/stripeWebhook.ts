import Stripe from "stripe";
import { persistStripeEvent, type StripeInboxEvent } from "./webhookInbox";

export async function handleStripeWebhook(
  request: Request,
  persist: (event: StripeInboxEvent) => Promise<boolean> = persistStripeEvent,
) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    // Do not parse JSON before verification: Stripe signs the exact raw body.
    event = new Stripe(key).webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Invalid webhook signature or payload" }, { status: 400 });
  }
  if (!event.id || !event.type || !Number.isFinite(event.created)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  try {
    const inserted = await persist({
      provider: "stripe", externalEventId: event.id, type: event.type,
      objectId: "id" in event.data.object && typeof event.data.object.id === "string" ? event.data.object.id : event.id,
      livemode: event.livemode,
      providerCreatedAt: new Date(event.created * 1000), status: "pending",
    });
    // Durable receipt only. A subsequent worker must reconcile and fulfill orders.
    return Response.json({ received: true, duplicate: !inserted });
  } catch {
    // Stripe can retry; never acknowledge an event that has not been saved.
    return Response.json({ error: "Unable to persist event" }, { status: 503 });
  }
}

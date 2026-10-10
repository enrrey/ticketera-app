import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { events,inventoryReservations, orderItems, orders, payments } from "@/lib/db/schema";
import { accessTokenMatches } from "@/modules/checkout/server";
import { PaymentError, ReconciliationError, type PaymentDatabase, type PaymentGateway } from "../types";
import { createStripeGateway } from "./stripeClient";

export async function createPayment(orderId: string, access: { userId: string | null; token: string | null }, options: { database?: PaymentDatabase; gateway?: PaymentGateway; appUrl?: string; uiMode?:'hosted'|'elements' } = {}) {
  const database = options.database ?? getDatabase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) throw new PaymentError(404, "Pedido no encontrado");
  const appUrl = new URL(options.appUrl ?? process.env.APP_URL ?? "http://localhost:3000").origin;
  // Construct inside the authorized transaction, before inserting, so missing configuration leaves no attempt.
  let gateway: PaymentGateway;
  const { attempt, order } = await database.transaction(async (tx) => {
    const [reference] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!reference || !(reference.userId !== null && reference.userId === access.userId) && !(access.token && accessTokenMatches(access.token, reference.accessTokenHash))) throw new PaymentError(404, "Pedido no encontrado");
    const eventStates=await tx.select({id:events.id,status:events.status}).from(events).where(sql`exists(select 1 from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id where oi.order_id=${orderId} and tt.event_id=${events.id})`).orderBy(events.id).for('update');
    if(eventStates.some(event=>event.status==='cancelled'))throw new PaymentError(409,'El evento fue cancelado. No se puede iniciar el pago.');
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || !(order.userId !== null && order.userId === access.userId) && !(access.token && accessTokenMatches(access.token, order.accessTokenHash))) throw new PaymentError(404, "Pedido no encontrado");
    const reservations = await tx.select({ status: inventoryReservations.status, valid: sql<boolean>`${inventoryReservations.expiresAt} > clock_timestamp()` })
      .from(inventoryReservations).innerJoin(orderItems, eq(orderItems.id, inventoryReservations.orderItemId)).where(eq(orderItems.orderId, orderId));
    if (order.status !== "pending" || !reservations.length || reservations.some((r) => r.status !== "active" || !r.valid)) throw new PaymentError(409, "La reserva ya no está disponible");
    if (order.totalCents <= 0) throw new PaymentError(409, "Este pedido gratuito requiere otro flujo de confirmación");
    gateway = options.gateway ?? createStripeGateway();
    const [existing] = await tx.select().from(payments).where(eq(payments.orderId, orderId));
    if (existing && ["succeeded", "refunded", "partially_refunded", "cancelled"].includes(existing.status)) throw new PaymentError(409, "Este pago ya fue procesado");
    const attempt = existing ?? (await tx.insert(payments).values({ orderId, uiMode:options.uiMode??'hosted', amountCents: order.totalCents, currency: order.currency, idempotencyKey: `ticketera:checkout:${orderId}:1` }).returning())[0];
    return { attempt, order };
  });
  const session = attempt.stripeCheckoutSessionId
    ? await gateway!.readSession(attempt.stripeCheckoutSessionId)
    : await gateway!.createSession({ paymentId: attempt.id, orderId, amountCents: attempt.amountCents, currency: attempt.currency, buyerEmail: order.buyerEmail, idempotencyKey: attempt.idempotencyKey, appUrl, ...(attempt.uiMode==='elements' ? {uiMode:attempt.uiMode} : {}) });
  if (session.paymentId !== attempt.id || session.orderId !== orderId || session.amountCents !== attempt.amountCents || session.currency !== attempt.currency || session.livemode !== gateway!.livemode) throw new ReconciliationError("Session references or amount mismatch");
  await database.update(payments).set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() }).where(eq(payments.id, attempt.id));
  const [clock] = await database.select({ valid: sql<boolean>`exists(select 1 from inventory_reservation r join order_item oi on oi.id=r.order_item_id where oi.order_id=${orderId} and r.status='active' and r.expires_at>clock_timestamp())` }).from(orders).where(eq(orders.id, orderId));
  if (!clock.valid) throw new PaymentError(409, "La reserva venció mientras se abría el pago. Vuelve a reservar.");
  if (session.status !== "open" || session.paymentStatus !== "unpaid") throw new PaymentError(409, "El pago está procesándose o la sesión terminó. Revisa tu pedido.");
  if (session.clientSecret && options.uiMode==='elements') return {clientSecret:session.clientSecret};
  if (!session.url) throw new PaymentError(409, 'Este pedido tiene un formulario de pago integrado. Ábrelo desde tu pedido.');
  const url = new URL(session.url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new ReconciliationError("Invalid checkout URL");
  return { url: session.url };
}

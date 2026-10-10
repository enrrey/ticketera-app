import { timingSafeEqual } from "node:crypto";
import { isSameOrigin } from "@/lib/sameOrigin";
import { getCurrentAccessUser } from "@/modules/identity-access";
import { PaymentError } from "../types";
import { createPayment } from "./createPayment";
import { processWebhookInbox } from "./processWebhookInbox";
import { expireReservations } from "./expireReservations";
import { processNotificationOutbox } from "@/modules/notifications/server";
import {processTicketRefunds} from '@/modules/refunds/server';

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
type Member = { id: string; status: string } | null;

export async function handleCreatePayment(request: Request, orderId: string, dependencies: {
  getMember?: () => Promise<Member>;
  create?: typeof createPayment;
} = {}, uiMode?:'elements') {
  if (!isSameOrigin(request)) return Response.json({ error: "Origen no permitido" }, { status: 403, headers });
  try {
    const member = await (dependencies.getMember ?? getCurrentAccessUser)();
    if (member && member.status !== "active") return Response.json({ error: "Tu cuenta no puede realizar pagos" }, { status: 403, headers });
    const access = { userId: member?.id ?? null, token: request.headers.get("x-order-token") };
    const result = uiMode ? await (dependencies.create ?? createPayment)(orderId, access, {uiMode}) : await (dependencies.create ?? createPayment)(orderId, access);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof PaymentError ? error.message : "No pudimos iniciar el pago. Inténtalo de nuevo." }, { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}

export async function handlePaymentJobs(request: Request, run: () => Promise<unknown> = async () => ({ webhooks: await processWebhookInbox(), reservations: await expireReservations(), refunds:await processTicketRefunds(), notifications: await processNotificationOutbox() })) {
  const secret = process.env.PAYMENT_JOBS_SECRET;
  if (!secret) return Response.json({ error: "Tareas no configuradas" }, { status: 503, headers });
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return Response.json({ error: "No autorizado" }, { status: 401, headers });
  try { return Response.json(await run(), { headers }); }
  catch { return Response.json({ error: "No se pudieron completar las tareas" }, { status: 503, headers }); }
}

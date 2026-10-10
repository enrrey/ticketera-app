import { z } from "zod";
import { AccessError, getCurrentAccessUser } from "@/modules/identity-access";
import { requestCancelEvent, requestTicketRefund } from "./requestRefund";

function errorResponse(error: unknown) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  return Response.json({ error: "No se pudo solicitar el reembolso" }, { status: 503 });
}
async function mutationActor(request: Request) {
  if (request.method !== "POST") throw new AccessError(405, "Método no permitido");
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new AccessError(403, "Origen no permitido");
  const actor = await getCurrentAccessUser();
  if (!actor) throw new AccessError(401, "Debes iniciar sesión");
  return actor;
}
export async function handleTicketRefund(request: Request, ticketId: string) {
  try {
    const actor = await mutationActor(request);
    z.uuid().parse(ticketId);
    const refund = await requestTicketRefund(actor.id, ticketId);
    return Response.json(refund, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function handleCancelEvent(request: Request, eventId: string) {
  try {
    const actor = await mutationActor(request);
    z.uuid().parse(eventId);
    return Response.json(await requestCancelEvent(actor.id, eventId), { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

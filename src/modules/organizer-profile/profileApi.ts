import { z } from "zod";
import { AccessError, requirePermission } from "@/modules/identity-access";
import { canManageOrganizerProfile } from "./profileValidation";
import { readOrganizerProfile, saveOrganizerProfile, type ConnectStatusReader } from "./profileService";

export async function handleOrganizerProfile(request: Request, readConnectStatus?: ConnectStatusReader) {
  try {
    if (!["GET", "PUT"].includes(request.method)) return Response.json({ error: "Método no permitido" }, { status: 405 });
    const actor = await requirePermission("events.manage");
    if (!canManageOrganizerProfile(actor)) throw new AccessError(403, "No tienes permiso para configurar el negocio");
    if (request.method === "PUT") {
      if (request.headers.get("origin") !== new URL(request.url).origin) throw new AccessError(403, "Origen no permitido");
    }
    const profile = request.method === "GET" ? await readOrganizerProfile(actor.id) : await saveOrganizerProfile(actor.id, await request.json());
    let connect = { available: false };
    // A provider outage must not turn a successful business-profile save into a failed response.
    if (readConnectStatus) { try { connect = await readConnectStatus(actor.id); } catch { /* unavailable */ } }
    return Response.json({ ...profile, connect }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Revisa el nombre y el RUC de 11 dígitos" }, { status: 400 });
    return Response.json({ error: "No se pudo completar la operación" }, { status: 503 });
  }
}

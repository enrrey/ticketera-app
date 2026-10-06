import { z } from "zod";
import { permissionDefinitions, roleNames } from "../types";
import { AccessError, getCurrentAccessUser, requirePermission, updateClerkProfile } from "./clerkIdentity";
import { inviteClerkStaff } from "./staffInvitation";
import { archiveApplicationUser, getManagedUser, queryApplicationUsers, updateStaffAccess } from "./identityStore";

const settingsSchema = z.object({
  roles: z.array(z.enum(["admin", "organizer"])).max(2),
  overrides: z.record(z.string(), z.boolean()).refine((o) => Object.keys(o).every((key) => key !== "staff.manage" && Object.hasOwn(permissionDefinitions, key)), "Permiso no editable"),
}).strict();
const updateSchema = settingsSchema.extend({ name: z.string().trim().min(1).max(100).optional(), status: z.enum(["active", "inactive"]).optional() });
const querySchema = z.object({
  search: z.string().trim().max(100).default(""),
  role: z.enum(["all", ...roleNames]).default("all"), status: z.enum(["all", "active", "inactive"]).default("all"),
  kind: z.enum(["all", "staff", "customer"]).default("all"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const creationSchema = settingsSchema.extend({
  email: z.email().transform((s) => s.trim().toLowerCase()), name: z.string().trim().min(1).max(100),
}).refine((s) => s.roles.length > 0, "Selecciona administrador u organizador");

function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new AccessError(403, "Origen no permitido");
}
export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return Response.json({ error: "Revisa los campos y permisos enviados" }, { status: 400 });
  if (error instanceof Error && error.message === "Forbidden") return Response.json({ error: "No tienes permiso" }, { status: 403 });
  if (error instanceof Error && error.message === "Super admin cannot be changed") return Response.json({ error: "La cuenta super admin está protegida" }, { status: 403 });
  if (error instanceof Error && error.message === "User not found") return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (error instanceof SyntaxError) return Response.json({ error: "JSON inválido" }, { status: 400 });
  // Clerk validation errors are safe to describe generically, never return password/body/provider logs.
  if (typeof error === "object" && error !== null && "status" in error && [400, 422].includes(Number(error.status))) return Response.json({ error: "Clerk rechazó los datos. Revisa el correo o gestiona una cuenta existente." }, { status: 400 });
  return Response.json({ error: "No se pudo completar la operación" }, { status: 503 });
}

export async function handleCurrentUser() {
  try {
    const user = await getCurrentAccessUser();
    return user ? Response.json(user) : Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  } catch (error) { return accessErrorResponse(error); }
}
export async function handleStaffUsers(request: Request) {
  try {
    const actor = await requirePermission("staff.manage");
    if (request.method === "GET") {
      const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
      return Response.json({ ...await queryApplicationUsers(query), permissions: permissionDefinitions });
    }
    checkOrigin(request);
    let input;
    try { input = creationSchema.parse(await request.json()); } catch (error) {
      if (error instanceof SyntaxError) throw new AccessError(400, "JSON inválido");
      throw error;
    }
    return Response.json(await inviteClerkStaff(actor, input), { status: 201 });
  } catch (error) { return accessErrorResponse(error); }
}
export async function handleStaffUpdate(request: Request, userId: string) {
  try {
    const actor = await requirePermission("staff.manage");
    checkOrigin(request);
    if (!z.uuid().safeParse(userId).success) throw new AccessError(400, "Usuario inválido");
    const settings = updateSchema.parse(await request.json());
    const target = await getManagedUser(actor.id, userId);
    if (target.roles.includes("super_admin")) throw new AccessError(403, "La cuenta super admin está protegida");
    if (settings.name && settings.name !== target.name) await updateClerkProfile(target, settings.name);
    const result = await updateStaffAccess(actor.id, userId, settings);
    return Response.json(result);
  } catch (error) { return accessErrorResponse(error); }
}

export async function handleStaffUser(request: Request, userId: string) {
  try {
    const actor = await requirePermission("staff.manage");
    if (!z.uuid().safeParse(userId).success) throw new AccessError(400, "Usuario inválido");
    if (request.method === "GET") return Response.json(await getManagedUser(actor.id, userId));
    checkOrigin(request);
    await archiveApplicationUser(actor.id, userId);
    return new Response(null, { status: 204 });
  } catch (error) { return accessErrorResponse(error); }
}

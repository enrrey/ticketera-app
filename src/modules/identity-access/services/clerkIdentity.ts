import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { synchronizeIdentity } from "./identityStore";
import type { AccessUser, PermissionName } from "../types";
import { profileFromClerk } from "./clerkProfile";
export { profileFromClerk } from "./clerkProfile";

export class AccessError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export const getCurrentAccessUser = cache(async (): Promise<AccessUser | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user || user.id !== userId) return null;
  return synchronizeIdentity(profileFromClerk(user));
});

export async function requirePermission(permission: PermissionName) {
  const user = await getCurrentAccessUser();
  if (!user) throw new AccessError(401, "Debes iniciar sesión");
  if (!user.permissions.includes(permission)) throw new AccessError(403, "No tienes permiso para esta operación");
  return user;
}

export async function requirePagePermission(permission: PermissionName, returnTo = "/") {
  try { return await requirePermission(permission); }
  catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect(`/ingresar?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof AccessError && error.status === 403) redirect("/");
    throw error;
  }
}

export async function updateClerkProfile(target: AccessUser, name: string) {
  const client = await clerkClient();
  const canonical = await client.users.updateUser(target.clerkUserId, { firstName: name, lastName: "" });
  try { return await synchronizeIdentity(profileFromClerk(canonical)); }
  catch { throw new AccessError(503, "El nombre se guardó en Clerk. Recarga el usuario antes de reintentar sus accesos."); }
}

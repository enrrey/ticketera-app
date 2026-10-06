import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";
import { auditLogs, staffInvitations } from "@/lib/db/schema";
import type { AccessUser, StaffSettings } from "../types";
import { AccessError } from "./clerkIdentity";
import { designatedSuperAdminEmail, getAccessUser } from "./identityStore";

export async function inviteClerkStaff(actor: AccessUser, input: StaffSettings & { email: string; name: string }) {
  if (input.email === designatedSuperAdminEmail) throw new AccessError(400, "La cuenta super admin está protegida");
  const base = new URL(process.env.APP_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new AccessError(503, "Revisa la URL de Ticketera");
  const client = await clerkClient();
  const existing = await client.users.getUserList({ emailAddress: [input.email], limit: 1 });
  if (existing.data.length) throw new AccessError(409, "Este correo ya tiene una cuenta. Gestiona sus accesos desde la lista de usuarios.");
  const db = getDatabase();
  const { invitation } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invite:${input.email}`}, 0))`);
    const owner = await getAccessUser(actor.id, tx);
    if (!owner.permissions.includes("staff.manage")) throw new AccessError(403, "No tienes permiso para invitar usuarios");
    const [previous] = await tx.select().from(staffInvitations).where(eq(staffInvitations.email, input.email)).orderBy(sql`case when ${staffInvitations.status} in ('sending', 'pending', 'failed') then 0 else 1 end`, desc(staffInvitations.createdAt)).limit(1);
    const expired = previous && previous.status !== "accepted" && (previous.status === "expired" || previous.expiresAt.getTime() <= Date.now()) ? previous : undefined;
    if (previous && !expired && (previous.status === "pending" || previous.status === "accepted" || previous.status === "sending" && previous.createdAt.getTime() > Date.now() - 60_000)) throw new AccessError(409, "Este correo ya tiene una invitación enviada o en proceso.");
    if (expired) await tx.update(staffInvitations).set({ status: "expired" }).where(eq(staffInvitations.id, expired.id));
    if (previous && !expired) {
      const [retry] = await tx.update(staffInvitations).set({ status: "sending", createdAt: new Date() }).where(eq(staffInvitations.id, previous.id)).returning();
      return { invitation: retry, expired };
    }
    const [created] = await tx.insert(staffInvitations).values({ email: input.email, name: input.name, roles: input.roles, overrides: input.overrides, invitedById: actor.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) }).returning();
    return { invitation: created, expired };
  });
  let providerConfirmed = false;
  try {
    // Recover a provider success whose local acknowledgement failed, without a second email.
    const previous = await client.invitations.getInvitationList({ query: invitation.email, status: "pending", limit: 100 });
    const expiredIntents = await db.select({ id: staffInvitations.id }).from(staffInvitations).where(and(eq(staffInvitations.email, invitation.email), eq(staffInvitations.status, "expired")));
    for (const obsolete of previous.data.filter((item) => item.emailAddress.toLowerCase() === invitation.email && expiredIntents.some((intent) => item.publicMetadata?.ticketeraInvitationId === intent.id))) {
      await client.invitations.revokeInvitation(obsolete.id);
    }
    const delivered = previous.data.find((item) => item.emailAddress.toLowerCase() === invitation.email && item.publicMetadata?.ticketeraInvitationId === invitation.id);
    if (!delivered) await db.update(staffInvitations).set({ expiresAt: new Date(Date.now() + 7 * 86_400_000) }).where(and(eq(staffInvitations.id, invitation.id), eq(staffInvitations.status, "sending")));
    const result = delivered ?? await client.invitations.createInvitation({ emailAddress: invitation.email, notify: true, expiresInDays: 7, redirectUrl: base.origin, publicMetadata: { ticketeraInvitationId: invitation.id } });
    providerConfirmed = true;
    await db.transaction(async (tx) => {
      await tx.update(staffInvitations).set({ clerkInvitationId: result.id, status: "pending" }).where(and(eq(staffInvitations.id, invitation.id), eq(staffInvitations.status, "sending")));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "staff.invitation_sent", entity: "staff_invitation", entityId: invitation.id });
    });
    return { id: invitation.id, email: invitation.email, name: invitation.name, roles: invitation.roles, status: "pending" };
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
    // Ambiguous delivery stays claimable: only Clerk's verified acceptance can grant access.
    if (!providerConfirmed && (status === 400 || status === 422)) await db.update(staffInvitations).set({ status: "failed" }).where(and(eq(staffInvitations.id, invitation.id), eq(staffInvitations.status, "sending"), isNull(staffInvitations.clerkInvitationId)));
    throw new AccessError(503, "No se pudo confirmar el envío de la invitación. Reintenta con el mismo correo.");
  }
}

import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { auditLogs, orders, permissions, rolePermissions, roles, staffInvitations, superAdminAssignments, userPermissions, userRoles, users } from "@/lib/db/schema";
import { permissionDefinitions, type AccessUser, type IdentityProfile, type PermissionName, type RoleName, type StaffSettings, type UsersQuery, type UsersPage } from "../types";

export type AccessDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
export const designatedSuperAdminEmail = "ronaldreyesramirez@gmail.com";
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function getAccessUser(userId: string, db: AccessDatabase = getDatabase()): Promise<AccessUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");
  const assigned = await db.select({ name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId));
  const inherited = await db.select({ name: permissions.name }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)).where(eq(userRoles.userId, userId));
  const overrides = await db.select({ name: permissions.name, allowed: userPermissions.allowed }).from(userPermissions)
    .innerJoin(permissions, eq(permissions.id, userPermissions.permissionId)).where(eq(userPermissions.userId, userId));
  const assignedRoles = assigned.map((r) => r.name as RoleName);
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.name, o.allowed]));
  const granted = new Set(inherited.map((p) => p.name));
  const isSuperAdmin = assignedRoles.includes("super_admin");
  const [pinned] = isSuperAdmin ? await db.select({ userId: superAdminAssignments.userId }).from(superAdminAssignments).where(eq(superAdminAssignments.key, "primary")) : [];
  const effective = user.status === "active" ? (Object.keys(permissionDefinitions) as PermissionName[]).filter((name) => {
    if (name === "staff.manage") return isSuperAdmin && pinned?.userId === user.id;
    if (isSuperAdmin) return true;
    return overrideMap[name] ?? granted.has(name);
  }) : [];
  return { id: user.id, clerkUserId: user.clerkUserId, email: user.email, name: user.name, status: user.status, roles: assignedRoles, permissions: effective, overrides: overrideMap };
}

export async function synchronizeIdentity(profile: IdentityProfile, db: AccessDatabase = getDatabase()) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${profile.clerkUserId}, 0))`);
    const [previous] = await tx.select().from(users).where(eq(users.clerkUserId, profile.clerkUserId));
    const email = normalizeEmail(profile.email);
    const verified = [...new Set(profile.verifiedEmails.map(normalizeEmail))];
    const primaryVerified = verified.includes(email);
    const values = { clerkUserId: profile.clerkUserId, email, name: profile.name, avatarUrl: profile.avatarUrl ?? null,
      status: profile.disabled || previous?.adminDisabled || previous?.deletedAt ? "inactive" : "active", identityDisabled: profile.disabled, identityUpdatedAt: profile.updatedAt,
      emailVerifiedAt: primaryVerified ? (previous?.email === email ? previous.emailVerifiedAt ?? new Date() : new Date()) : null, updatedAt: new Date() };
    const [upserted] = await tx.insert(users).values(values).onConflictDoUpdate({ target: users.clerkUserId, set: { ...values,
      status: sql`case when ${profile.disabled} or ${users.adminDisabled} or ${users.deletedAt} is not null then 'inactive' else 'active' end` },
      setWhere: sql`${users.identityUpdatedAt} <= ${profile.updatedAt}` }).returning();
    const user = upserted ?? previous;
    if (!user) throw new Error("Identity synchronization failed");
    if (!previous) {
      const [customer] = await tx.select().from(roles).where(eq(roles.name, "customer"));
      if (!customer) throw new Error("Access migration is required");
      await tx.insert(userRoles).values({ userId: user.id, roleId: customer.id }).onConflictDoNothing();
    }
    // Only current, canonical Clerk data may confer bootstrap privileges or claim purchases.
    if (upserted && !user.deletedAt && !profile.disabled && verified.includes(designatedSuperAdminEmail)) {
      await tx.insert(superAdminAssignments).values({ key: "primary", userId: user.id }).onConflictDoNothing();
      const [pinned] = await tx.select().from(superAdminAssignments).where(eq(superAdminAssignments.key, "primary"));
      if (pinned?.userId === user.id) {
        const [role] = await tx.select().from(roles).where(eq(roles.name, "super_admin"));
        const newlyGranted = await tx.insert(userRoles).values({ userId: user.id, roleId: role.id }).onConflictDoNothing().returning();
        if (newlyGranted.length) await tx.insert(auditLogs).values({ actorId: user.id, action: "super_admin.bootstrapped", entity: "user", entityId: user.id });
      }
    }
    if (upserted && !user.deletedAt && !profile.disabled && verified.length) {
      await tx.update(orders).set({ userId: user.id, updatedAt: new Date() }).where(and(isNull(orders.userId), inArray(sql<string>`lower(btrim(${orders.buyerEmail}))`, verified)));
    }
    if (upserted && user.status === "active" && !user.deletedAt && profile.invitationId) {
      const [invitation] = await tx.select().from(staffInvitations).where(eq(staffInvitations.id, profile.invitationId)).for("update");
      if (invitation && ["pending", "sending"].includes(invitation.status) && invitation.expiresAt > new Date() && verified.includes(invitation.email)) {
        const inviter = await getAccessUser(invitation.invitedById, tx);
        if (inviter.permissions.includes("staff.manage")) {
          await writeStaffAssignments(user.id, { roles: invitation.roles, overrides: invitation.overrides }, tx);
          await tx.update(staffInvitations).set({ status: "accepted", acceptedById: user.id, acceptedAt: new Date() }).where(eq(staffInvitations.id, invitation.id));
          await tx.insert(auditLogs).values({ actorId: inviter.id, action: "staff.invitation_accepted", entity: "user", entityId: user.id, metadata: { invitationId: invitation.id } });
        }
      }
    }
    return getAccessUser(user.id, tx);
  });
}

export async function deactivateIdentity(clerkUserId: string, db: AccessDatabase = getDatabase()) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${clerkUserId}, 0))`);
    // A canonical snapshot fetched before deletion must not resurrect the local account.
    await tx.update(users).set({ status: "inactive", identityDisabled: true, identityUpdatedAt: sql`greatest(now(), ${users.identityUpdatedAt} + interval '1 millisecond')`, updatedAt: new Date() }).where(eq(users.clerkUserId, clerkUserId));
  });
}

export async function updateStaffAccess(actorId: string, targetId: string, settings: StaffSettings, db: AccessDatabase = getDatabase()) {
  if (settings.roles.some((role) => role !== "admin" && role !== "organizer") ||
      Object.keys(settings.overrides).some((key) => key === "staff.manage" || !Object.hasOwn(permissionDefinitions, key))) throw new Error("Invalid access settings");
  return db.transaction(async (tx) => {
    // Profile sync and concurrent changes serialize on the target row.
    await tx.execute(sql`select id from "user" where id in (${actorId}::uuid, ${targetId}::uuid) order by id for update`);
    const actor = await getAccessUser(actorId, tx);
    if (actor.status !== "active" || !actor.roles.includes("super_admin")) throw new Error("Forbidden");
    const target = await getManagedUser(actorId, targetId, tx);
    if (target.roles.includes("super_admin")) throw new Error("Super admin cannot be changed");
    if (settings.status) {
      await tx.update(users).set({ adminDisabled: settings.status === "inactive",
        status: settings.status === "inactive" ? "inactive" : sql`case when ${users.identityDisabled} then 'inactive' else 'active' end`, updatedAt: new Date() }).where(eq(users.id, targetId));
    }
    await writeStaffAssignments(targetId, settings, tx);
    await tx.insert(auditLogs).values({ actorId, action: "staff.access_updated", entity: "user", entityId: targetId, metadata: settings });
    return getAccessUser(targetId, tx);
  });
}

async function writeStaffAssignments(targetId: string, settings: StaffSettings, db: AccessDatabase) {
  const staffRoles = await db.select().from(roles).where(inArray(roles.name, ["admin", "organizer"]));
  await db.delete(userRoles).where(and(eq(userRoles.userId, targetId), inArray(userRoles.roleId, staffRoles.map((r) => r.id))));
  const wanted = staffRoles.filter((r) => settings.roles.includes(r.name as "admin" | "organizer"));
  if (wanted.length) await db.insert(userRoles).values(wanted.map((r) => ({ userId: targetId, roleId: r.id }))).onConflictDoNothing();
  await db.delete(userPermissions).where(eq(userPermissions.userId, targetId));
  const definitions = await db.select().from(permissions);
  const entries = definitions.filter((p) => p.name !== "staff.manage" && Object.hasOwn(settings.overrides, p.name));
  if (entries.length) await db.insert(userPermissions).values(entries.map((p) => ({ userId: targetId, permissionId: p.id, allowed: settings.overrides[p.name as PermissionName]! })));
}

export async function listApplicationUsers(db: AccessDatabase = getDatabase()) {
  const all = await db.select({ id: users.id }).from(users).where(isNull(users.deletedAt)).orderBy(users.createdAt);
  return Promise.all(all.map((u) => getAccessUser(u.id, db)));
}

export async function getManagedUser(actorId: string, targetId: string, db: AccessDatabase = getDatabase()) {
  const actor = await getAccessUser(actorId, db);
  if (!actor.permissions.includes("staff.manage")) throw new Error("Forbidden");
  const [row] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, targetId));
  if (!row || row.deletedAt) throw new Error("User not found");
  return getAccessUser(targetId, db);
}

export async function archiveApplicationUser(actorId: string, targetId: string, db: AccessDatabase = getDatabase()) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from "user" where id in (${actorId}::uuid, ${targetId}::uuid) order by id for update`);
    const target = await getManagedUser(actorId, targetId, tx);
    if (target.roles.includes("super_admin")) throw new Error("Super admin cannot be changed");
    await tx.update(users).set({ deletedAt: new Date(), adminDisabled: true, status: "inactive", updatedAt: new Date() }).where(eq(users.id, targetId));
    await tx.insert(auditLogs).values({ actorId, action: "user.archived", entity: "user", entityId: targetId });
  });
}

export const defaultUsersQuery: UsersQuery = { search: "", role: "all", status: "all", kind: "all", page: 1, pageSize: 10 };
export async function queryApplicationUsers(query: UsersQuery = defaultUsersQuery, db: AccessDatabase = getDatabase()): Promise<UsersPage> {
  const conditions = [isNull(users.deletedAt)];
  if (query.search.trim()) conditions.push(sql`position(lower(${query.search.trim()}) in lower(${users.name} || ' ' || ${users.email})) > 0`);
  if (query.status !== "all") conditions.push(eq(users.status, query.status));
  if (query.role !== "all") conditions.push(sql`exists (select 1 from user_role ur join role r on r.id = ur.role_id where ur.user_id = ${users.id} and r.name = ${query.role})`);
  const staff = sql`exists (select 1 from user_role ur join role r on r.id = ur.role_id where ur.user_id = ${users.id} and r.name in ('admin', 'organizer', 'super_admin'))`;
  if (query.kind === "staff") conditions.push(staff);
  if (query.kind === "customer") conditions.push(sql`not (${staff})`);
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const pageSize = Math.min(50, Math.max(1, Math.trunc(query.pageSize)));
  const page = Math.min(Math.max(1, Math.trunc(query.page)), Math.max(1, Math.ceil(total / pageSize)));
  const rows = await db.select({ id: users.id }).from(users).where(where).orderBy(desc(users.createdAt), desc(users.id)).limit(pageSize).offset((page - 1) * pageSize);
  return { users: await Promise.all(rows.map((row) => getAccessUser(row.id, db))), total, page, pageSize };
}

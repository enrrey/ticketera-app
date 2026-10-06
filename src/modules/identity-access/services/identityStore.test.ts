// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { orders, users, roles, userRoles, staffInvitations } from "@/lib/db/schema";
import { synchronizeIdentity, getAccessUser, updateStaffAccess, deactivateIdentity, queryApplicationUsers, archiveApplicationUser } from "./identityStore";
import type { IdentityProfile } from "../types";

const pg = new PGlite();
const db = drizzle(pg);
const profile = (id: string, email = `${id}@example.com`, verified = true): IdentityProfile => ({ clerkUserId: id, email, name: id, verifiedEmails: verified ? [email] : [], updatedAt: new Date("2026-10-01T00:00:00Z"), disabled: false });
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) {
    if (file.startsWith("0002")) await pg.exec(`insert into "user" (clerk_user_id, email, name, status, identity_updated_at) values ('legacy_suspended', 'legacy@example.com', 'Legacy', 'inactive', now())`);
    await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
  }
}, 30_000);
afterAll(async () => pg.close());

describe("Clerk identity and application access", () => {
  it("filters before pagination and keeps a deterministic bounded page", async () => {
    await synchronizeIdentity({ ...profile("page_alpha", "Alpha%literal@example.com"), name: "Literal" }, db);
    await synchronizeIdentity(profile("page_beta", "beta_page@example.com"), db);
    const result = await queryApplicationUsers({ search: "PAGE", page: 1, pageSize: 1, role: "customer", status: "active", kind: "all" }, db);
    expect(result.total).toBe(1);
    expect(result.users[0].clerkUserId).toBe("page_beta");
    const literal = await queryApplicationUsers({ search: "%literal", page: 999, pageSize: 5, role: "all", status: "all", kind: "all" }, db);
    expect(literal.total).toBe(1);
    expect(literal.page).toBe(1);
    expect(literal.users[0].email).toBe("alpha%literal@example.com");
  });
  it("synchronizes new customers idempotently and ignores unverified super-admin email", async () => {
    const first = await synchronizeIdentity(profile("unverified", "ronaldreyesramirez@gmail.com", false), db);
    const again = await synchronizeIdentity(profile("unverified", "ronaldreyesramirez@gmail.com", false), db);
    expect(again.id).toBe(first.id);
    expect(again.roles).toEqual(["customer"]);
    expect(again.permissions).not.toContain("staff.manage");
  });
  it("bootstraps only the verified designated identity and pins it", async () => {
    const admin = await synchronizeIdentity(profile("designated", "ronaldreyesramirez@gmail.com"), db);
    expect(admin.roles).toContain("super_admin");
    expect(admin.permissions).toContain("staff.manage");
    const replacement = await synchronizeIdentity(profile("replacement", "ronaldreyesramirez@gmail.com"), db);
    expect(replacement.roles).not.toContain("super_admin");
  });
  it("allows only super admin to grant roles and individual permissions", async () => {
    const customer = await synchronizeIdentity(profile("customer"), db);
    const target = await synchronizeIdentity(profile("staff"), db);
    await expect(updateStaffAccess(customer.id, target.id, { roles: ["organizer"], overrides: {} }, db)).rejects.toThrow("Forbidden");
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    await updateStaffAccess(admin.id, target.id, { roles: ["organizer"], overrides: { "events.publish": false, "refunds.manage": true } }, db);
    const refreshed = await synchronizeIdentity(profile("staff"), db);
    expect(refreshed.roles).toContain("organizer");
    expect(refreshed.permissions).not.toContain("events.publish");
    expect(refreshed.permissions).toContain("refunds.manage");
    expect(refreshed.permissions).not.toContain("staff.manage");
    await expect(updateStaffAccess(admin.id, target.id, { roles: ["admin"], overrides: { "staff.manage": true } }, db)).rejects.toThrow();
  });
  it("protects the super-admin role and applies revocations immediately", async () => {
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    const [staff] = await db.select().from(users).where(eq(users.clerkUserId, "staff"));
    await expect(updateStaffAccess(admin.id, admin.id, { roles: [], overrides: {} }, db)).rejects.toThrow();
    await updateStaffAccess(admin.id, staff.id, { roles: [], overrides: {} }, db);
    expect((await getAccessUser(staff.id, db)).permissions).not.toContain("events.manage");
  });
  it("claims only guest orders for current verified emails", async () => {
    const owner = await synchronizeIdentity(profile("owner"), db);
    await db.insert(orders).values([
      { buyerEmail: " Guest@Example.com ", buyerName: "Guest", subtotalCents: 0, totalCents: 0 },
      { userId: owner.id, buyerEmail: "guest@example.com", buyerName: "Owner", subtotalCents: 0, totalCents: 0 },
    ]);
    const unverified = await synchronizeIdentity(profile("guest", "guest@example.com", false), db);
    let rows = await db.select().from(orders).where(eq(sql`lower(btrim(${orders.buyerEmail}))`, "guest@example.com"));
    expect(rows.some((r) => r.userId === null)).toBe(true);
    await synchronizeIdentity(profile("guest", "guest@example.com"), db);
    rows = await db.select().from(orders).where(eq(sql`lower(btrim(${orders.buyerEmail}))`, "guest@example.com"));
    expect(rows.map((r) => r.userId).sort()).toEqual([owner.id, unverified.id].sort());
    expect(rows.find((r) => r.buyerName === "Guest")?.buyerEmail).toBe(" Guest@Example.com ");
  });
  it("does not overwrite newer identity data with old updates and deactivates deleted users", async () => {
    await synchronizeIdentity({ ...profile("ordered"), name: "Current", updatedAt: new Date("2026-10-02") }, db);
    const old = await synchronizeIdentity({ ...profile("ordered"), name: "Old" }, db);
    expect(old.name).toBe("Current");
    await deactivateIdentity("ordered", db);
    expect((await getAccessUser(old.id, db)).permissions).toEqual([]);
    expect((await getAccessUser(old.id, db)).status).toBe("inactive");
    const late = await synchronizeIdentity({ ...profile("ordered"), updatedAt: new Date("2026-10-02") }, db);
    expect(late.status).toBe("inactive");
  });
  it("keeps administrative suspension across newer Clerk snapshots and permits explicit reactivation", async () => {
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    const target = await synchronizeIdentity(profile("suspended"), db);
    await updateStaffAccess(admin.id, target.id, { roles: ["organizer"], overrides: {}, status: "inactive" }, db);
    const synced = await synchronizeIdentity({ ...profile("suspended"), updatedAt: new Date("2030-01-01") }, db);
    expect(synced.status).toBe("inactive");
    expect(synced.permissions).toEqual([]);
    expect((await updateStaffAccess(admin.id, target.id, { roles: ["organizer"], overrides: {}, status: "active" }, db)).permissions).toContain("events.manage");
  });
  it("archives accounts without losing purchases and cannot resurrect or edit them", async () => {
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    const target = await synchronizeIdentity(profile("archived"), db);
    await db.insert(orders).values({ userId: target.id, buyerEmail: target.email, buyerName: target.name, subtotalCents: 0, totalCents: 0 });
    await expect(archiveApplicationUser(target.id, admin.id, db)).rejects.toThrow("Forbidden");
    await expect(archiveApplicationUser(admin.id, admin.id, db)).rejects.toThrow("Super admin cannot be changed");
    await archiveApplicationUser(admin.id, target.id, db);
    expect((await synchronizeIdentity({ ...profile("archived"), updatedAt: new Date("2031-01-01") }, db)).permissions).toEqual([]);
    expect((await queryApplicationUsers({ search: "archived", page: 1, pageSize: 10, role: "all", status: "all", kind: "all" }, db)).total).toBe(0);
    expect((await db.select().from(orders).where(eq(orders.userId, target.id)))).toHaveLength(1);
    await expect(updateStaffAccess(admin.id, target.id, { roles: ["admin"], overrides: {} }, db)).rejects.toThrow("User not found");
  });
  it("does not grant user management to a super-admin role outside the pinned assignment", async () => {
    const other = await synchronizeIdentity(profile("unpinned"), db);
    const [role] = await db.select().from(roles).where(eq(roles.name, "super_admin"));
    await db.insert(userRoles).values({ userId: other.id, roleId: role.id });
    const customer = await synchronizeIdentity(profile("unpinned_target"), db);
    expect((await getAccessUser(other.id, db)).permissions).not.toContain("staff.manage");
    await expect(updateStaffAccess(other.id, customer.id, { roles: ["admin"], overrides: {} }, db)).rejects.toThrow("Forbidden");
  });
  it("preserves legacy inactive users after migration and an enabled Clerk update", async () => {
    const result = await synchronizeIdentity({ ...profile("legacy_suspended", "legacy@example.com"), updatedAt: new Date("2030-01-01") }, db);
    expect(result.status).toBe("inactive");
    expect(result.permissions).toEqual([]);
  });
  it("requires the accepted invitation ID and verified matching email before granting staff roles", async () => {
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    const [invitation] = await db.insert(staffInvitations).values({ email: "invitee@example.com", name: "Invitee", roles: ["organizer"], overrides: { "events.publish": false }, invitedById: admin.id, status: "pending", expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    const notAccepted = await synchronizeIdentity(profile("not_accepted", invitation.email), db);
    expect(notAccepted.roles).not.toContain("organizer");
    const wrong = await synchronizeIdentity({ ...profile("wrong_recipient"), invitationId: invitation.id }, db);
    expect(wrong.roles).not.toContain("organizer");
    const unverified = await synchronizeIdentity({ ...profile("real_invitee", invitation.email, false), invitationId: invitation.id }, db);
    expect(unverified.roles).not.toContain("organizer");
    const accepted = await synchronizeIdentity({ ...profile("real_invitee", invitation.email), invitationId: invitation.id }, db);
    expect(accepted.roles).toContain("organizer");
    expect(accepted.permissions).not.toContain("events.publish");
    await updateStaffAccess(admin.id, accepted.id, { roles: [], overrides: {} }, db);
    expect((await synchronizeIdentity({ ...profile("real_invitee", invitation.email), invitationId: invitation.id }, db)).roles).not.toContain("organizer");
  });
  it("does not activate expired invitations or invitations for archived profiles", async () => {
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, "designated"));
    const [expired] = await db.insert(staffInvitations).values({ email: "expired@example.com", name: "Expired", roles: ["admin"], overrides: {}, invitedById: admin.id, status: "pending", expiresAt: new Date(Date.now() - 1000) }).returning();
    expect((await synchronizeIdentity({ ...profile("expired", expired.email), invitationId: expired.id }, db)).roles).not.toContain("admin");
    const target = await synchronizeIdentity(profile("archived_invitee"), db);
    await archiveApplicationUser(admin.id, target.id, db);
    const [archived] = await db.insert(staffInvitations).values({ email: target.email, name: target.name, roles: ["organizer"], overrides: {}, invitedById: admin.id, status: "pending", expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    expect((await synchronizeIdentity({ ...profile("archived_invitee"), invitationId: archived.id, updatedAt: new Date("2032-01-01") }, db)).roles).not.toContain("organizer");
  });
});

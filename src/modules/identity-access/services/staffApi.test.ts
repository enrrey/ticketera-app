// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCurrentUser, handleStaffUsers, handleStaffUpdate, handleStaffUser } from "./staffApi";
import { synchronizeIdentity } from "./identityStore";

const mocks = vi.hoisted(() => ({ session: null as string | null, canonical: null as unknown, createUser: vi.fn(), getUserList: vi.fn(), updateUser: vi.fn(), createInvitation: vi.fn(), getInvitationList: vi.fn(), revokeInvitation: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.session }), currentUser: async () => mocks.canonical,
  clerkClient: async () => ({ users: { createUser: mocks.createUser, getUserList: mocks.getUserList, updateUser: mocks.updateUser }, invitations: { createInvitation: mocks.createInvitation, getInvitationList: mocks.getInvitationList, revokeInvitation: mocks.revokeInvitation } }),
}));
vi.mock("@/lib/db", () => ({ getDatabase: () => db }));
const pg = new PGlite();
const db = drizzle(pg);
const canonical = (id: string, email = `${id}@example.com`) => ({ id, primaryEmailAddressId: "email", emailAddresses: [{ id: "email", emailAddress: email, verification: { status: "verified" } }], firstName: "Test", lastName: null, username: null, imageUrl: "", updatedAt: Date.now(), banned: false, locked: false });
const request = (method: string, body: unknown, origin = "http://localhost") => new Request("http://localhost/api/admin/users", { method, headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
}, 30_000);
beforeEach(() => { mocks.session = null; mocks.canonical = null; mocks.createUser.mockReset(); mocks.updateUser.mockReset(); mocks.getUserList.mockReset().mockResolvedValue({ data: [] }); mocks.createInvitation.mockReset().mockImplementation(async (input) => ({ id: `inv_${input.publicMetadata.ticketeraInvitationId}`, status: "pending", ...input })); mocks.getInvitationList.mockReset().mockResolvedValue({ data: [] }); });
afterAll(async () => pg.close());

describe("staff API authorization", () => {
  it("retries revocation of an expired invitation after an interrupted renewal", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    await handleCurrentUser();
    const old = await pg.query<{ id: string }>(`insert into staff_invitation (email,name,roles,overrides,invited_by_id,status,expires_at) select 'revoke_retry@example.com','Retry','["organizer"]','{}',id,'pending',now()-interval '1 day' from "user" where clerk_user_id='super_api' returning id`);
    mocks.getInvitationList.mockResolvedValue({ data: [{ id: "inv_revoke_retry", emailAddress: "revoke_retry@example.com", publicMetadata: { ticketeraInvitationId: old.rows[0].id } }] });
    mocks.revokeInvitation.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({});
    const input = { email: "revoke_retry@example.com", name: "Retry", roles: ["organizer"], overrides: {} };
    expect((await handleStaffUsers(request("POST", input))).status).toBe(503);
    await pg.exec(`update staff_invitation set created_at=now()-interval '2 minutes' where email='revoke_retry@example.com' and status='sending'`);
    expect((await handleStaffUsers(request("POST", input))).status).toBe(201);
    expect(mocks.revokeInvitation.mock.calls.filter(([id]) => id === "inv_revoke_retry")).toHaveLength(2);
  });
  it("rejects anonymous creation before calling Clerk", async () => {
    expect((await handleStaffUsers(request("POST", {}))).status).toBe(401);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("rejects customers even if they submit super-admin role or forged metadata", async () => {
    mocks.session = "customer_api"; mocks.canonical = canonical("customer_api");
    expect((await handleStaffUsers(request("POST", { roles: ["super_admin"] }))).status).toBe(403);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("emails an invitation without password and grants access only after verified Clerk acceptance", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const response = await handleStaffUsers(request("POST", { email: "new_staff_api@example.com", name: "New Staff", roles: ["admin"], overrides: { "events.publish": false } }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result).toMatchObject({ email: "new_staff_api@example.com", status: "pending" });
    expect(result).not.toHaveProperty("password");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createInvitation).toHaveBeenCalledWith(expect.objectContaining({ notify: true, redirectUrl: "http://localhost:3000", expiresInDays: 7, publicMetadata: { ticketeraInvitationId: result.id } }));
    const before = await pg.query<{ count: number }>(`select count(*)::int as count from "user" where email='new_staff_api@example.com'`);
    expect(before.rows[0].count).toBe(0);
    mocks.session = "new_staff_api";
    mocks.canonical = { ...canonical("new_staff_api"), publicMetadata: { ticketeraInvitationId: result.id } };
    const accepted = await handleCurrentUser();
    expect((await accepted.json()).roles).toContain("admin");
    const again = await handleCurrentUser();
    expect((await again.json()).permissions).not.toContain("events.publish");
    const audit = await pg.query<{ count: number }>(`select count(*)::int as count from audit_log where action='staff.invitation_accepted'`);
    expect(audit.rows[0].count).toBe(1);
  });
  it("rejects cross-origin mutations and attempts to assign super-admin privileges", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    expect((await handleStaffUsers(request("POST", {}, "https://other.example"))).status).toBe(403);
    const target = await synchronizeIdentity({ clerkUserId: "target_api", email: "target@example.com", name: "Target", verifiedEmails: [], updatedAt: new Date(), disabled: false }, db);
    expect((await handleStaffUpdate(request("PATCH", { roles: ["super_admin"], overrides: {} }), target.id)).status).toBe(400);
    expect((await handleStaffUpdate(request("PATCH", { roles: ["admin"], overrides: { "staff.manage": true } }), target.id)).status).toBe(400);
  });
  it("rejects inviting an existing account instead of recreating it", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    mocks.getUserList.mockResolvedValue({ data: [canonical("existing_staff_api")] });
    const response = await handleStaffUsers(request("POST", { email: "existing_staff_api@example.com", name: "Existing", roles: ["organizer"], overrides: {} }));
    expect(response.status).toBe(409);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("returns filtered pagination and rejects invalid pagination before querying", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const target = await synchronizeIdentity({ clerkUserId: "existing_staff_api", email: "existing_staff_api@example.com", name: "Existing", verifiedEmails: [], updatedAt: new Date(), disabled: false });
    await handleStaffUpdate(request("PATCH", { roles: ["organizer"], overrides: {} }), target.id);
    const response = await handleStaffUsers(new Request("http://localhost/api/admin/users?search=existing_staff_api&pageSize=5&role=organizer"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(1);
    expect(result.users).toHaveLength(1);
    expect(result.pageSize).toBe(5);
    expect((await handleStaffUsers(new Request("http://localhost/api/admin/users?pageSize=100000"))).status).toBe(400);
  });
  it("supports detail, profile editing and logical deletion with authorization and protected super admin", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const target = await synchronizeIdentity({ clerkUserId: "crud_api", email: "crud@example.com", name: "Before", verifiedEmails: [], updatedAt: new Date(), disabled: false });
    expect((await handleStaffUser(new Request("http://localhost/api/admin/users"), target.id)).status).toBe(200);
    mocks.updateUser.mockResolvedValue({ ...canonical("crud_api", "crud@example.com"), firstName: "After" });
    const updated = await handleStaffUpdate(request("PATCH", { name: "After", status: "inactive", roles: ["organizer"], overrides: {} }), target.id);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ name: "After", status: "inactive" });
    const superUser = await synchronizeIdentity({ clerkUserId: "super_api", email: "ronaldreyesramirez@gmail.com", name: "Super", verifiedEmails: ["ronaldreyesramirez@gmail.com"], updatedAt: new Date(), disabled: false });
    expect((await handleStaffUser(request("DELETE", {}), superUser.id)).status).toBe(403);
    expect((await handleStaffUser(request("DELETE", {}, "https://attacker.example"), target.id)).status).toBe(403);
    expect((await handleStaffUser(request("DELETE", {}), target.id)).status).toBe(204);
    expect((await handleStaffUser(new Request("http://localhost/api/admin/users"), target.id)).status).toBe(404);
    expect((await handleStaffUpdate(request("PATCH", { name: "No", roles: [], overrides: {} }), superUser.id)).status).toBe(403);
    mocks.session = "customer_api"; mocks.canonical = canonical("customer_api");
    expect((await handleStaffUser(request("DELETE", {}), target.id)).status).toBe(403);
  });
  it("blocks duplicate sends and retries a failed provider request without a duplicate intent", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const input = { name: "Retry", email: "retry@example.com", roles: ["organizer"], overrides: {} };
    mocks.createInvitation.mockRejectedValueOnce({ status: 422 });
    expect((await handleStaffUsers(request("POST", input))).status).toBe(503);
    expect((await handleStaffUsers(request("POST", input))).status).toBe(201);
    expect((await handleStaffUsers(request("POST", input))).status).toBe(409);
    const intents = await pg.query<{ count: number }>(`select count(*)::int as count from staff_invitation where email='retry@example.com'`);
    expect(intents.rows[0].count).toBe(1);
  });
  it("recovers a delivered invitation after an interrupted local acknowledgement without resending email", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const actor = await synchronizeIdentity({ clerkUserId: "super_api", email: "ronaldreyesramirez@gmail.com", name: "Super", verifiedEmails: ["ronaldreyesramirez@gmail.com"], updatedAt: new Date(), disabled: false });
    const pending = await pg.query<{ id: string }>(`insert into staff_invitation (email,name,roles,overrides,invited_by_id,expires_at,status,created_at) values ('delivered@example.com','Delivered','["organizer"]','{}',$1,now()+interval '1 day','sending',now()-interval '2 minutes') returning id`, [actor.id]);
    mocks.getInvitationList.mockResolvedValue({ data: [{ id: "inv_delivered", emailAddress: "delivered@example.com", publicMetadata: { ticketeraInvitationId: pending.rows[0].id } }] });
    const response = await handleStaffUsers(request("POST", { email: "delivered@example.com", name: "Delivered", roles: ["organizer"], overrides: {} }));
    expect(response.status).toBe(201);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
    expect((await response.json()).id).toBe(pending.rows[0].id);
  });
  it("preserves acceptance eligibility if delivery succeeds but the local acknowledgement fails", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const original = db.transaction.bind(db);
    let transactions = 0;
    const spy = vi.spyOn(db, "transaction").mockImplementation((...args: Parameters<typeof db.transaction>) => {
      if (++transactions === 3) return Promise.reject(new Error("Acknowledgement unavailable"));
      return original(...args);
    });
    try { expect((await handleStaffUsers(request("POST", { email: "ack@example.com", name: "Ack", roles: ["organizer"], overrides: {} }))).status).toBe(503); }
    finally { spy.mockRestore(); }
    const sent = mocks.createInvitation.mock.calls[0][0];
    mocks.session = "ack_user"; mocks.canonical = { ...canonical("ack_user", "ack@example.com"), publicMetadata: sent.publicMetadata };
    expect((await (await handleCurrentUser()).json()).roles).toContain("organizer");
  });
  it("renews expired invitations with a fresh identity so the old link cannot receive the renewed roles", async () => {
    mocks.session = "super_api"; mocks.canonical = canonical("super_api", "ronaldreyesramirez@gmail.com");
    const actor = await synchronizeIdentity({ clerkUserId: "super_api", email: "ronaldreyesramirez@gmail.com", name: "Super", verifiedEmails: ["ronaldreyesramirez@gmail.com"], updatedAt: new Date(), disabled: false });
    const old = await pg.query<{ id: string }>(`insert into staff_invitation (email,name,roles,overrides,invited_by_id,expires_at,status,clerk_invitation_id) values ('renew@example.com','Renew','["organizer"]','{}',$1,now()-interval '1 day','pending','inv_old_renew') returning id`, [actor.id]);
    mocks.getInvitationList.mockResolvedValue({ data: [{ id: "inv_old_renew", emailAddress: "renew@example.com", publicMetadata: { ticketeraInvitationId: old.rows[0].id } }] });
    const response = await handleStaffUsers(request("POST", { email: "renew@example.com", name: "Renew", roles: ["admin"], overrides: {} }));
    expect(response.status).toBe(201);
    const renewed = await response.json();
    expect(renewed.id).not.toBe(old.rows[0].id);
    mocks.session = "renew_user"; mocks.canonical = { ...canonical("renew_user", "renew@example.com"), publicMetadata: { ticketeraInvitationId: old.rows[0].id } };
    expect((await (await handleCurrentUser()).json()).roles).not.toContain("admin");
    mocks.canonical = { ...canonical("renew_user", "renew@example.com"), publicMetadata: { ticketeraInvitationId: renewed.id }, updatedAt: Date.now() + 1 };
    expect((await (await handleCurrentUser()).json()).roles).toContain("admin");
    expect(mocks.revokeInvitation).toHaveBeenCalledWith("inv_old_renew");
  });
});

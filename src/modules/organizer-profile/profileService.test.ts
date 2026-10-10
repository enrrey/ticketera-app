// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auditLogs, organizerProfiles, users } from "@/lib/db/schema";
// Keep canonical persisted access; Clerk is only the HTTP authentication boundary.
vi.mock("@/modules/identity-access", async () => ({
  ...await import("@/modules/identity-access/services/identityStore"),
  AccessError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
import { saveOrganizerProfile, readOrganizerProfile } from "./profileService";

const pg = new PGlite();
const db = drizzle(pg);
let organizerId: string;
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((file) => file.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
  const [owner] = await db.insert(users).values({ clerkUserId: "profile-owner", email: "owner@example.test", name: "Owner", identityUpdatedAt: new Date() }).returning();
  organizerId = owner.id;
  await db.execute(sql`insert into user_role (user_id, role_id) select ${organizerId}::uuid, id from role where name = 'organizer'`);
}, 30_000);
afterAll(async () => pg.close());

describe("organizer profile persistence", () => {
  it("upserts the own business and records no business PII in audit", async () => {
    await saveOrganizerProfile(organizerId, { businessName: "Business One", ruc: "12345678901" }, db);
    await saveOrganizerProfile(organizerId, { businessName: "Business Two", ruc: "10987654321" }, db);
    expect((await db.select().from(organizerProfiles)).length).toBe(1);
    expect((await readOrganizerProfile(organizerId, db)).businessName).toBe("Business Two");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "organizer.profile_updated"));
    expect(logs).toHaveLength(2); expect(logs.every((log) => log.metadata === null && log.entityId === organizerId)).toBe(true);
  });
  it("rechecks persisted access after a staff permission revocation", async () => {
    await db.execute(sql`insert into user_permission (user_id, permission_id, allowed) select ${organizerId}::uuid, id, false from permission where name = 'events.manage'`);
    await expect(saveOrganizerProfile(organizerId, { businessName: "Revoked", ruc: "12345678901" }, db)).rejects.toThrow("No tienes permiso");
    expect((await db.select().from(organizerProfiles))[0].businessName).toBe("Business Two");
  });
});

// @vitest-environment node
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { users, webhookEvents } from "@/lib/db/schema";
import { handleClerkWebhook } from "./clerkWebhook";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: null }), currentUser: async () => null, clerkClient: async () => ({ users: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/db", () => ({ getDatabase: () => db }));
const pg = new PGlite();
const db = drizzle(pg);
const secretBytes = Buffer.from("clerk-webhook-isolated-test-secret");
const secret = `whsec_${secretBytes.toString("base64")}`;
const canonical = { id: "webhook_user", primaryEmailAddressId: "email", emailAddresses: [{ id: "email", emailAddress: "webhook@example.com", verification: { status: "verified" } }], firstName: "Current", lastName: null, username: null, imageUrl: "", updatedAt: Date.now(), banned: false, locked: false };
function signedRequest(id: string, type = "user.updated", forged = false) {
  const body = JSON.stringify({ type, object: "event", timestamp: Date.now(), data: { id: canonical.id, first_name: "Outdated" } });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new NextRequest("http://localhost/api/webhooks/clerk", { method: "POST", body, headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${forged ? "invalid" : signature}` } });
}
beforeAll(async () => {
  for (const file of readdirSync(resolve("drizzle")).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(resolve("drizzle", file), "utf8"));
}, 30_000);
afterAll(async () => pg.close());
afterEach(() => { vi.unstubAllEnvs(); mocks.getUser.mockReset(); });

describe("signed Clerk webhook reconciliation", () => {
  it("rejects forged events without retrieving a user", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
    expect((await handleClerkWebhook(signedRequest("msg_forged", "user.updated", true))).status).toBe(400);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("uses canonical Clerk data, persists atomically and deduplicates", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret); mocks.getUser.mockResolvedValue(canonical);
    expect((await handleClerkWebhook(signedRequest("msg_current"))).status).toBe(200);
    expect((await handleClerkWebhook(signedRequest("msg_current"))).status).toBe(200);
    const [user] = await db.select().from(users).where(eq(users.clerkUserId, canonical.id));
    expect(user.name).toBe("Current");
    const events = await db.select().from(webhookEvents).where(eq(webhookEvents.externalEventId, "msg_current"));
    expect(events).toHaveLength(1); expect(events[0].status).toBe("processed");
  });
  it("deactivates a deleted Clerk identity without deleting its profile", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret); mocks.getUser.mockRejectedValue({ status: 404 });
    expect((await handleClerkWebhook(signedRequest("msg_deleted", "user.deleted"))).status).toBe(200);
    const [user] = await db.select().from(users).where(eq(users.clerkUserId, canonical.id));
    expect(user.status).toBe("inactive");
  });
  it("returns a retryable error on backend failure without acknowledging the event", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret); mocks.getUser.mockRejectedValue(new Error("Unavailable"));
    expect((await handleClerkWebhook(signedRequest("msg_retry"))).status).toBe(503);
    expect(await db.select().from(webhookEvents).where(eq(webhookEvents.externalEventId, "msg_retry"))).toHaveLength(0);
  });
});

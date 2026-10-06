import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { profileFromClerk } from "./clerkIdentity";
import { deactivateIdentity, synchronizeIdentity } from "./identityStore";

export async function handleClerkWebhook(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  let event;
  try { event = await verifyWebhook(request); } catch { return Response.json({ error: "Invalid webhook signature" }, { status: 400 }); }
  if (!["user.created", "user.updated", "user.deleted"].includes(event.type)) return Response.json({ ignored: true });
  const clerkId = event.data.id;
  const eventId = request.headers.get("svix-id");
  if (!clerkId || !eventId) return Response.json({ error: "Invalid event" }, { status: 400 });
  try {
    const client = await clerkClient();
    let canonical;
    try { canonical = await client.users.getUser(clerkId); }
    catch (error) {
      if (typeof error !== "object" || !error || !("status" in error) || error.status !== 404) throw error;
      canonical = null;
    }
    const db = getDatabase();
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(webhookEvents).values({
        provider: "clerk", externalEventId: eventId, type: event.type, objectId: clerkId,
        livemode: false, providerCreatedAt: new Date(event.timestamp), status: "processing",
      }).onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.externalEventId] }).returning();
      if (!inserted) return;
      if (canonical) await synchronizeIdentity(profileFromClerk(canonical), tx);
      else await deactivateIdentity(clerkId, tx);
      await tx.update(webhookEvents).set({ status: "processed", attempts: 1, processedAt: new Date() }).where(eq(webhookEvents.id, inserted.id));
    });
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Unable to synchronize identity" }, { status: 503 }); }
}

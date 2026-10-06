import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

export type StripeInboxEvent = typeof webhookEvents.$inferInsert;

export async function persistStripeEvent(
  event: StripeInboxEvent,
  database: PgDatabase<PgQueryResultHKT, Record<string, unknown>> = getDatabase(),
) {
  const inserted = await database.insert(webhookEvents).values(event)
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.externalEventId] })
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
}

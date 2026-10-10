import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { auditLogs, organizerProfiles, users } from "@/lib/db/schema";
import { AccessError, getAccessUser } from "@/modules/identity-access";
import { canManageOrganizerProfile, organizerProfileSchema } from "./profileValidation";
import type { ConnectStatus, OrganizerProfile } from "./types";

type Database = Parameters<typeof getAccessUser>[1];
export type ConnectStatusReader = (userId: string) => Promise<ConnectStatus>;

export async function readOrganizerProfile(userId: string, db: Database = getDatabase()): Promise<Omit<OrganizerProfile, "connect">> {
  const actor = await getAccessUser(userId, db);
  if (!canManageOrganizerProfile(actor)) throw new AccessError(403, "No tienes permiso para configurar el negocio");
  const [profile] = await db!.select().from(organizerProfiles).where(eq(organizerProfiles.userId, userId));
  return { businessName: profile?.businessName ?? "", ruc: profile?.ruc ?? "", updatedAt: profile?.updatedAt.toISOString() ?? null };
}

export async function saveOrganizerProfile(userId: string, input: unknown, db: Database = getDatabase()) {
  const values = organizerProfileSchema.parse(input);
  return db!.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const actor = await getAccessUser(userId, tx);
    if (!canManageOrganizerProfile(actor)) throw new AccessError(403, "No tienes permiso para configurar el negocio");
    const [profile] = await tx.insert(organizerProfiles).values({ userId, ...values })
      .onConflictDoUpdate({ target: organizerProfiles.userId, set: { ...values, updatedAt: sql`now()` } }).returning();
    await tx.insert(auditLogs).values({ actorId: userId, action: "organizer.profile_updated", entity: "organizer_profile", entityId: userId });
    return { businessName: profile.businessName, ruc: profile.ruc, updatedAt: profile.updatedAt.toISOString() };
  });
}

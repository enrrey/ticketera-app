import type { IdentityProfile } from "../types";
type ClerkProfile = {
  id: string; primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
  firstName: string | null; lastName: string | null; username: string | null;
  imageUrl: string; updatedAt: number; banned: boolean; locked: boolean;
  publicMetadata?: Record<string, unknown>;
};
/** Only call with data retrieved or verified by Clerk's backend SDK. */
export function profileFromClerk(user: ClerkProfile): IdentityProfile {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  if (!primary) throw new Error("Clerk account requires an email address");
  return {
    clerkUserId: user.id, email: primary.emailAddress,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || primary.emailAddress,
    avatarUrl: user.imageUrl, updatedAt: new Date(user.updatedAt), disabled: user.banned || user.locked,
    verifiedEmails: user.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress),
    invitationId: typeof user.publicMetadata?.ticketeraInvitationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.publicMetadata.ticketeraInvitationId) ? user.publicMetadata.ticketeraInvitationId : undefined,
  };
}

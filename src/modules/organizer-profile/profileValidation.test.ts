import { describe, expect, it } from "vitest";
import type { AccessUser } from "@/modules/identity-access";
import { canManageOrganizerProfile, organizerProfileSchema } from "./profileValidation";

const actor: AccessUser = { id: "id", clerkUserId: "clerk", email: "", name: "", status: "active", roles: ["organizer"], permissions: ["events.manage"], overrides: {} };
describe("organizer profile contract", () => {
  it("trims fields and accepts format without claiming tax verification", () => {
    expect(organizerProfileSchema.parse({ businessName: " Negocio ", ruc: " 12345678901 " })).toEqual({ businessName: "Negocio", ruc: "12345678901" });
  });
  it("rejects missing names, malformed RUC and foreign owner fields", () => {
    for (const input of [{ businessName: " ", ruc: "12345678901" }, { businessName: "Nombre", ruc: "1234567890a" }, { businessName: "Nombre", ruc: "1234567890" }, { businessName: "Nombre", ruc: "12345678901", userId: "another" }]) expect(organizerProfileSchema.safeParse(input).success).toBe(false);
  });
  it("requires active staff role and persisted permission", () => {
    expect(canManageOrganizerProfile(actor)).toBe(true);
    expect(canManageOrganizerProfile({ ...actor, status: "inactive" })).toBe(false);
    expect(canManageOrganizerProfile({ ...actor, roles: ["customer"] })).toBe(false);
    expect(canManageOrganizerProfile({ ...actor, permissions: [] })).toBe(false);
  });
});

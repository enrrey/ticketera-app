import { z } from "zod";
import type { AccessUser } from "@/modules/identity-access";

export const organizerProfileSchema = z.object({
  businessName: z.string().trim().min(1, "Ingresa el nombre del negocio").max(150),
  ruc: z.string().trim().regex(/^\d{11}$/, "El RUC debe contener 11 dígitos"),
}).strict();

export function canManageOrganizerProfile(user: AccessUser) {
  return user.status === "active" && user.roles.some((role) => ["organizer", "admin", "super_admin"].includes(role)) && user.permissions.includes("events.manage");
}

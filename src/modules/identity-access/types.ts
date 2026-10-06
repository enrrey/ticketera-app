export const roleNames = ["customer", "admin", "organizer", "super_admin"] as const;
export type RoleName = typeof roleNames[number];
export const permissionDefinitions = {
  "staff.manage": "Gestionar usuarios, roles y permisos",
  "events.manage": "Gestionar eventos",
  "events.publish": "Publicar eventos",
  "tickets.check_in": "Validar entradas",
  "refunds.manage": "Gestionar reembolsos",
  "settlements.manage": "Gestionar liquidaciones",
  "tickets.read_own": "Consultar sus propias entradas",
} as const;
export type PermissionName = keyof typeof permissionDefinitions;
export type AccessUser = {
  id: string; clerkUserId: string; email: string; name: string; status: string;
  roles: RoleName[]; permissions: PermissionName[];
  overrides: Partial<Record<PermissionName, boolean>>;
};
export type IdentityProfile = {
  clerkUserId: string; email: string; name: string; avatarUrl?: string | null;
  verifiedEmails: string[]; updatedAt: Date; disabled: boolean;
  invitationId?: string;
};
export type StaffSettings = {
  roles: ("admin" | "organizer")[];
  overrides: Partial<Record<PermissionName, boolean>>;
  status?: "active" | "inactive";
};
export type UsersQuery = {
  search: string; role: RoleName | "all"; status: "active" | "inactive" | "all";
  kind: "all" | "staff" | "customer"; page: number; pageSize: number;
};
export type UsersPage = { users: AccessUser[]; total: number; page: number; pageSize: number };

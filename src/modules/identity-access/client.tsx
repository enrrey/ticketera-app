"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { AccessUser } from "./types";

const AccessContext = createContext<AccessUser | null>(null);
export function ApplicationAccessProvider({ user, children }: { user: AccessUser | null; children: ReactNode }) {
  return <AccessContext.Provider value={user}>{children}</AccessContext.Provider>;
}
export function useApplicationAccess() { return useContext(AccessContext); }
export { ManagementShell } from "./components/ManagementShell";
export { StaffUsersPage } from "./components/StaffUsersPage";

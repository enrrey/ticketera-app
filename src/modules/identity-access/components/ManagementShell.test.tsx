import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ManagementShell } from "./ManagementShell";
import { ApplicationAccessProvider } from "../client";
import type { AccessUser } from "../types";
vi.mock("next/navigation", () => ({ usePathname: () => "/administracion/usuarios" }));
const user: AccessUser = { id: "test", clerkUserId: "test", email: "test@example.com", name: "Ana Test", status: "active", roles: ["organizer"], permissions: ["events.manage"], overrides: {} };
it("shows only permitted navigation and opens the accessible mobile menu", async () => {
  render(<ApplicationAccessProvider user={user}><ManagementShell>Contenido</ManagementShell></ApplicationAccessProvider>);
  expect(screen.queryByRole("link", { name: "Usuarios y permisos" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/organizador");
  expect(screen.queryByRole("link", { name: "Crear evento" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(await screen.findByRole("dialog")).toHaveAccessibleName("ticketera");
});
it("makes user administration available to super admin", () => {
  render(<ApplicationAccessProvider user={{ ...user, roles: ["super_admin"], permissions: ["staff.manage"] }}><ManagementShell>Contenido</ManagementShell></ApplicationAccessProvider>);
  expect(screen.getByRole("link", { name: "Usuarios y permisos" })).toHaveAttribute("aria-current", "page");
});

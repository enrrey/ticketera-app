import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StaffUsersPage } from "./StaffUsersPage";
import type { AccessUser, UsersPage } from "../types";

const staff: AccessUser = { id: "staff", clerkUserId: "user_staff", name: "Ana", email: "ana@example.com", status: "active", roles: ["customer", "organizer"], permissions: ["events.manage"], overrides: { "events.publish": false } };
const initial: UsersPage = { users: [staff], total: 1, page: 1, pageSize: 10 };
afterEach(() => vi.unstubAllGlobals());
it("filters on the server and returns to the first page when the search changes", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...initial, users: [], total: 0 }));
  vi.stubGlobal("fetch", fetcher);
  render(<StaffUsersPage initialPage={{ ...initial, total: 20, page: 2 }} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Nobody" } });
  await waitFor(() => expect(screen.getByText("No encontramos usuarios")).toBeInTheDocument());
  expect(fetcher.mock.calls[0][0]).toContain("search=Nobody");
  expect(fetcher.mock.calls[0][0]).toContain("page=1");
});
it("edits existing roles and individual denies without changing email", async () => {
  const fetcher = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => Response.json(options?.method === "PATCH" ? staff : initial));
  vi.stubGlobal("fetch", fetcher);
  render(<StaffUsersPage initialPage={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Organizador")).toBeChecked();
  expect(within(dialog).getByLabelText("Correo electrónico")).toHaveAttribute("readonly");
  fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("actualizado"));
  const mutation = fetcher.mock.calls.find(call => call[1]?.method === "PATCH");
  expect(JSON.parse(mutation![1].body)).toMatchObject({ name: "Ana", status: "active", roles: ["organizer"], overrides: { "events.publish": false } });
});
it("sends email invitations without collecting a password", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => Response.json(options?.method === "POST" ? staff : initial)));
  render(<StaffUsersPage initialPage={{ ...initial, users: [], total: 0 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Invitar usuario" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre completo"), { target: { value: "Ana" } });
  fireEvent.change(within(dialog).getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
  expect(within(dialog).queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Enviar invitación" }));
  await waitFor(() => expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument());
  expect(screen.getByRole("status")).toHaveTextContent("Invitación enviada");
});
it("requires confirmation before deletion and retains the form on API failure", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "Servicio temporalmente no disponible" }, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  render(<StaffUsersPage initialPage={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Eliminar Ana" }));
  const dialog = await screen.findByRole("dialog");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar usuario" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Servicio temporalmente"));
  expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
});
it("protects super admin and exposes details without edit or delete", () => {
  render(<StaffUsersPage initialPage={{ ...initial, users: [{ ...staff, roles: ["super_admin"] }] }} />);
  expect(screen.getByText("Protegido")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar Ana" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar Ana" })).not.toBeInTheDocument();
});

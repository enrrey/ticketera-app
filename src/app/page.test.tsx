import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Home from "./page";
import { LoginPage } from "@/modules/portal";
vi.mock("@clerk/nextjs", () => ({ SignIn: (props: { forceRedirectUrl: string; signUpForceRedirectUrl: string; withSignUp: boolean }) => <div aria-label="Aceptar invitación con Clerk" data-return={props.forceRedirectUrl} data-signup-return={props.signUpForceRedirectUrl} data-signup={String(props.withSignUp)} /> }));
it("shows Clerk authentication at localhost root for an invitation ticket and returns registration to home", async () => {
  const page = await Home({ searchParams: Promise.resolve({ __clerk_ticket: "test_invitation_ticket" }) });
  expect(page.type).toBe(LoginPage);
  render(page);
  const auth = screen.getByLabelText("Aceptar invitación con Clerk");
  expect(auth).toHaveAttribute("data-return", "/");
  expect(auth).toHaveAttribute("data-signup-return", "/");
  expect(auth).toHaveAttribute("data-signup", "true");
});

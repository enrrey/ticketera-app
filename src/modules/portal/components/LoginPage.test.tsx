import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LoginPage } from "./PortalPages";

vi.mock("@clerk/nextjs", () => ({
  SignIn: ({forceRedirectUrl}:{forceRedirectUrl:string}) => <div aria-label="Autenticación Clerk" data-return={forceRedirectUrl} />,
}));

it("offers real authentication instead of the demo login", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText("Autenticación Clerk")).toBeInTheDocument();
  expect(screen.queryByText(/Prototipo UI/)).not.toBeInTheDocument();
});
it("returns to the organizer panel after login and rejects external return URLs",()=>{
  const view=render(<LoginPage returnTo="/organizador"/>);
  expect(screen.getByLabelText("Autenticación Clerk")).toHaveAttribute("data-return","/organizador");
  view.rerender(<LoginPage returnTo="https://example.com"/>);
  expect(screen.getByLabelText("Autenticación Clerk")).toHaveAttribute("data-return","/");
});

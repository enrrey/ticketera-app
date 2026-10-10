import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayButton } from "./PayButton";

afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.clear(); });
describe("PayButton", () => {
  it("posts token in a header, saves return access locally, and navigates to validated Stripe URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test" }));
    vi.stubGlobal("fetch", fetchMock);
    const navigate = vi.fn();
    render(<PayButton orderId="order1" token="private-token" navigate={navigate} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pagar con Stripe" })); });
    expect(fetchMock).toHaveBeenCalledWith("/api/checkout/order1/payment", expect.objectContaining({ method: "POST", headers: { "x-order-token": "private-token" } }));
    expect(window.sessionStorage.getItem("ticketera:order:order1")).toBe("private-token");
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test");
  });
  it("disables duplicate clicks and announces a failed request", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PayButton orderId="order1" navigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    await act(async () => { resolve(Response.json({ error: "La reserva venció" }, { status: 409 })); });
    expect(screen.getByRole("alert")).toHaveTextContent("La reserva venció");
    expect(screen.getByRole("button")).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a non-Stripe redirect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ url: "https://attacker.example/pay" })));
    const navigate = vi.fn(); render(<PayButton orderId="o" navigate={navigate} />);
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("pago seguro");
  });
});

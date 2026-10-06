import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderPage } from "./OrderPage";

const summary = {
  orderId: "o1", status: "pending", totalCents: 10000, currency: "pen", expired: false,
  serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(),
  items: [{ ticketTypeId: "t1", name: "General", quantity: 1, unitPriceCents: 10000, totalCents: 10000 }],
};
afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ""; });

describe("OrderPage", () => {
  it("sends the fragment token as a header, never in the request URL (CA-18, CA-22)", async () => {
    window.location.hash = "#t=secret-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(summary), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderPage orderId="o1" />);
    expect(await screen.findByRole("heading", { name: "Resumen de tu pedido" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout/o1");
    expect(url).not.toContain("secret-token");
    expect(init.headers).toEqual({ "x-order-token": "secret-token" });
  });

  it("explains a missing or unauthorized order without revealing which", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 })));
    render(<OrderPage orderId="o1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No encontramos este pedido/);
  });

  it("shows a retry hint when the server fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    render(<OrderPage orderId="o1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos cargar tu pedido/);
  });
});

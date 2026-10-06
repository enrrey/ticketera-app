import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketCheckout } from "./TicketCheckout";
import type { CheckoutTicketOption, CreatedCheckout } from "../types";

const base = { zone: "Zona", description: "", salesStartAt: "2020-01-01T00:00:00Z", salesEndAt: "2099-01-01T00:00:00Z" };
const options: CheckoutTicketOption[] = [
  { ...base, id: "general", name: "General", priceCents: 10000, maxPerOrder: 4, available: 10 },
  { ...base, id: "vip", name: "VIP", priceCents: 25050, maxPerOrder: 6, available: 2 },
  { ...base, id: "sold", name: "Platea", priceCents: 9900, maxPerOrder: 6, available: 0 },
  { ...base, id: "closed", name: "Rezagados", priceCents: 5000, maxPerOrder: 6, available: 5, salesEndAt: "2021-01-01T00:00:00Z" },
];
const created: CreatedCheckout = {
  orderId: "11111111-1111-4111-8111-111111111111", status: "pending", totalCents: 20000, currency: "pen",
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), serverTime: new Date().toISOString(), expired: false, accessToken: "guest-token",
  items: [{ ticketTypeId: "general", name: "General", quantity: 2, unitPriceCents: 10000, totalCents: 20000 }],
};
const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => vi.unstubAllGlobals());

async function fill(user: ReturnType<typeof userEvent.setup>, quantity = "2") {
  const general = screen.getByLabelText("Cantidad de General");
  await user.clear(general); await user.type(general, quantity);
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
}

describe("TicketCheckout", () => {
  it("lists price, remaining stock and limits, and disables unavailable types with their reason (CA-15, CA-19)", () => {
    render(<TicketCheckout eventId="evento" options={options} />);
    expect(screen.getByText(/S\/\s?100\.00 · Quedan 10 · Máximo 4 por compra/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Platea")).toBeDisabled();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Rezagados")).toBeDisabled();
    expect(screen.getByText("Venta cerrada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reservar entradas" })).toBeDisabled();
  });

  it("clamps quantities to the order limit and the remaining stock", async () => {
    const user = userEvent.setup();
    render(<TicketCheckout eventId="evento" options={options} />);
    await user.clear(screen.getByLabelText("Cantidad de General")); await user.type(screen.getByLabelText("Cantidad de General"), "9");
    expect(screen.getByLabelText("Cantidad de General")).toHaveValue(4);
    await user.clear(screen.getByLabelText("Cantidad de VIP")); await user.type(screen.getByLabelText("Cantidad de VIP"), "5");
    expect(screen.getByLabelText("Cantidad de VIP")).toHaveValue(2);
  });

  it("sends only ids, quantities and buyer data, then shows the summary with countdown and no payment (CA-15, CA-16, CA-17)", async () => {
    const user = userEvent.setup();
    const fetchMock = reply(201, created);
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    expect(screen.getByText(/Total estimado: S\/\s?200\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reservar entradas" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout");
    expect(JSON.parse(init.body)).toEqual({ eventId: "evento", items: [{ ticketTypeId: "general", quantity: 2 }], buyer: { name: "Ana Pérez", email: "ana@example.com" } });
    expect(await screen.findByRole("heading", { name: "Resumen de tu pedido" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^(14:5\d|15:00)$/);
    expect(screen.getByText(/2 × General/)).toBeInTheDocument();
    expect(screen.getByText(/El pago aún no está disponible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pagar|confirmar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/pedidos\/11111111-1111-4111-8111-111111111111#t=guest-token$/ })).toBeInTheDocument();
  });

  it("keeps what the buyer typed and announces server errors and remaining stock (CA-15)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", reply(409, { error: "No hay cupo suficiente", code: "insufficient_inventory", details: [{ ticketTypeId: "general", available: 1 }] }));
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reservar entradas" }));
    expect(await screen.findByText("No hay cupo suficiente")).toBeInTheDocument();
    expect(screen.getByText("Solo quedan 1 de General.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Cantidad de General")).toHaveValue(2);
    expect(screen.getByRole("button", { name: "Reservar entradas" })).toBeEnabled();
  });

  it("reports connection failures without losing the form", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reservar entradas" }));
    expect(await screen.findByText(/No pudimos conectar/)).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@example.com");
  });
});

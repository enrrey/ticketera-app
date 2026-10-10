import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketCheckout } from "./TicketCheckout";
import type { CheckoutTicketOption, CreatedCheckout } from "../types";
vi.mock("@/modules/payments", () => ({ InlinePayment: () => <div>Pagar dentro de Ticketera</div> }));

const base = { zone: "Zona", description: "", salesStartAt: "2020-01-01T00:00:00Z", salesEndAt: "2099-01-01T00:00:00Z" };
const options: CheckoutTicketOption[] = [
  { ...base, id: "general", name: "General", priceCents: 10000, maxPerOrder: 4, available: 10 },
  { ...base, id: "vip", name: "VIP", priceCents: 25050, maxPerOrder: 6, available: 2 },
  { ...base, id: "sold", name: "Platea", priceCents: 9900, maxPerOrder: 6, available: 0 },
  { ...base, id: "closed", name: "Rezagados", priceCents: 5000, maxPerOrder: 6, available: 5, salesEndAt: "2021-01-01T00:00:00Z" },
];
const created: CreatedCheckout = {
  orderId: "11111111-1111-4111-8111-111111111111", status: "pending", totalCents: 20000, currency: "pen",
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), serverTime: new Date().toISOString(), expired: false, accessToken: "guest-token",
  items: [{ ticketTypeId: "general", name: "General", quantity: 2, unitPriceCents: 10000, totalCents: 20000 }],
};
const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => vi.unstubAllGlobals());

async function fill(user: ReturnType<typeof userEvent.setup>, quantity = "2") {
  const general = screen.getByLabelText("Cantidad de General");
  await user.clear(general); await user.type(general, quantity);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await fillBuyer(user);
}

async function fillBuyer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
  await user.type(screen.getByLabelText("Número de documento"), "12345678");
  await user.type(screen.getByLabelText("Celular"), "999123456");
  await user.click(screen.getByRole("checkbox"));
}

describe("TicketCheckout", () => {
  it("lists price, remaining stock and limits, and disables unavailable types with their reason (CA-15, CA-19)", () => {
    render(<TicketCheckout eventId="evento" options={options} />);
    expect(screen.getByText(/S\/\s?100\.00 · Quedan 10 · Máximo 4 por compra/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Platea")).toBeDisabled();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Rezagados")).toBeDisabled();
    expect(screen.getByText("Venta cerrada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  });

  it("clamps quantities to the order limit and the remaining stock", async () => {
    const user = userEvent.setup();
    render(<TicketCheckout eventId="evento" options={options} />);
    await user.clear(screen.getByLabelText("Cantidad de General")); await user.type(screen.getByLabelText("Cantidad de General"), "9");
    expect(screen.getByLabelText("Cantidad de General")).toHaveValue(4);
    await user.clear(screen.getByLabelText("Cantidad de VIP")); await user.type(screen.getByLabelText("Cantidad de VIP"), "5");
    expect(screen.getByLabelText("Cantidad de VIP")).toHaveValue(2);
  });

  it("continues without creating an order and requires buyer details and consent before reserving", async () => {
    const user = userEvent.setup();
    const fetchMock = reply(201, created);
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Datos y pago")).toHaveAttribute("aria-current", "step");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Reservar entradas" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Volver a entradas" }));
    expect(screen.getByLabelText("Cantidad de General")).toHaveValue(2);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@example.com");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Reservar entradas" })).toBeEnabled();
  });

  it("sends server-priced ids, quantities, buyer and consent, then shows the reservation and inline payment", async () => {
    const user = userEvent.setup();
    const fetchMock = reply(201, created);
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    expect(screen.getByText(/Total estimado: S\/\s?200\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reservar entradas" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout");
    expect(JSON.parse(init.body)).toEqual({ eventId: "evento", items: [{ ticketTypeId: "general", quantity: 2 }], buyer: { name: "Ana Pérez", email: "ana@example.com", documentType: "dni", documentNumber: "12345678", phone: "999123456" }, acceptedTerms: true, termsVersion: "2026-10-09" });
    expect(await screen.findByRole("heading", { name: "Resumen de tu pedido" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^(09:5\d|10:00)$/);
    expect(screen.getByText(/2 × General/)).toBeInTheDocument();
    expect(screen.getByText("Pagar dentro de Ticketera")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/pedidos\/11111111-1111-4111-8111-111111111111#t=guest-token$/ })).toBeInTheDocument();
  });

  it("keeps what the buyer typed and announces server errors and remaining stock (CA-15)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", reply(409, { error: "No hay cupo suficiente", code: "insufficient_inventory", details: [{ ticketTypeId: "general", available: 1 }] }));
    render(<TicketCheckout eventId="evento" options={options} />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reservar entradas" }));
    expect(await screen.findByText("No hay cupo suficiente")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Ana Pérez");
    expect(screen.getByRole("button", { name: "Reservar entradas" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Volver a entradas" }));
    expect(screen.getByText("Solo quedan 1 de General.")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de General")).toHaveValue(2);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Número de documento")).toHaveValue("12345678");
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

it("submits numbered seats with the confirmed private hold token", async () => {
  const user = userEvent.setup();
  const seat = { rowLabel: "A", seatNumber: 1 };
  const numbered = { ...base, id: "numbered", name: "Tribuna", zone: "Norte", seatingType: "numbered", capacity: 3, seatRows: [{ label: "A", seats: 3 }], priceCents: 1000, maxPerOrder: 2, available: 3 };
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/checkout") return new Response(JSON.stringify(created), { status: 201 });
    if (init?.method === "POST") return new Response(JSON.stringify({ holdToken: "private-seat-token", items: [{ ticketTypeId: "numbered", seats: [seat] }], expiresAt: new Date(Date.now() + 60_000).toISOString(), serverTime: new Date().toISOString() }));
    return new Response(JSON.stringify({ availability: [{ ticketTypeId: "numbered", occupied: [] }], own: null, serverTime: new Date().toISOString() }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TicketCheckout eventId="numbered-event" options={[numbered]} />);
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await user.click(await screen.findByLabelText("Fila A, asiento 1"));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("Asientos: A-1")).toBeInTheDocument();
  await fillBuyer(user);
  await user.click(await screen.findByRole("button", { name: "Reservar entradas" }));
  expect(await screen.findByRole("heading", { name: "Resumen de tu pedido" })).toBeInTheDocument();
  const checkoutRequest = fetchMock.mock.calls.find(([url]) => url === "/api/checkout");
  expect(JSON.parse(checkoutRequest![1].body as string)).toMatchObject({ seatHoldToken: "private-seat-token", items: [{ ticketTypeId: "numbered", quantity: 1, seats: [seat] }] });
});

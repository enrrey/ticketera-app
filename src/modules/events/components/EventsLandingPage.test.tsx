import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents } from "../services/eventsService";
import { EventsLandingPage } from "./EventsLandingPage";

async function renderPage() {
  const events = await getEvents();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><EventsLandingPage initialEvents={events} /></QueryClientProvider>);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("concert discovery", () => {
  it("combines accent-insensitive search, genre, city and month, and resets empty results", async () => {
    const user = userEvent.setup();
    await renderPage();
    const catalog = within(screen.getByTestId("events-grid-section"));
    await user.type(catalog.getByRole("searchbox"), "airbag");
    await user.click(catalog.getByRole("button", { name: "Rock" }));
    await user.selectOptions(catalog.getByRole("combobox", { name: "Ciudad" }), "Arequipa");
    await user.selectOptions(catalog.getByRole("combobox", { name: "Mes" }), "2026-11");
    expect(catalog.getAllByRole("article")).toHaveLength(1);
    expect(catalog.getByRole("heading", { name: /Airbag en Arequipa/ })).toBeInTheDocument();
    await user.selectOptions(catalog.getByRole("combobox", { name: "Mes" }), "2026-12");
    expect(catalog.getByText("No se encontraron eventos con esos filtros")).toBeInTheDocument();
    await user.click(catalog.getByRole("button", { name: "Limpiar filtros" }));
    expect(catalog.getAllByRole("article")).toHaveLength(14);
    await user.type(catalog.getByRole("searchbox"), "mana");
    expect(catalog.getAllByRole("article")).toHaveLength(1);
    expect(catalog.getByRole("heading", { name: /Maná/ })).toBeInTheDocument();
  }, 20_000);

  it("saves a concert from highlights and can remove it from the selection", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(within(screen.getByTestId("featured-events-section")).getByRole("button", { name: "Guardar Zayn" }));
    await user.click(screen.getByRole("button", { name: "Mi selección, 1 eventos" }));
    const catalog = within(screen.getByTestId("events-grid-section"));
    expect(catalog.getAllByRole("article")).toHaveLength(1);
    const link = catalog.getByRole("link", { name: /Ver entradas de Zayn/ });
    expect(link).toHaveAttribute("href", "https://teleticket.com.pe/zayn");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(catalog.getByRole("button", { name: "Quitar Zayn" }));
    expect(catalog.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Mi selección, 0 eventos" })).toBeInTheDocument();
  });

  it("lets visitors pause and resume the continuous hero motion", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Pausar animación del hero" }));
    expect(screen.getByRole("button", { name: "Reanudar animación del hero" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Reanudar animación del hero" }));
    expect(screen.getByRole("button", { name: "Pausar animación del hero" })).toHaveAttribute("aria-pressed", "false");
  });
});



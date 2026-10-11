import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TicketTypeMetricsTable } from "./TicketTypeMetricsTable";
import type { TicketTypeMetricsPage } from "../types";

const metrics: TicketTypeMetricsPage = { scope: "organizer", page: 1, pageSize: 50, hasNextPage: true, items: [{ eventId: "event", eventName: "Concierto", ticketTypeId: "type", ticketTypeName: "General", soldTickets: 2, paidSalesCents: 33235, capacity: 5, committedUnits: 4, availableUnits: 1, committedPercentage: 80, checkIns: 1 }] };

it("labels historical line sales and links to the next page without presenting net type income", () => {
  render(<TicketTypeMetricsTable metrics={metrics}/>);
  expect(screen.getByRole("columnheader", { name: "Ventas pagadas (histórico)" })).toBeInTheDocument();
  expect(screen.getByText(/incluidos pedidos parcial o totalmente reembolsados/)).toBeInTheDocument();
  expect(screen.getByText(/S\/\s?332\.35/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/organizador/metricas?page=2");
  expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
});

it("supports returning from empty pages without offering a next page", () => {
  render(<TicketTypeMetricsTable metrics={{ ...metrics, page: 3, items: [], hasNextPage: false }}/>);
  expect(screen.getByText("No hay tipos de entrada en esta página.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/organizador/metricas?page=2");
  expect(screen.queryByRole("link", { name: "Siguiente" })).not.toBeInTheDocument();
});

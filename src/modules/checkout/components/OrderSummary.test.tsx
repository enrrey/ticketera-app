import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderSummary } from "./OrderSummary";
import type { CheckoutSummary } from "../types";

const start = new Date("2026-10-05T12:00:00Z");
const summary = (overrides: Partial<CheckoutSummary> = {}): CheckoutSummary => ({
  orderId: "o1", status: "pending", totalCents: 20000, currency: "pen", expired: false,
  serverTime: start.toISOString(), expiresAt: new Date(start.getTime() + 90_000).toISOString(),
  items: [{ ticketTypeId: "t1", name: "General", quantity: 2, unitPriceCents: 10000, totalCents: 20000 }], ...overrides,
});

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => vi.useRealTimers());

describe("OrderSummary", () => {
  it("counts down to zero and then reports the reservation as expired (CA-16)", () => {
    render(<OrderSummary summary={summary()} />);
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
    expect(screen.getByRole("status")).toHaveTextContent("Reserva activa");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    act(() => { vi.advanceTimersByTime(31_000); });
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("La reserva venció");
    expect(screen.getByText(/Tu reserva venció/)).toBeInTheDocument();
  });

  it("follows the server clock even when the browser clock is wrong (CA-16)", () => {
    // The browser thinks it is an hour later than the server: the reservation must still show 90 s.
    vi.setSystemTime(new Date(start.getTime() + 3_600_000));
    render(<OrderSummary summary={summary()} />);
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
  });

  it("renders an already expired order as expired immediately", () => {
    render(<OrderSummary summary={summary({ expired: true, expiresAt: new Date(start.getTime() - 1000).toISOString() })} />);
    expect(screen.getByText(/Tu reserva venció/)).toBeInTheDocument();
  });

  it("shows line items, the PEN total and the missing-payment notice without any pay action (CA-17)", () => {
    render(<OrderSummary summary={summary()} />);
    expect(screen.getByText("2 × General")).toBeInTheDocument();
    expect(screen.getAllByText(/S\/\s?200\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/no se ha cobrado nada/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

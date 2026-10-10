import { describe, expect, it } from "vitest";
import { refundWindowMs, ticketRefundAmount, withinRefundWindow } from "./refundPolicy";
describe("refund policy", () => {
  it("splits discounted totals into exact cents by ticket unit", () => {
    expect([1, 2, 3].map((unit) => ticketRefundAmount(10001, 3, unit))).toEqual([3334, 3334, 3333]);
    expect(ticketRefundAmount(0, 3, 1)).toBe(0);
    expect(() => ticketRefundAmount(100, 3, 4)).toThrow();
  });
  it("allows the exact 48 hour cutoff but rejects one millisecond later", () => {
    const start = new Date("2026-11-10T20:00:00Z");
    expect(withinRefundWindow(start, new Date(start.getTime() - refundWindowMs))).toBe(true);
    expect(withinRefundWindow(start, new Date(start.getTime() - refundWindowMs + 1))).toBe(false);
    expect(withinRefundWindow(new Date("invalid"))).toBe(false);
  });
});

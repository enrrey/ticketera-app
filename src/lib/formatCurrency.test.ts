import { describe, expect, it } from "vitest";

import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formats a whole amount with two decimals and a currency indicator", () => {
    const result = formatCurrency(45, "USD");
    expect(result).toContain("45,00");
    expect(result).toMatch(/\$/);
  });

  it("formats an amount that already has decimals", () => {
    const result = formatCurrency(99.9, "USD");
    expect(result).toContain("99,90");
  });

  it("returns a fallback message for a non-finite amount", () => {
    expect(formatCurrency(NaN)).toBe("Precio no disponible");
    expect(formatCurrency(Infinity)).toBe("Precio no disponible");
  });
});

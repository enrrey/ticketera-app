import { describe, expect, it } from "vitest";

import { formatEventDate, getEventDateParts } from "./formatEventDate";

describe("formatEventDate", () => {
  it("formats a valid ISO date into a readable Spanish date", () => {
    expect(formatEventDate("2026-12-24T12:00:00.000Z")).toBe(
      "24 de diciembre de 2026"
    );
  });

  it("returns a fallback message for an invalid date string", () => {
    expect(formatEventDate("not-a-date")).toBe("Fecha no disponible");
  });

  it("returns a fallback message for an empty string", () => {
    expect(formatEventDate("")).toBe("Fecha no disponible");
  });
});

describe("getEventDateParts", () => {
  it("returns the UTC day and an uppercase short Spanish month", () => {
    expect(getEventDateParts("2026-12-24T12:00:00.000Z")).toEqual({
      day: "24",
      month: "DIC",
    });
  });

  it("uses UTC so late-night events do not shift to the next day", () => {
    expect(getEventDateParts("2026-03-01T02:00:00.000Z")).toEqual({
      day: "1",
      month: "MAR",
    });
  });

  it("accepts a plain YYYY-MM-DD calendar day", () => {
    expect(getEventDateParts("2026-10-14")).toEqual({ day: "14", month: "OCT" });
  });

  it("returns null for an invalid date", () => {
    expect(getEventDateParts("not-a-date")).toBeNull();
  });
});

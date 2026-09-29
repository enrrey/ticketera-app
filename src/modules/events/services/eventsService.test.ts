import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getEvents } from "./eventsService";

describe("official concert catalog", () => {
  it("has unique, sourced Peruvian events and local artwork", async () => {
    const events = await getEvents();
    expect(events.length).toBeGreaterThanOrEqual(10);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    for (const event of events) {
      expect(["Lima", "Arequipa"]).toContain(event.city);
      expect(event.currency).toBe("PEN");
      expect(event.price).toBeNull();
      expect(new URL(event.ticketUrl!).hostname).toBe("teleticket.com.pe");
      expect(event.verifiedAt).toBe("2026-09-28");
      expect(existsSync(resolve("public", event.imageUrl.slice(1)))).toBe(true);
      expect(event.date >= "2026-10-01" && event.date < "2027-01-01").toBe(true);
    }
    expect(events.filter((event) => event.featured).length).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from "vitest";

import type { Event } from "../types";
import { filterEvents, getPriceBounds, sortEventsByDate } from "./useEventFilters";

const events: Event[] = [
  {
    id: "1",
    title: "Rock Legends Live",
    category: "concert",
    date: "2026-10-01T20:00:00.000Z",
    venue: "Arena Norte",
    city: "Lima",
    price: 150,
    currency: "PEN",
    imageUrl: "https://images.unsplash.com/photo-1",
    featured: true,
  },
  {
    id: "2",
    title: "Classical Symphony Night",
    category: "concert",
    date: "2026-10-05T20:00:00.000Z",
    venue: "Teatro Municipal",
    city: "Lima",
    price: 90,
    currency: "PEN",
    imageUrl: "https://images.unsplash.com/photo-2",
    featured: false,
  },
  {
    id: "3",
    title: "Modern Theater Showcase",
    category: "theater",
    date: "2026-11-01T20:00:00.000Z",
    venue: "Sala Cultural",
    city: "Arequipa",
    price: 60,
    currency: "PEN",
    imageUrl: "https://images.unsplash.com/photo-3",
    featured: false,
  },
];

describe("filterEvents", () => {
  it("filters by search query only (partial, case-insensitive)", () => {
    const result = filterEvents(events, { searchQuery: "rock", category: "all" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by category only when category is not 'all'", () => {
    const result = filterEvents(events, { searchQuery: "", category: "concert" });

    expect(result).toHaveLength(2);
    expect(result.map((event) => event.id)).toEqual(["1", "2"]);
  });

  it("does not filter by category when category is 'all'", () => {
    const result = filterEvents(events, { searchQuery: "", category: "all" });

    expect(result).toHaveLength(events.length);
  });

  it("combines search and category with AND, not OR", () => {
    const result = filterEvents(events, {
      searchQuery: "symphony",
      category: "concert",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");

    const crossCategoryMismatch = filterEvents(events, {
      searchQuery: "symphony",
      category: "theater",
    });

    expect(crossCategoryMismatch).toHaveLength(0);
  });

  it("returns an empty array when no event matches", () => {
    const result = filterEvents(events, {
      searchQuery: "nonexistent event",
      category: "all",
    });

    expect(result).toHaveLength(0);
  });

  describe("dateRange", () => {
    it("does not restrict by date when dateRange is absent", () => {
      const result = filterEvents(events, { searchQuery: "", category: "all" });

      expect(result).toHaveLength(events.length);
    });

    it("filters by 'from' only, leaving the upper bound unrestricted", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        dateRange: { from: "2026-10-05", to: null },
      });

      expect(result.map((event) => event.id)).toEqual(["2", "3"]);
    });

    it("filters by 'to' only, leaving the lower bound unrestricted", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        dateRange: { from: null, to: "2026-10-05" },
      });

      expect(result.map((event) => event.id)).toEqual(["1", "2"]);
    });

    it("filters by both 'from' and 'to' together", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        dateRange: { from: "2026-10-02", to: "2026-10-31" },
      });

      expect(result.map((event) => event.id)).toEqual(["2"]);
    });

    it("includes an event whose calendar day lands exactly on the 'from'/'to' boundary", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        dateRange: { from: "2026-10-05", to: "2026-10-05" },
      });

      expect(result.map((event) => event.id)).toEqual(["2"]);
    });
  });

  describe("priceRange", () => {
    it("does not restrict by price when priceRange is absent", () => {
      const result = filterEvents(events, { searchQuery: "", category: "all" });

      expect(result).toHaveLength(events.length);
    });

    it("filters by 'min' only, leaving the upper bound unrestricted", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        priceRange: { min: 90, max: null },
      });

      expect(result.map((event) => event.id)).toEqual(["1", "2"]);
    });

    it("filters by 'max' only, leaving the lower bound unrestricted", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        priceRange: { min: null, max: 90 },
      });

      expect(result.map((event) => event.id)).toEqual(["2", "3"]);
    });

    it("includes an event whose price is exactly on the 'min'/'max' boundary", () => {
      const result = filterEvents(events, {
        searchQuery: "",
        category: "all",
        priceRange: { min: 90, max: 90 },
      });

      expect(result.map((event) => event.id)).toEqual(["2"]);
    });
  });

  it("combines search, category, dateRange and priceRange with AND", () => {
    const result = filterEvents(events, {
      searchQuery: "rock",
      category: "concert",
      dateRange: { from: "2026-10-01", to: "2026-10-31" },
      priceRange: { min: 100, max: 200 },
    });

    expect(result.map((event) => event.id)).toEqual(["1"]);

    const priceExcludesEverything = filterEvents(events, {
      searchQuery: "rock",
      category: "concert",
      dateRange: { from: "2026-10-01", to: "2026-10-31" },
      priceRange: { min: 200, max: null },
    });

    expect(priceExcludesEverything).toHaveLength(0);
  });
});

describe("getPriceBounds", () => {
  it("returns the min and max price across events", () => {
    expect(getPriceBounds(events)).toEqual({ min: 60, max: 150 });
  });

  it("returns { min: 0, max: 0 } for an empty array", () => {
    expect(getPriceBounds([])).toEqual({ min: 0, max: 0 });
  });
});

describe("sortEventsByDate", () => {
  const base = {
    category: "concert",
    venue: "Venue",
    city: "Lima",
    price: 10,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1",
    featured: false,
  } as const;

  const late = { ...base, id: "late", title: "Late", date: "2027-01-10T20:00:00.000Z" };
  const early = { ...base, id: "early", title: "Early", date: "2026-10-05T20:00:00.000Z" };
  const middle = { ...base, id: "middle", title: "Middle", date: "2026-12-01T09:00:00.000Z" };

  it("orders events by date ascending", () => {
    const sorted = sortEventsByDate([late, early, middle]);

    expect(sorted.map((event) => event.id)).toEqual(["early", "middle", "late"]);
  });

  it("does not mutate the input array", () => {
    const input = [late, early, middle];

    sortEventsByDate(input);

    expect(input.map((event) => event.id)).toEqual(["late", "early", "middle"]);
  });
});

// Unknown prices must never be treated as free tickets.
describe("unknown prices", () => {
  it("keeps unknown prices without a budget, but excludes them when a budget is requested", () => {
    const unknown = [{ ...events[0], price: null }];
    expect(filterEvents(unknown, { searchQuery: "", category: "all" })).toHaveLength(1);
    expect(filterEvents(unknown, { searchQuery: "", category: "all", priceRange: { min: null, max: 100 } })).toHaveLength(0);
    expect(getPriceBounds(unknown)).toEqual({ min: 0, max: 0 });
  });
});

import { useMemo } from "react";

import type { Event, EventCategory } from "../types";

/** Inclusive calendar-day range filter, dates in `YYYY-MM-DD` format (no time). */
export interface DateRangeFilter {
  from: string | null;
  to: string | null;
}

/** Inclusive price range filter. */
export interface PriceRangeFilter {
  min: number | null;
  max: number | null;
}

export interface EventFilters {
  searchQuery: string;
  category: EventCategory | "all";
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
  city?: string;
  genre?: string;
  month?: string;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Extracts the `YYYY-MM-DD` calendar day out of an ISO 8601 date-time string. */
function toCalendarDay(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

/**
 * Pure filtering logic for events: partial, case-insensitive match on
 * `title`, exact `category` match, inclusive calendar-day `dateRange` and
 * inclusive `priceRange`, all combined using AND semantics. When a
 * `dateRange`/`priceRange` bound is `null` or the filter itself is absent,
 * that dimension is left unrestricted. Kept free of React Query / network
 * concerns so it is trivially testable.
 */
export function filterEvents(events: Event[], filters: EventFilters): Event[] {
  const normalizedQuery = normalize(filters.searchQuery.trim());
  const { dateRange, priceRange } = filters;

  return events.filter((event) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      normalize([event.title, event.tour, event.venue, event.city].join(" ")).includes(normalizedQuery);

    const matchesCategory =
      filters.category === "all" || event.category === filters.category;

    const eventDay = toCalendarDay(event.date);
    const matchesDateFrom = !dateRange?.from || eventDay >= dateRange.from;
    const matchesDateTo = !dateRange?.to || eventDay <= dateRange.to;

    const matchesPriceMin =
      priceRange?.min == null || (event.price != null && event.price >= priceRange.min);
    const matchesPriceMax =
      priceRange?.max == null || (event.price != null && event.price <= priceRange.max);

    return (
      matchesSearch &&
      (!filters.city || event.city === filters.city) &&
      (!filters.genre || event.genre === filters.genre) &&
      (!filters.month || event.date.startsWith(filters.month)) &&
      matchesCategory &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesPriceMin &&
      matchesPriceMax
    );
  });
}

/**
 * Computes the min/max `price` across `events`. Returns `{ min: 0, max: 0 }`
 * for an empty array instead of throwing.
 */
export function getPriceBounds(events: Event[]): { min: number; max: number } {
  if (events.length === 0) {
    return { min: 0, max: 0 };
  }

  const prices = events.flatMap((event) => event.price == null ? [] : [event.price]);
  if (prices.length === 0) return { min: 0, max: 0 };

  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Returns a copy of `events` ordered by `date` ascending (soonest first).
 * ISO 8601 UTC strings sort correctly as plain strings. Never mutates the
 * input, so it is safe to call on memoized arrays.
 */
export function sortEventsByDate(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Memoized wrapper around `filterEvents` for use inside React components.
 */
export function useEventFilters(events: Event[], filters: EventFilters): Event[] {
  const { searchQuery, category, dateRange, priceRange, city, genre, month } = filters;

  return useMemo(
    () => filterEvents(events, { searchQuery, category, dateRange, priceRange, city, genre, month }),
    [events, searchQuery, category, dateRange, priceRange, city, genre, month],
  );
}

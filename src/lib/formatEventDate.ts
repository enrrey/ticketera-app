const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "UTC",
});

/**
 * Formats an ISO 8601 date-time string into a human-readable Spanish date
 * (e.g. "24 de diciembre de 2026"). Returns a fallback message for any
 * input that does not parse into a valid date instead of throwing or
 * rendering "Invalid Date".
 */
export function formatEventDate(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return DATE_FORMATTER.format(date);
}

/**
 * Splits a date into the pieces shown in a calendar-style date badge
 * (e.g. `{ day: "14", month: "MAR" }`). Returns `null` for invalid input
 * so callers can simply omit the badge.
 */
export function getEventDateParts(
  isoDate: string
): { day: string; month: string } | null {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: DAY_FORMATTER.format(date),
    month: MONTH_FORMATTER.format(date).replace(".", "").toUpperCase(),
  };
}

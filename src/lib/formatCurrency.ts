const DEFAULT_LOCALE = "es-ES";

/**
 * Formats a numeric amount as currency (e.g. "45,00 US$"). Falls back to a
 * plain message for non-finite input instead of throwing or rendering
 * "NaN"/"Infinity".
 */
export function formatCurrency(amount: number, currency = "USD", locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(amount)) {
    return "Precio no disponible";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

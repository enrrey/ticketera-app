export const refundReasons = ["customer_request", "event_cancelled"] as const;
export const refundWindowMs = 48 * 60 * 60 * 1000;
export const maxRefundAttempts = 5;
export function ticketRefundAmount(totalCents: number, quantity: number, unitNumber: number) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unitNumber) || unitNumber < 1 || unitNumber > quantity) throw new Error("Invalid ticket allocation");
  return Math.floor(totalCents / quantity) + (unitNumber <= totalCents % quantity ? 1 : 0);
}
export function withinRefundWindow(startsAt: Date, now = new Date()) { return Number.isFinite(startsAt.getTime()) && startsAt.getTime() - now.getTime() >= refundWindowMs; }

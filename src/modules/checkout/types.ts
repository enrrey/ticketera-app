export type CheckoutSummaryItem = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type CheckoutSummary = {
  orderId: string;
  status: string;
  totalCents: number;
  currency: string;
  /** ISO timestamp when the 15-minute reservation ends. */
  expiresAt: string;
  /** Server clock at read time, so the countdown does not depend on the browser clock. */
  serverTime: string;
  expired: boolean;
  items: CheckoutSummaryItem[];
};

/** Returned once, only for guest orders. */
export type CreatedCheckout = CheckoutSummary & { accessToken?: string };

export type CheckoutTicketOption = {
  id: string;
  name: string;
  zone: string;
  description: string;
  priceCents: number;
  maxPerOrder: number;
  available: number;
  salesStartAt: string;
  salesEndAt: string;
};

export type CheckoutErrorBody = {
  error: string;
  code?: string;
  details?: { ticketTypeId: string; available: number }[];
};

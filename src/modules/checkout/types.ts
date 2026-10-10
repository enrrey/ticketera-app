export type SelectedSeat = { rowLabel: string; seatNumber: number };

export type CheckoutSummaryItem = {
  seats?: SelectedSeat[];
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
  /** New reservations last ten minutes; legacy expiry timestamps are preserved. */
  expiresAt: string;
  /** Server clock at read time, so the countdown does not depend on the browser clock. */
  serverTime: string;
  expired: boolean;
  items: CheckoutSummaryItem[];
  latePayment?: boolean;
  refundStatus?: string;
  refundReason?: string;
  invoice?: { hostedUrl: string | null; pdfUrl: string | null };
};

/** Returned once, only for guest orders. */
export type CreatedCheckout = CheckoutSummary & { accessToken?: string };

export type CheckoutTicketOption = {
  mapPosition?: 'north'|'south'|'east'|'west'|'center';
  capacity?: number;
  seatingType?: string;
  seatRows?: { label: string; seats: number }[];
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

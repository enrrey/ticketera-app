import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type PaymentDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
export type CanonicalEvent = { id: string; type: string; objectId: string; livemode: boolean; paymentId?: string; refundId?:string; paidAt?: Date };
export type CanonicalSession = {
  id: string; paymentId: string; orderId: string; livemode: boolean; status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required"; amountCents: number; currency: string; url: string | null;
  intentStatus: string | null; customerId?: string; invoiceId?: string; clientSecret?: string;
  intent?: { id: string; chargeId: string; amountCents: number; currency: string; paidAt: Date };
};
export type SessionInput = { paymentId: string; orderId: string; idempotencyKey: string; amountCents: number; currency: string; buyerEmail: string; appUrl: string; uiMode?: 'hosted'|'elements' };
export type CanonicalInvoice = { id: string; paymentId: string; orderId: string; customerId: string; livemode: boolean; status: "draft" | "open" | "paid" | "uncollectible" | "void"; amountCents: number; currency: string; hostedUrl: string | null; pdfUrl: string | null };
export type PaymentGateway = {
  livemode: boolean;
  createSession(input: SessionInput): Promise<CanonicalSession>;
  readSession(id: string, event?: CanonicalEvent): Promise<CanonicalSession>;
  expireSession(id: string): Promise<CanonicalSession>;
  readEvent(id: string): Promise<CanonicalEvent>;
  refund(intentId: string, amountCents: number, idempotencyKey: string, existingId?: string | null): Promise<{ id: string; status: string; amountCents: number }>;
  readInvoice(id: string): Promise<CanonicalInvoice>;
};
export type PaymentDependencies = { database: PaymentDatabase; gateway: PaymentGateway; fulfill?: (database: PaymentDatabase, orderId: string) => Promise<void> };

export class PaymentError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export class ReconciliationError extends Error {}

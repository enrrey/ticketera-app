import { z } from "zod";

export const MAX_CHECKOUT_LINES = 10;

const lineSchema = z.object({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
  seats: z.array(z.object({ rowLabel: z.string().trim().min(1).max(20), seatNumber: z.number().int().min(1).max(500) }).strict()).max(1000).optional(),
}).strict();

export const checkoutSchema = z.object({
  // Public event identifier (slug), as exposed by the event listings.
  eventId: z.string().trim().min(1).max(200),
  seatHoldToken:z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/).optional(),
  items: z.array(lineSchema).min(1).max(MAX_CHECKOUT_LINES)
    .refine((items) => new Set(items.map((item) => item.ticketTypeId)).size === items.length, "Duplicate ticket type"),
  buyer: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    name: z.string().trim().min(1).max(100),
    documentType: z.enum(['dni', 'ce', 'passport']).optional(),
    documentNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,20}$/).optional(),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional(),
  }).strict(),
  termsVersion: z.literal('2026-10-09').optional(),
  acceptedTerms: z.literal(true).optional(),
}).strict();

// Legacy internal fixtures/orders remain readable; all NEW public purchases require consent and identity.
export const publicCheckoutSchema = checkoutSchema.superRefine((input, context) => {
  if (!input.buyer.documentType || !input.buyer.documentNumber || !input.buyer.phone || !input.acceptedTerms || !input.termsVersion) {
    context.addIssue({code:'custom',message:'Completa tus datos y acepta los términos',path:['buyer']});
  }
  if (input.buyer.documentType === 'dni' && !/^\d{8}$/.test(input.buyer.documentNumber ?? '')) {
    context.addIssue({code:'custom',message:'El DNI debe tener ocho dígitos',path:['buyer','documentNumber']});
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

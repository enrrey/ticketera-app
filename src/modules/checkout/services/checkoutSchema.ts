import { z } from "zod";

export const MAX_CHECKOUT_LINES = 10;

const lineSchema = z.object({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
}).strict();

export const checkoutSchema = z.object({
  // Public event identifier (slug), as exposed by the event listings.
  eventId: z.string().trim().min(1).max(200),
  items: z.array(lineSchema).min(1).max(MAX_CHECKOUT_LINES)
    .refine((items) => new Set(items.map((item) => item.ticketTypeId)).size === items.length, "Duplicate ticket type"),
  buyer: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    name: z.string().trim().min(1).max(100),
  }).strict(),
}).strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;

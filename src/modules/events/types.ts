import type { TicketTypeInput } from "./eventManagement.types";
export type PublicTicketOption=Omit<TicketTypeInput,"sessionIndexes">&{id:string;sessionDates:string[]};
export type EventCategory =
  | "concert"
  | "theater"
  | "sports"
  | "festival"
  | "conference"
  | "exhibition"
  | "family"
  | "comedy"
  | "cinema";

export interface Event {
  id: string;
  title: string;
  category: EventCategory;
  /** ISO 8601 date-time string. */
  date: string;
  venue: string;
  city: string;
  price: number | null;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  imageUrl: string;
  featured: boolean;
  genre?: string;
  tour?: string;
  ticketUrl?: string;
  heroImageUrl?: string;
  endDate?: string;
  verifiedAt?: string;
  status?: string;
  ticketsIssued?: number;
  netRevenueCents?: number;
  ticketOptions?:PublicTicketOption[];
  minimumAge?:number;
  entryInstructions?:string;
  description?:string;
}

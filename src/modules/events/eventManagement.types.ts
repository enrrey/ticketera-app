export type EventSessionInput = { startsAt: string; endsAt: string };
export type TicketTypeInput = {
  id?: string; name: string; zone: string; seatingType: "standing" | "seated" | "numbered" | "box";
  description: string; priceCents: number; capacity: number; maxPerOrder: number; peoplePerUnit: number;
  salesStartAt: string; salesEndAt: string; sessionIndexes: number[];
  seatRows: { label: string; seats: number }[];
};
export type EventInput = {
  name: string; category: string; description: string; imageUrl: string;
  venueName: string; address: string; city: string; sessions: EventSessionInput[];
  status: "draft" | "published" | "cancelled";
  minimumAge?: number; entryInstructions?: string; ticketTypes?: TicketTypeInput[]; featured?: boolean;
};
export type ManagedEvent = EventInput & { id: string; slug: string; organizerId: string; hasOrders: boolean };

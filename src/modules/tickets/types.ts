export type IssuedTicket = {
  id: string; unitNumber: number; status: string; eventName: string; zone: string;
  ticketTypeName: string; venue: string; date: string | null;
  seat: { row: string; number: number } | null; qrImage: string | null;
};
export type TicketPage = { tickets: IssuedTicket[]; total: number; page: number; pageSize: number };
export type OwnTicket = IssuedTicket & { orderId: string; sessions: { id: string; startsAt: string }[] };
export type OwnTicketPage = Omit<TicketPage, 'tickets'> & { tickets: OwnTicket[] };

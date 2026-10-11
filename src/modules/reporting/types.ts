export type DashboardMetrics = {
  scope: "global" | "organizer";
  soldTickets: number;
  grossSalesCents: number;
  capturedCents: number;
  confirmedRefundCents: number;
  netCapturedCents: number;
  checkIns: number;
  events: { draft: number; published: number; cancelled: number; completed: number };
};

export type TicketTypeMetrics = {
  eventId: string; eventName: string; ticketTypeId: string; ticketTypeName: string;
  soldTickets: number; paidSalesCents: number; capacity: number;
  committedUnits: number; availableUnits: number; committedPercentage: number; checkIns: number;
};
export type TicketTypeMetricsPage = {
  scope: "global" | "organizer"; page: number; pageSize: 50; hasNextPage: boolean; items: TicketTypeMetrics[];
};

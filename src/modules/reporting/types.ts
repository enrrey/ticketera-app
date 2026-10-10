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

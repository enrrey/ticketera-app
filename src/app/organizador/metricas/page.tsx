import { requirePagePermission } from "@/modules/identity-access";
import { ReportingDashboard, TicketTypeMetricsTable } from "@/modules/reporting";
import { getDashboardMetrics, getTicketTypeMetrics } from "@/modules/reporting/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const actor = await requirePagePermission("events.manage", "/organizador/metricas");
  const query = await searchParams;
  const requested = typeof query.page === "string" && /^\d+$/.test(query.page) ? Number(query.page) : 1;
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= 1_000_000 ? requested : 1;
  const [dashboard, ticketTypes] = await Promise.all([getDashboardMetrics(actor.id), getTicketTypeMetrics(actor.id, page)]);
  return <><ReportingDashboard metrics={dashboard}/><TicketTypeMetricsTable metrics={ticketTypes}/></>;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatCurrency";
import type { DashboardMetrics } from "../types";

export function ReportingDashboard({ metrics }: { metrics: DashboardMetrics }) {
  const money = (cents: number) => formatCurrency(cents / 100, "PEN", "es-PE");
  const cards = [
    ["Entradas vendidas", metrics.soldTickets.toLocaleString("es-PE"), "Unidades válidas o usadas de pedidos pagados."],
    ["Ventas brutas", money(metrics.grossSalesCents), "Antes de descuentos y reembolsos; incluye ventas reembolsadas."],
    ["Ingresos capturados", money(metrics.capturedCents), "Pagos confirmados, incluidos los posteriormente reembolsados."],
    ["Reembolsos confirmados", money(metrics.confirmedRefundCents), "Solo reembolsos confirmados por el proveedor."],
    ["Ingresos netos", money(metrics.netCapturedCents), "Capturado menos reembolsos confirmados; antes de comisiones."],
    ["Check-in", metrics.checkIns.toLocaleString("es-PE"), "Entradas registradas al ingresar al evento."],
  ];
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
    <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-muted-foreground">{metrics.scope === "global" ? "Métricas globales de Ticketera" : "Métricas de tus eventos"} · Acumulado histórico</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, value, detail]) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p><p className="mt-2 text-sm text-muted-foreground">{detail}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Eventos por estado</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-4">{[["Borradores", metrics.events.draft], ["Publicados", metrics.events.published], ["Cancelados", metrics.events.cancelled], ["Finalizados", metrics.events.completed]].map(([label, count]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold">{count}</dd></div>)}</dl></CardContent></Card>
  </main>;
}

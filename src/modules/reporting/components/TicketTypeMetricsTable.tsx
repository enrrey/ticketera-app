import Link from "next/link";
import { formatCurrency } from "@/lib/formatCurrency";
import type { TicketTypeMetricsPage } from "../types";

export function TicketTypeMetricsTable({ metrics }: { metrics: TicketTypeMetricsPage }) {
  return <section aria-labelledby="ticket-type-metrics-title" className="mx-auto max-w-6xl space-y-4 px-4 pb-10">
    <h2 id="ticket-type-metrics-title" className="text-2xl font-semibold">Desglose por evento y tipo de entrada</h2>
    <p className="text-sm text-muted-foreground">Ventas pagadas: importe histórico de las líneas del pedido después de descuentos, incluidos pedidos parcial o totalmente reembolsados. No descuenta reembolsos ni comisiones. Cupo comprometido: reservas y unidades convertidas que siguen ocupando inventario.</p>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[850px] text-sm">
      <caption className="sr-only">Métricas {metrics.scope === "global" ? "globales" : "de tus eventos"}, página {metrics.page}</caption>
      <thead className="bg-muted"><tr>{["Evento", "Tipo de entrada", "Vendidas vigentes", "Ventas pagadas (histórico)", "Capacidad", "Comprometido", "Disponible", "% comprometido", "Check-in"].map(label => <th key={label} scope="col" className="p-3 text-left font-semibold">{label}</th>)}</tr></thead>
      <tbody>{metrics.items.map(item => <tr key={item.ticketTypeId} className="border-t">
        <td className="p-3">{item.eventName}</td><th scope="row" className="p-3 text-left font-medium">{item.ticketTypeName}</th>
        <td className="p-3 tabular-nums">{item.soldTickets}</td><td className="whitespace-nowrap p-3 tabular-nums">{formatCurrency(item.paidSalesCents / 100, "PEN", "es-PE")}</td>
        <td className="p-3 tabular-nums">{item.capacity}</td><td className="p-3 tabular-nums">{item.committedUnits}</td><td className="p-3 tabular-nums">{item.availableUnits}</td><td className="p-3 tabular-nums">{item.committedPercentage.toLocaleString("es-PE", { maximumFractionDigits: 2 })}%</td><td className="p-3 tabular-nums">{item.checkIns}</td>
      </tr>)}{metrics.items.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No hay tipos de entrada en esta página.</td></tr>}</tbody>
    </table></div>
    <nav aria-label="Paginación de métricas" className="flex items-center justify-between gap-4 text-sm">
      {metrics.page > 1 ? <Link className="rounded-lg border px-4 py-2 hover:bg-muted" href={`/organizador/metricas?page=${metrics.page - 1}`}>Anterior</Link> : <span/>}
      <span>Página {metrics.page} · Hasta 50 tipos por página</span>
      {metrics.hasNextPage ? <Link className="rounded-lg border px-4 py-2 hover:bg-muted" href={`/organizador/metricas?page=${metrics.page + 1}`}>Siguiente</Link> : <span/>}
    </nav>
  </section>;
}

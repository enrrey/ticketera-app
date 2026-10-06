"use client";

import { formatCurrency } from "@/lib/formatCurrency";
import { useCountdown } from "../hooks/useCountdown";
import type { CheckoutSummary } from "../types";

const money = (cents: number, currency: string) => formatCurrency(cents / 100, currency.toUpperCase(), "es-PE");
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function OrderSummary({ summary, orderLink }: { summary: CheckoutSummary; orderLink?: string }) {
  const seconds = useCountdown(summary.expiresAt, summary.serverTime);
  const expired = summary.expired || seconds === 0;

  return (
    <section aria-labelledby="order-summary-title" className="grid gap-4 rounded-xl border p-5">
      <h2 id="order-summary-title" className="text-xl font-semibold">Resumen de tu pedido</h2>
      <p role="status" className="sr-only">{expired ? "La reserva venció" : "Reserva activa"}</p>
      {expired
        ? <p className="rounded-lg bg-muted p-3 font-medium">Tu reserva venció y las entradas volvieron a estar disponibles. Vuelve a elegirlas para reservar de nuevo.</p>
        : <p className="rounded-lg bg-muted p-3">Cupo reservado por <strong role="timer" aria-live="off" aria-label="Tiempo restante de la reserva">{clock(seconds)}</strong></p>}
      <ul className="grid gap-2">
        {summary.items.map((item) => (
          <li key={item.ticketTypeId} className="flex justify-between gap-4">
            <span>{item.quantity} × {item.name}</span>
            <span>{money(item.totalCents, summary.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span>{money(summary.totalCents, summary.currency)}</span></p>
      <p className="text-sm">El pago aún no está disponible: no se ha cobrado nada ni se han emitido entradas. Tu cupo queda reservado hasta que termine el tiempo.</p>
      {orderLink && <p className="text-sm">Guarda este enlace para volver a tu pedido: <a className="break-all underline" href={orderLink}>{orderLink}</a></p>}
    </section>
  );
}

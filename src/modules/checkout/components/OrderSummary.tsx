"use client";

import { formatCurrency } from "@/lib/formatCurrency";
import { InlinePayment } from "@/modules/payments";
import { OrderTickets } from "@/modules/tickets";
import { useCountdown } from "../hooks/useCountdown";
import type { CheckoutSummary } from "../types";
import {CheckoutProgress} from './CheckoutProgress';

const money = (cents: number, currency: string) => formatCurrency(cents / 100, currency.toUpperCase(), "es-PE");
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function OrderSummary({ summary, orderLink, accessToken }: { summary: CheckoutSummary; orderLink?: string; accessToken?: string }) {
  const seconds = useCountdown(summary.expiresAt, summary.serverTime);
  const expired = summary.expired || seconds === 0;
  const pending = summary.status === "pending";
  const hasTickets=summary.status==='paid'||summary.status==='partially_refunded';
  const refundMessage=['failed','requires_action','cancelled'].includes(summary.refundStatus??'')?'La devolución requiere revisión. No vuelvas a pagar este pedido.':summary.refundReason==='event_cancelled_before_payment'?(summary.refundStatus==='succeeded'?'El evento fue cancelado y tu pago fue reembolsado.':'El evento fue cancelado. Estamos procesando la devolución de tu pago.'):summary.refundReason==='inventory_unavailable'?(summary.refundStatus==='succeeded'?'No pudimos confirmar el inventario y tu pago fue reembolsado.':'No pudimos confirmar el inventario. Estamos procesando la devolución de tu pago.'):summary.refundStatus==='succeeded'?'El pago llegó fuera de plazo y fue reembolsado.':'El pago llegó fuera de plazo y será reembolsado. Estamos verificando la devolución.';

  return (
    <section aria-labelledby="order-summary-title" className="grid gap-4 rounded-xl border p-5">
      <CheckoutProgress currentStep={summary.status==='paid'||summary.status==='partially_refunded'?3:2}/>
      <h2 id="order-summary-title" className="text-xl font-semibold">Resumen de tu pedido</h2>
      <p role="status" className="sr-only">{pending ? expired ? "La reserva venció" : "Reserva activa" : summary.status === "paid" ? "Pago confirmado" : "Pedido cerrado"}</p>
      {pending && (expired
        ? <p className="rounded-lg bg-muted p-3 font-medium">Tu reserva venció. Estamos cerrando cualquier pago abierto antes de liberar el cupo. Vuelve al catálogo para reservar de nuevo.</p>
        : <p className="rounded-lg bg-muted p-3">Cupo reservado por <strong role="timer" aria-live="off" aria-label="Tiempo restante de la reserva">{clock(seconds)}</strong></p>)}
      {summary.status === "paid" && <p className="rounded-lg bg-muted p-3 font-medium">Pago confirmado. Tu pedido está pagado.</p>}
      {hasTickets && <OrderTickets orderId={summary.orderId} token={accessToken}/>}
      {summary.status==='partially_refunded'&&<p>Tu pedido tiene una devolución parcial. Las entradas restantes conservan su QR.</p>}
      {summary.status==='refunded'&&<p>Este pedido fue reembolsado.</p>}
      {summary.latePayment && <p className="rounded-lg bg-muted p-3 font-medium">{refundMessage}</p>}
      {!pending && !hasTickets && summary.status!=='refunded' && !summary.latePayment && <p>Este pedido está cerrado. Vuelve al catálogo para elegir entradas.</p>}
      <ul className="grid gap-2">
        {summary.items.map((item) => (
          <li key={item.ticketTypeId} className="flex justify-between gap-4">
            <span>{item.quantity} × {item.name}{item.seats?.length ? <span className="block text-sm">Asientos: {item.seats.map((seat) => `${seat.rowLabel}-${seat.seatNumber}`).join(", ")}</span> : null}</span>
            <span>{money(item.totalCents, summary.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span>{money(summary.totalCents, summary.currency)}</span></p>
      {pending && !expired && <><p className="text-sm">Completa el pago seguro antes de que termine la reserva.</p><InlinePayment orderId={summary.orderId} token={accessToken} disabled={expired}/></>}
      {summary.invoice?.hostedUrl && <a className="underline" href={summary.invoice.hostedUrl} target="_blank" rel="noopener noreferrer">Ver comprobante de Stripe</a>}
      {summary.invoice?.pdfUrl && <a className="underline" href={summary.invoice.pdfUrl} target="_blank" rel="noopener noreferrer">Descargar comprobante PDF</a>}
      {orderLink && <p className="text-sm">Guarda este enlace para volver a tu pedido: <a className="break-all underline" href={orderLink}>{orderLink}</a></p>}
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatCurrency";
import { useClientNow } from "../hooks/useClientNow";
import { submitCheckout } from "../services/checkoutClient";
import type { CheckoutErrorBody, CheckoutTicketOption, CreatedCheckout } from "../types";
import { OrderSummary } from "./OrderSummary";

const money = (cents: number) => formatCurrency(cents / 100, "PEN", "es-PE");

function saleState(option: CheckoutTicketOption, now: number | null) {
  if (option.available <= 0) return "Agotado";
  if (now !== null && now < Date.parse(option.salesStartAt)) return "Venta aún no abierta";
  if (now !== null && now >= Date.parse(option.salesEndAt)) return "Venta cerrada";
  return null;
}

export function TicketCheckout({ eventId, options }: { eventId: string; options: CheckoutTicketOption[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CheckoutErrorBody | null>(null);
  const [created, setCreated] = useState<CreatedCheckout | null>(null);
  const now = useClientNow(); // the server re-validates the sales window regardless

  const selected = options.filter((option) => (quantities[option.id] ?? 0) > 0);
  const total = selected.reduce((sum, option) => sum + option.priceCents * quantities[option.id], 0);

  function setQuantity(option: CheckoutTicketOption, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const limit = Math.min(option.maxPerOrder, option.available);
    setQuantities((current) => ({ ...current, [option.id]: Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), limit) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await submitCheckout({
      eventId, buyer: { name: buyer.name, email: buyer.email },
      items: selected.map((option) => ({ ticketTypeId: option.id, quantity: quantities[option.id] })),
    });
    setSubmitting(false);
    if (result.ok) setCreated(result.data); else setError(result.error);
  }

  if (created) {
    const link = `/pedidos/${created.orderId}${created.accessToken ? `#t=${created.accessToken}` : ""}`;
    return <OrderSummary summary={created} orderLink={created.accessToken ? new URL(link, window.location.origin).toString() : undefined} />;
  }

  const shortages = new Map((error?.details ?? []).map((detail) => [detail.ticketTypeId, detail.available]));
  const canSubmit = selected.length > 0 && buyer.name.trim() !== "" && buyer.email.trim() !== "" && !submitting;

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-xl border p-5" aria-labelledby="checkout-title">
      <h2 id="checkout-title" className="text-2xl font-semibold">Reservar entradas</h2>
      <ul className="grid gap-3">
        {options.map((option) => {
          const blocked = saleState(option, now);
          const limit = Math.min(option.maxPerOrder, option.available);
          return (
            <li key={option.id} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-semibold">{option.name} <span className="font-normal">· {option.zone}</span></p>
                <p className="text-sm">{money(option.priceCents)} · Quedan {option.available} · Máximo {option.maxPerOrder} por compra</p>
                {blocked && <Badge variant="secondary">{blocked}</Badge>}
                {shortages.has(option.id) && <p role="alert" className="text-sm font-medium">Solo quedan {shortages.get(option.id)} de {option.name}.</p>}
              </div>
              <label className="grid gap-1 text-sm">
                <span>Cantidad de {option.name}</span>
                <Input type="number" inputMode="numeric" min={0} max={limit} disabled={Boolean(blocked)}
                  value={quantities[option.id] ?? 0} onChange={(event) => setQuantity(option, event.target.value)} className="w-24" />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm"><span>Nombre completo</span>
          <Input name="name" autoComplete="name" required maxLength={100} value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} /></label>
        <label className="grid gap-1 text-sm"><span>Correo electrónico</span>
          <Input name="email" type="email" autoComplete="email" required maxLength={254} value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.target.value })} /></label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-muted p-3 font-medium">{error.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">Total estimado: {money(total)}</p>
        <Button type="submit" disabled={!canSubmit}>{submitting ? "Reservando…" : "Reservar entradas"}</Button>
      </div>
      <p className="text-sm">Reservamos tu cupo por 15 minutos. El pago aún no está habilitado: por ahora no se cobra nada.</p>
    </form>
  );
}

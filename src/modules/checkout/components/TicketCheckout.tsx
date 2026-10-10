"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatCurrency";
import { VenueSeatingMap, type SeatingLayout } from "@/modules/seating";
import { useClientNow } from "../hooks/useClientNow";
import { useSeatHolds } from "../hooks/useSeatHolds";
import { submitCheckout } from "../services/checkoutClient";
import type { CheckoutErrorBody, CheckoutTicketOption, CreatedCheckout } from "../types";
import { OrderSummary } from "./OrderSummary";
import { SeatSelection } from "./SeatSelection";
import { CheckoutProgress } from "./CheckoutProgress";

const money = (cents: number) => formatCurrency(cents / 100, "PEN", "es-PE");

function saleState(option: CheckoutTicketOption, now: number | null) {
  if (option.available <= 0) return "Agotado";
  if (now !== null && now < Date.parse(option.salesStartAt)) return "Venta aún no abierta";
  if (now !== null && now >= Date.parse(option.salesEndAt)) return "Venta cerrada";
  return null;
}

export function TicketCheckout({ eventId, options, layout, venueName = "Plano del recinto" }: { eventId: string; options: CheckoutTicketOption[]; layout?: SeatingLayout; venueName?: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedSection, setSelectedSection] = useState<string | undefined>(options.find((option) => option.seatingType === "numbered")?.id);
  const hasNumbered = options.some((option) => option.seatingType === "numbered");
  const holds = useSeatHolds(eventId, hasNumbered);
  const seats = holds.selections;
  const effectiveLayout = layout ?? { enabled: hasNumbered, template: "stadium", stagePosition: "north" };
  const [buyer, setBuyer] = useState({ name: "", email: "", documentType: 'dni' as 'dni'|'ce'|'passport', documentNumber:'', phone:'' });
  const [acceptedTerms,setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CheckoutErrorBody | null>(null);
  const [created, setCreated] = useState<CreatedCheckout | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const now = useClientNow(); // the server re-validates the sales window regardless

  const quantity = (option: CheckoutTicketOption) => option.seatingType === "numbered" ? (seats[option.id]?.length ?? 0) : (quantities[option.id] ?? 0);
  const selected = options.filter((option) => quantity(option) > 0);
  const total = selected.reduce((sum, option) => sum + option.priceCents * quantity(option), 0);

  function setQuantity(option: CheckoutTicketOption, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const limit = Math.min(option.maxPerOrder, option.available);
    setQuantities((current) => ({ ...current, [option.id]: Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), limit) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) { if (canContinue) setStep(2); return; }
    if (!acceptedTerms) return;
    if (submitting || holds.busy || (selected.some((option) => option.seatingType === "numbered") && !holds.confirmed)) return;
    setSubmitting(true);
    setError(null);
    const result = await submitCheckout({
      eventId, buyer, acceptedTerms, termsVersion:'2026-10-09',
      ...(holds.holdToken ? { seatHoldToken: holds.holdToken } : {}),
      items: selected.map((option) => ({ ticketTypeId: option.id, quantity: quantity(option), ...(option.seatingType === "numbered" ? { seats: seats[option.id] ?? [] } : {}) })),
    });
    setSubmitting(false);
    if (result.ok) setCreated(result.data); else { setError(result.error); if (hasNumbered) void holds.refresh(); }
  }

  if (created) {
    const link = `/pedidos/${created.orderId}${created.accessToken ? `#t=${created.accessToken}` : ""}`;
    return <OrderSummary summary={created} accessToken={created.accessToken} orderLink={created.accessToken ? new URL(link, window.location.origin).toString() : undefined} />;
  }

  const shortages = new Map((error?.details ?? []).map((detail) => [detail.ticketTypeId, detail.available]));
  const canContinue = selected.length > 0 && !submitting && !holds.busy && (!selected.some(option => option.seatingType === "numbered") || holds.confirmed);
  const canSubmit = selected.length > 0 && buyer.name.trim() !== "" && buyer.email.trim() !== "" && buyer.documentNumber.trim() !== '' && buyer.phone.trim() !== '' && acceptedTerms && !submitting && !holds.busy && (!selected.some((option) => option.seatingType === "numbered") || holds.confirmed);

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-xl border p-5" aria-labelledby="checkout-title">
      <h2 id="checkout-title" className="text-2xl font-semibold">Reservar entradas</h2>
      <CheckoutProgress currentStep={step}/>
      {step === 1 && <>
      {effectiveLayout.enabled && <VenueSeatingMap venueName={venueName} layout={effectiveLayout} sections={options.map((option) => ({ ...option, seatingType: option.seatingType === "numbered" ? "numbered" : option.seatingType === "box" ? "box" : option.seatingType === "seated" ? "seated" : "standing", capacity: option.capacity ?? option.available, seatRows: option.seatRows ?? [] }))} selectedSectionId={selectedSection} onSectionSelect={setSelectedSection} />}
      </>}
      {hasNumbered && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-950 dark:bg-violet-950 dark:text-violet-100">
        <p role="status">{holds.busy ? "Bloqueando tus asientos…" : holds.remaining > 0 ? `Tus asientos están bloqueados por ${holds.remaining} segundos.` : "Selecciona asientos para bloquearlos durante 60 segundos."}</p>
        {holds.remaining > 0 && <Button type="button" size="sm" variant="outline" disabled={holds.busy || submitting} onClick={() => { void holds.renew(); }}>Renovar 60 segundos</Button>}
        <Button type="button" size="sm" variant="outline" disabled={holds.busy} onClick={() => { void holds.refresh(); }}>Actualizar asientos</Button>
        {holds.error && <p role="alert">{holds.error}</p>}
      </div>}
      {step === 1 && <ul className="grid gap-3">
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
              {option.seatingType !== "numbered" && <label className="grid gap-1 text-sm">
                <span>Cantidad de {option.name}</span>
                <Input type="number" inputMode="numeric" min={0} max={limit} disabled={Boolean(blocked)}
                  value={quantities[option.id] ?? 0} onChange={(event) => setQuantity(option, event.target.value)} className="w-24" />
              </label>}
              {option.seatingType === "numbered" && effectiveLayout.enabled && selectedSection !== option.id && <Button type="button" variant="outline" onClick={() => setSelectedSection(option.id)}>Ver asientos de {option.name}</Button>}
              {option.seatingType === "numbered" && (!effectiveLayout.enabled || selectedSection === option.id) && <SeatSelection option={option} selected={seats[option.id] ?? []} disabled={Boolean(blocked) || submitting || holds.busy || !holds.ready}
                unavailable={[...(holds.availability.find((entry) => entry.ticketTypeId === option.id)?.occupied ?? []), ...options.filter((other) => other.id !== option.id && other.zone.trim().toLowerCase() === option.zone.trim().toLowerCase()).flatMap((other) => seats[other.id] ?? [])]}
                onChange={(chosen) => { void holds.change(option.id, chosen); }} />}
            </li>
          );
        })}
      </ul>}
      {step === 2 && <>
      <section aria-label="Entradas seleccionadas" className="rounded-lg border p-4"><h3 className="font-semibold">Tus entradas</h3><ul className="mt-2 grid gap-2">{selected.map(option => <li key={option.id}>{quantity(option)} × {option.name} · {money(option.priceCents * quantity(option))}{seats[option.id]?.length ? <span className="block text-sm">Asientos: {seats[option.id].map(seat => `${seat.rowLabel}-${seat.seatNumber}`).join(", ")}</span> : null}</li>)}</ul>{selected.length === 0 && <p role="alert">La selección venció. Vuelve a elegir tus entradas.</p>}</section>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm"><span>Nombre completo</span>
          <Input name="name" autoComplete="name" required maxLength={100} value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} /></label>
        <label className="grid gap-1 text-sm"><span>Correo electrónico</span>
          <Input name="email" type="email" autoComplete="email" required maxLength={254} value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.target.value })} /></label>
        <label className="grid gap-1 text-sm"><span>Tipo de documento</span><select className="h-10 rounded-lg border border-input bg-background px-3" value={buyer.documentType} onChange={event=>setBuyer({...buyer,documentType:event.target.value as typeof buyer.documentType})}><option value="dni">DNI</option><option value="ce">Carné de extranjería</option><option value="passport">Pasaporte</option></select></label>
        <label className="grid gap-1 text-sm"><span>Número de documento</span><Input required minLength={buyer.documentType==='dni'?8:6} maxLength={buyer.documentType==='dni'?8:20} pattern={buyer.documentType==='dni'?'[0-9]{8}':'[A-Za-z0-9]{6,20}'} value={buyer.documentNumber} onChange={event=>setBuyer({...buyer,documentNumber:event.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span>Celular</span><Input type="tel" autoComplete="tel" required minLength={7} maxLength={20} value={buyer.phone} onChange={event=>setBuyer({...buyer,phone:event.target.value})}/></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={acceptedTerms} onChange={event=>setAcceptedTerms(event.target.checked)} className="mt-1 size-4"/><span>Acepto los <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline">Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline">Política de privacidad</a>.</span></label>
      </>}
      {error && <p role="alert" className="rounded-lg bg-muted p-3 font-medium">{error.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">Total estimado: {money(total)}</p>
        <div className="flex gap-3">{step === 2 && <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep(1)}>Volver a entradas</Button>}<Button type="submit" disabled={step === 1 ? !canContinue : !canSubmit}>{step === 1 ? "Continuar" : submitting ? "Reservando…" : "Reservar entradas"}</Button></div>
      </div>
      <p className="text-sm">{step === 1 ? "Elige tus entradas y continúa para completar tus datos." : "Al reservar, guardamos tu cupo por 10 minutos. Completa el pago antes de que termine la reserva."}</p>
    </form>
  );
}

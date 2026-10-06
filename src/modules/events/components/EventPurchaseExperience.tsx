"use client";

import { EventImage as Image } from "./EventImage";
import { ConfiguredEventPage } from "./ConfiguredEventPage";
import Link from "next/link";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, CircleHelp, CreditCard, FileCheck2, LockKeyhole, Mail, MapPin, Minus, Plus, Printer, ShieldCheck, Ticket, UserRound, Users } from "lucide-react";
import type { Event } from "../types";

type Zone = { id: string; name: string; note: string; price: number; color: string; available: number; path: string };
type Step = "tickets" | "checkout" | "done";
const steps: { id: Step; label: string; icon: typeof Ticket }[] = [
  { id: "tickets", label: "Entradas", icon: Ticket },
  { id: "checkout", label: "Datos y pago", icon: CreditCard },
  { id: "done", label: "Confirmación", icon: FileCheck2 },
];
const zones: Zone[] = [
  { id: "platinum", name: "Platinum", note: "Frente al escenario", price: 489, color: "#f15a45", available: 8, path: "M184 184h232v98H184z" },
  { id: "vip", name: "VIP", note: "Vista preferencial", price: 329, color: "#8b5cf6", available: 36, path: "M115 184h53v170H115z M432 184h53v170h-53z M184 294h232v60H184z" },
  { id: "tribuna", name: "Tribuna", note: "Asiento numerado", price: 219, color: "#2c8c73", available: 124, path: "M58 184h43v206H58z M499 184h43v206h-43z M115 365h370v44H115z" },
  { id: "general", name: "General", note: "Acceso de pie", price: 129, color: "#e8a840", available: 210, path: "M174 365h252v34H174z M174 184h10v100h-10z M416 184h10v100h-10z" },
];

function money(value: number) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(value); }

function DemoQr() {
  const size = 29;
  const inFinder = (x: number, y: number, left: number, top: number) => x >= left && x < left + 7 && y >= top && y < top + 7;
  const finderPixel = (x: number, y: number, left: number, top: number) => {
    const dx = x - left; const dy = y - top;
    return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  return <svg className="demo-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Código QR ilustrativo, no válido para ingresar">
    <rect width={size} height={size} rx="1" fill="white" />
    {Array.from({ length: size * size }, (_, index) => {
      const x = index % size; const y = Math.floor(index / size);
      const finder = [[1, 1], [21, 1], [1, 21]].find(([left, top]) => inFinder(x, y, left, top));
      const dark = finder ? finderPixel(x, y, finder[0], finder[1]) : ((x * 13 + y * 7 + x * y * 3 + (x ^ y)) % 11 < 5);
      return dark && <rect key={index} x={x} y={y} width="1" height="1" rx=".12" fill="#19191f" />;
    })}
  </svg>;
}

function SeatPicker({ selectedSeats, onToggle }: { selectedSeats: string[]; onToggle: (seat: string) => void }) {
  const rows = "ABCDEFGH".split("");
  return <div className="seat-picker" aria-label="Selección de asientos"><div className="seat-picker-head"><div><b>Asientos disponibles</b><small>Toca los asientos que quieras · máximo 6</small></div><span>{selectedSeats.length} seleccionados</span></div><div className="seat-stage">ESCENARIO</div><div className="seat-grid">{rows.map((row) => <div className="seat-row" key={row}><b>{row}</b>{Array.from({ length: 12 }, (_, index) => { const seat = `${row}${index + 1}`; const sold = (index * 3 + row.charCodeAt(0)) % 13 === 0; return <button key={seat} type="button" disabled={sold || (!selectedSeats.includes(seat) && selectedSeats.length >= 6)} onClick={() => onToggle(seat)} className={`seat-dot ${sold ? "sold" : ""} ${selectedSeats.includes(seat) ? "chosen" : ""}`} aria-label={`Fila ${row}, asiento ${index + 1}${sold ? ", no disponible" : selectedSeats.includes(seat) ? ", seleccionado" : ", disponible"}`} aria-pressed={selectedSeats.includes(seat)} />; })}</div>)}</div><div className="seat-grid-legend"><span><i /> Disponible</span><span><i className="chosen" /> Seleccionado</span><span><i className="sold" /> Ocupado</span></div></div>;
}

export function EventPurchaseExperience({ event }: { event: Event }) {
  return event.ticketOptions!==undefined?<ConfiguredEventPage event={event}/>:<DemoEventPurchaseExperience event={event}/>;
}
function DemoEventPurchaseExperience({ event }: { event: Event }) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<Step>("tickets");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [ticketIndex, setTicketIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const zone = zones.find((item) => item.id === zoneId);
  const eventDate = new Date(`${event.date}T12:00:00`);
  const fullDate = Number.isFinite(eventDate.getTime()) ? new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(eventDate) : "Fecha por definir";
  const total = zone ? zone.price * quantity : 0;
  const activeIndex = steps.findIndex((item) => item.id === step);
  const canOpenStep = (target: Step) => target === "tickets" || (target === "checkout" && Boolean(zone)) || (target === "done" && step === "done");
  const chooseSeat = (seat: string) => setSelectedSeats((current) => {
    if (current.includes(seat)) { const next = current.filter((item) => item !== seat); setQuantity(Math.max(1, next.length)); return next; }
    if (current.length >= 6) return current;
    const next = [...current, seat]; setQuantity(next.length); return next;
  });
  const addToCalendar = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const allDay = event.date.replaceAll("-", "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ticketera//Demo//ES", "BEGIN:VEVENT", `UID:${event.id}-ticketera-demo@ticketera.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${allDay}`, `SUMMARY:${event.title} · Ticketera`, `LOCATION:${event.venue}, ${event.city}, Perú`, "DESCRIPTION:Evento de demostración. Hora por confirmar con el organizador.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${event.id}-ticketera.ics`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <main className="purchase-page">
    <header className="purchase-header"><div className="purchase-header-inner"><Link href="/" className="brand" aria-label="Ticketera, volver al inicio"><span className="brand-icon"><Ticket size={22} /></span>ticketera<span className="brand-dot">.</span></Link><Link href="/" className="purchase-back"><ArrowLeft size={17} /><span>Volver a conciertos</span></Link><span className="secure-label"><ShieldCheck size={16} /> Compra segura</span></div></header>
    <div className="purchase-crumb page-shell"><Link href="/">Inicio</Link><span>/</span><span>{event.title}</span></div>
    <section className="purchase-event page-shell"><div className="purchase-event-image"><Image src={event.heroImageUrl ?? event.imageUrl} alt={event.title} fill priority sizes="(max-width: 760px) 100vw, 44vw" /></div><div className="purchase-event-copy"><p className="eyebrow"><span className="verified-dot" /> EVENTO CONFIRMADO · {event.genre?.toUpperCase()}</p><h1>{event.title}</h1><p className="purchase-tour">{event.tour}</p><div className="event-facts"><span><CalendarDays size={18} /><span><b>{fullDate}</b><small>Fecha del evento</small></span></span><span><MapPin size={18} /><span><b>{event.venue}</b><small>{event.city}, Perú</small></span></span></div><p className="purchase-description">Una noche para cantar cada canción. Revisa las zonas disponibles, elige tus entradas y prepárate para vivirlo en primera fila.</p><div className="trust-row"><span><Check size={15} /> Precios en soles</span><span><Check size={15} /> Entradas digitales</span><span><Check size={15} /> Pago protegido</span></div></div></section>

    <section className="ticket-selection" id="entradas"><div className="page-shell">
      <div className="purchase-title-row"><div><p className="eyebrow">TU NOCHE EMPIEZA AQUÍ</p><h2>{step === "tickets" ? "Elige tus entradas" : step === "checkout" ? "Tus datos y forma de pago" : "Tus entradas están listas"}</h2><p>{step === "tickets" ? "Selecciona tu zona en el mapa o en la lista." : step === "checkout" ? "Completa tus datos y elige un método de pago de prueba." : "Tu confirmación y entrada digital de muestra."}</p></div><div className="step-indicator" aria-label={`Paso ${activeIndex + 1} de ${steps.length}`}>{steps.map((item, index) => <span key={item.id} className={step === item.id ? "current" : index < activeIndex ? "complete" : ""}>{index < activeIndex ? <Check size={13} /> : index + 1}</span>)}</div></div>

      <div className="purchase-workspace">
        <aside className="purchase-sidebar" aria-label="Pasos de compra"><div className="sidebar-event-card"><div className="sidebar-event-thumb"><Image src={event.imageUrl} alt="" fill sizes="52px" /></div><span><b>{event.title}</b><small>{event.city} · {event.venue}</small></span></div><p className="sidebar-label">TU COMPRA</p><nav className="checkout-nav">{steps.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" onClick={() => canOpenStep(id) && setStep(id)} disabled={!canOpenStep(id)} aria-current={step === id ? "step" : undefined} className={`${step === id ? "active" : ""} ${index < activeIndex ? "visited" : ""}`}><span className="checkout-nav-icon"><Icon size={17} /></span><span>{label}</span>{index < activeIndex ? <CheckCircle2 className="nav-trailing" size={16} /> : index === activeIndex ? <ChevronRight className="nav-trailing" size={16} /> : <span className="nav-step-number">0{index + 1}</span>}</button>)}</nav><div className="sidebar-help"><CircleHelp size={16} /><span>¿Necesitas ayuda?<b>Estamos para ayudarte</b></span></div><div className="sidebar-secure"><LockKeyhole size={14} /> Tus datos están protegidos</div></aside>

        <div className="purchase-main-panel">
          {step === "tickets" && <div className="selection-layout"><div className="venue-panel"><div className="venue-toolbar"><span><Users size={16} /> {zoneId && zoneId !== "general" ? "Selecciona tus asientos" : "Vista general del recinto"}</span><button type="button" aria-label="Información del mapa" title="Plano referencial de demostración. Confirma la ubicación con el organizador."><CircleHelp size={17} /></button></div><p className="map-instructions">{zone ? zoneId === "general" ? "Entrada general: elige cuántas entradas necesitas." : "Primero elige una zona; después toca tus asientos disponibles." : "1. Elige una zona en el plano o en la lista. 2. Define tus entradas."}</p><div className="venue-map-wrap"><svg className="venue-map" viewBox="0 0 600 470" role="group" aria-label="Mapa interactivo de zonas. Selecciona una zona para ver su precio."><path className="map-outline" d="M49 158 Q300 52 551 158 V383 Q300 457 49 383Z"/><rect x="230" y="92" width="140" height="45" rx="12" className="map-stage"/><text x="300" y="120" textAnchor="middle" className="stage-text">ESCENARIO</text>{zones.map((item) => <g key={item.id} onClick={() => { setZoneId(item.id); setSelectedSeats([]); setQuantity(1); }} onKeyDown={(e: KeyboardEvent<SVGGElement>) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setZoneId(item.id), setSelectedSeats([]), setQuantity(1))} role="button" tabIndex={item.available ? 0 : -1} aria-label={`${item.name}, S/ ${item.price}, ${item.available ? "disponible" : "agotado"}`} aria-pressed={zoneId === item.id} className={`map-zone ${zoneId === item.id ? "selected" : ""}`}><path d={item.path} fill={item.color} /><text x={item.id === "platinum" ? 300 : item.id === "vip" ? 140 : item.id === "tribuna" ? 78 : 300} y={item.id === "platinum" ? 240 : item.id === "vip" ? 268 : item.id === "tribuna" ? 280 : 390} textAnchor="middle">{item.name.toUpperCase()}</text></g>)}</svg>{zone && zoneId !== "general" && <SeatPicker selectedSeats={selectedSeats} onToggle={chooseSeat} />}<div className="map-legend"><span><i className="legend-available" /> Disponible</span><span><i className="legend-selected" /> Tu selección</span><span><i className="legend-sold" /> No disponible</span></div></div></div><aside className="ticket-panel"><div className="ticket-panel-heading"><div><span className="selection-step-label">PASO 1 · ENTRADAS</span><h3>{zone ? zone.name : "Elige una zona"}</h3><p>{zone ? zone.note : "El precio y tipo de asiento se muestran al elegir."}</p></div></div><div className="zone-list">{zones.map((item) => <button key={item.id} type="button" className={`zone-option ${zoneId === item.id ? "is-selected" : ""}`} onClick={() => { setZoneId(item.id); setSelectedSeats([]); setQuantity(1); }} aria-pressed={zoneId === item.id}><i style={{ "--zone-color": item.color } as CSSProperties} /><span className="zone-copy"><b>{item.name}</b><small>{item.note} · {item.available} disponibles</small></span><span className="zone-price"><b>{money(item.price)}</b><small>por entrada</small></span><span className="zone-radio" /></button>)}</div>{zoneId === "general" && <div className="quantity-row"><span><b>Cantidad</b><small>Hasta 6 entradas</small></span><div><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Quitar una entrada" disabled={quantity <= 1}><Minus size={15} /></button><output aria-live="polite">{quantity}</output><button type="button" onClick={() => setQuantity((value) => Math.min(6, value + 1))} aria-label="Agregar una entrada" disabled={quantity >= 6}><Plus size={15} /></button></div></div>}{zone && <p className="selected-seat-summary" aria-live="polite">{zoneId === "general" ? "Acceso sin asiento asignado" : selectedSeats.length ? `Asientos: ${selectedSeats.join(", ")}` : "Selecciona tus asientos en el plano"}</p>}<div className="panel-total"><span>{zone ? `${quantity} ${quantity === 1 ? "entrada" : "entradas"}` : "Total"}</span><b>{zone ? money(total) : "—"}</b></div><button type="button" className="purchase-cta" disabled={!zone || (zoneId !== "general" && selectedSeats.length === 0)} onClick={() => setStep("checkout")}>Continuar · {zone ? money(total) : "elige una zona"} <ArrowRight size={18} /></button><p className="mock-note">Precios, asientos y disponibilidad son de demostración.</p></aside></div>}

          {step === "checkout" && <div className="form-step-layout"><form className="checkout-form" onSubmit={(e) => { e.preventDefault(); setTicketIndex(0); setStep("done"); }}><p className="checkout-kicker"><UserRound size={17} /> Datos del comprador</p><p className="required-hint"><span>*</span> Campos obligatorios</p><label><span className="field-label">Nombre completo <i aria-hidden="true">*</i></span><input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparece en tu documento" /></label><label><span className="field-label">Correo electrónico <i aria-hidden="true">*</i></span><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" /></label><div className="form-fields-row"><label><span className="field-label">DNI / documento <i aria-hidden="true">*</i></span><input required inputMode="numeric" maxLength={12} value={documentId} onChange={(e) => setDocumentId(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Número de documento" /></label><label><span className="field-label">Celular <i aria-hidden="true">*</i></span><input required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 999 999 999" /></label></div><p className="checkout-kicker payment-kicker"><ShieldCheck size={17} /> Método de pago</p><p className="payment-intro">Solo vista previa. No ingreses datos reales ni se realizará un cobro.</p><label className={`payment-option ${paymentMethod === "card" ? "selected" : ""}`}><input type="radio" name="payment" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} /><span className="payment-brand">VISA</span><span><b>Tarjeta de prueba</b><small>Débito o crédito · demo</small></span><CheckCircle2 size={17} /></label><label className={`payment-option ${paymentMethod === "wallet" ? "selected" : ""}`}><input type="radio" name="payment" value="wallet" checked={paymentMethod === "wallet"} onChange={() => setPaymentMethod("wallet")} /><span className="payment-brand wallet-brand">Y</span><span><b>Billetera digital</b><small>Yape · simulación visual</small></span><CheckCircle2 size={17} /></label><label className="terms-check"><input type="checkbox" required checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />Confirmo que estos datos son de prueba y acepto las condiciones de demostración.</label><div className="demo-payment-notice"><LockKeyhole size={16} /><span><b>Entorno de demostración</b><small>Los datos solo viven en esta sesión. No se guardan ni se envían.</small></span></div><div className="form-actions"><button type="button" className="back-step" onClick={() => setStep("tickets")}><ArrowLeft size={16} /> Volver</button><button className="purchase-cta" type="submit">Confirmar compra de prueba <ArrowRight size={18} /></button></div></form><OrderSummary event={event} fullDate={fullDate} zone={zone} quantity={quantity} total={total} buyerName={name} buyerEmail={email} /></div>}

          {step === "done" && <div className="ticket-confirmation"><div className="confirmation-heading"><span className="confirmation-icon"><Check size={27} /></span><div><h3>¡Tu noche ya tiene fecha!</h3><p>Compra de demostración completada. No se realizó ningún cobro.</p></div></div><div className="ticket-pagination" aria-label="Navegar entre entradas"><button type="button" disabled={ticketIndex === 0} aria-label="Entrada anterior" onClick={() => setTicketIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={17} /></button><span>Entrada {ticketIndex + 1} de {quantity}</span><button type="button" disabled={ticketIndex >= quantity - 1} aria-label="Entrada siguiente" onClick={() => setTicketIndex((index) => Math.min(quantity - 1, index + 1))}><ArrowRight size={17} /></button></div><article className="digital-ticket"><div className="digital-ticket-top"><div className="digital-ticket-event"><span className="digital-ticket-logo"><Ticket size={16} /></span><span><b>TICKETERA</b><small>ENTRADA DIGITAL · DEMO</small></span></div><span className="ticket-status">MUESTRA</span></div><div className="digital-ticket-body"><div className="digital-ticket-image"><Image src={event.imageUrl} alt="" fill sizes="120px" /></div><div className="digital-ticket-details"><h4>{event.title}</h4><p>{event.tour}</p><div><CalendarDays size={14} /> {fullDate}</div><div><MapPin size={14} /> {event.venue}, {event.city}</div></div></div><div className="digital-ticket-perforation"><span /><i /><span /></div><div className="digital-ticket-bottom"><div><small>ZONA</small><b>{zone?.name ?? "General"}</b><small>ASISTENTE</small><b>{name}</b><small>CÓDIGO DE MUESTRA</small><b>TK-{event.id.toUpperCase()}-2026-{String(ticketIndex + 1).padStart(3, "0")}</b></div><DemoQr /></div><p className="qr-disclaimer">QR ilustrativo. No es válido para ingresar al evento.</p></article><div className="ticket-confirmation-actions"><p><Mail size={17} /> Confirmación visual para <b>{email}</b></p><div className="confirmation-download-actions"><button type="button" className="calendar-action" onClick={addToCalendar}><CalendarDays size={16} /> Agregar al calendario</button><button type="button" className="purchase-cta" onClick={() => window.print()}><Printer size={16} /> Descargar PDF</button></div></div><button type="button" className="back-step" onClick={() => { setStep("tickets"); setName(""); setEmail(""); setDocumentId(""); }}>Volver al evento</button></div>}
        </div>
      </div>
    </div></section>
  </main>;
}

function OrderSummary({ event, fullDate, zone, quantity, total, buyerName, buyerEmail }: { event: Event; fullDate: string; zone?: Zone; quantity: number; total: number; buyerName?: string; buyerEmail?: string }) {
  return <aside className="order-card"><h3>Resumen de compra</h3><div className="order-event"><div className="order-thumb"><Image src={event.imageUrl} alt="" fill sizes="64px" /></div><span><b>{event.title}</b><small>{fullDate} · {event.venue}</small></span></div><div className="order-line"><span>{zone?.name ?? "Zona"} · {quantity} {quantity === 1 ? "entrada" : "entradas"}</span><b>{money(total)}</b></div><div className="order-line"><span>Servicio de ticketera</span><b>Incluido</b></div>{buyerName && <div className="order-buyer"><UserRound size={15} /><span><b>{buyerName}</b><small>{buyerEmail}</small></span></div>}<div className="order-total"><span>Total referencial</span><b>{money(total)}</b></div><p className="order-demo-label"><LockKeyhole size={13} /> Información y montos de prueba</p></aside>;
}

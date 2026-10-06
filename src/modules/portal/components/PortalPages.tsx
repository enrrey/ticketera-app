"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, CircleHelp, CreditCard, FilePlus2, LayoutDashboard, MapPin, Settings2, Ticket, UserRound } from "lucide-react";
import type { Event } from "@/modules/events/types";


export function LoginPage({ returnTo = "/" }: { returnTo?: string }) {
  const destination = ["/", "/organizador", "/organizador/eventos/nuevo", "/administracion/usuarios"].includes(returnTo) ? returnTo : "/";
  return <main className="portal-auth"><Link href="/" className="brand"><span className="brand-icon"><Ticket size={22} /></span>ticketera<span className="brand-dot">.</span></Link><section aria-label="Ingresar a Ticketera"><SignIn routing="hash" withSignUp forceRedirectUrl={destination} signUpForceRedirectUrl={destination} /></section></main>;
}
export function MyTicketsPage({ events }: { events: Event[] }) {
  const [selected, setSelected] = useState<Event | null>(null);
  const event = selected ?? events[0];
  return <main className="portal-page"><PortalTop title="Mis entradas" /><div className="portal-shell"><PortalNav active="Entradas" /><section className="portal-content"><div className="portal-title-row"><div><p className="portal-eyebrow">TU HISTORIAL</p><h1>Mis entradas</h1><p>Ten a mano los detalles de tus próximos eventos.</p></div><span className="demo-pill">VISTA DEMO</span></div><div className="tickets-layout"><div className="my-ticket-list">{events.slice(0, 5).map((item) => <button className={`my-ticket-row ${event?.id === item.id ? "active" : ""}`} key={item.id} onClick={() => setSelected(item)}><div className="my-ticket-thumb"><Image src={item.imageUrl} alt="" fill sizes="70px" /></div><span><b>{item.title}</b><small>{new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${item.date}T12:00:00`))} · {item.city}</small><small>1 entrada · General</small></span><span className="ticket-upcoming">Próximo</span><ChevronRight size={17} /></button>)}</div>{event && <article className="my-ticket-detail"><div className="my-detail-image"><Image src={event.heroImageUrl ?? event.imageUrl} alt={event.title} fill sizes="520px" /></div><div className="my-detail-body"><span className="demo-pill">ENTRADA DE MUESTRA</span><h2>{event.title}</h2><p>{event.tour}</p><div><CalendarDays size={16} />{new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${event.date}T12:00:00`))}</div><div><MapPin size={16} />{event.venue} · {event.city}</div><div className="portal-qr-preview" aria-label="QR ilustrativo, no válido para ingresar">▦<small>QR ILUSTRATIVO · NO VÁLIDO</small></div><div className="portal-demo-note"><CircleHelp size={15} /> Esta entrada de prueba no sirve para ingresar al evento.</div></div></article>}</div></section></div></main>;
}

function PortalTop({ title }: { title: string }) { return <header className="portal-top"><Link href="/" className="brand"><span className="brand-icon"><Ticket size={20} /></span>ticketera<span className="brand-dot">.</span></Link><span>{title}</span><Link href="/" className="portal-home-link"><ArrowLeft size={15} /> Volver a eventos</Link></header>; }
function PortalNav({ active, organizer = false }: { active: string; organizer?: boolean }) { const links = organizer ? [["Resumen", "/organizador", LayoutDashboard], ["Mis eventos", "/organizador", Ticket], ["Crear evento", "/organizador/eventos/nuevo", FilePlus2], ["Ventas", "/organizador", BarChart3], ["Configuración", "/organizador", Settings2]] as const : [["Entradas", "/mis-entradas", Ticket], ["Datos personales", "/ingresar", UserRound], ["Métodos de pago", "/ingresar", CreditCard]] as const; return <aside className="portal-nav"><p>{organizer ? "ORGANIZADOR" : "MI CUENTA"}</p>{links.map(([label, href, Icon]) => <Link key={label} className={active === label ? "active" : ""} href={href}><Icon size={17} />{label}<ChevronRight size={15} /></Link>)}</aside>; }

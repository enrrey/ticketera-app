"use client";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { EventImage as Image } from "./EventImage";
import Link from "next/link";
import { BarChart3, CalendarDays, Plus, Ticket, Eye, Pencil, Trash2, ExternalLink, Star } from "lucide-react";
import { useEvents } from "../hooks/useEvents";
import { useApplicationAccess } from "@/modules/identity-access/client";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EventEditorSheet, type EventEditorMode } from "./EventEditorSheet";
import styles from "./OrganizerDashboard.module.css";

const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);
const statusNames: Record<string, string> = { draft: "Borrador", published: "Publicado", cancelled: "Cancelado", completed: "Finalizado" };

export function OrganizerDashboard() {
  const access = useApplicationAccess();
  const [editor, setEditor] = useState<{ mode: EventEditorMode; slug?: string }>();
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [featuring, setFeaturing] = useState<string>();
  const canFeature = Boolean(access?.roles.some((role) => role === "admin" || role === "super_admin"));
  async function toggleFeatured(slug: string, featured: boolean) {
    setFeaturing(slug); setNotice("");
    try {
      const response = await fetch(`/api/events/${slug}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({featured}) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "No pudimos actualizar el destacado"); }
      setNotice(featured ? "Evento destacado. Aparecerá en el hero cuando esté publicado." : "Evento retirado de destacados.");
      await refetch();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No pudimos actualizar el destacado"); }
    finally { setFeaturing(undefined); }
  }
  const { userId, isLoaded } = useAuth();
  const { data = [], isPending, isError, refetch } = useEvents(undefined, { scope: "organizer", userId: isLoaded ? userId : null });
  if (!isLoaded || !userId || isPending) return <section className="portal-content" role="status">Cargando tus eventos…</section>;
  if (isError) return <section className="portal-content" role="alert"><p>No pudimos cargar tus eventos y ventas.</p><button className="portal-primary" onClick={() => refetch()}>Volver a intentar</button></section>;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const filtered = data.filter((event) => {
    const date = event.date && !Number.isNaN(Date.parse(event.date))
      ? (/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.date))) : "";
    return normalize(event.title).includes(normalize(name.trim())) && (!status || event.status === status) && (!from || Boolean(date && date >= from)) && (!to || Boolean(date && date <= to));
  });
  const metrics = [
    { label: "Ingresos netos", value: money(data.reduce((sum, event) => sum + (event.netRevenueCents ?? 0), 0)), note: "Pagos confirmados menos reembolsos completados", Icon: BarChart3 },
    { label: "Entradas emitidas", value: data.reduce((sum, event) => sum + (event.ticketsIssued ?? 0), 0).toLocaleString("es-PE"), note: "Entradas vigentes y utilizadas", Icon: Ticket },
    { label: "Eventos publicados", value: String(data.filter((event) => event.status === "published").length), note: `${data.length} eventos en total`, Icon: CalendarDays },
  ];
  return <section className="portal-content">
    <div className="portal-title-row"><div><p className="portal-eyebrow">CENTRO DE CONTROL</p><h1>Tus eventos y ventas</h1><p>{access?.roles.some((role) => role === "admin" || role === "super_admin") ? "Información de los eventos registrados en la plataforma." : "Información de tus eventos registrados en Ticketera."}</p></div></div>
    {notice && <p role="status" className="mb-4">{notice}</p>}
    <div className="metric-grid">{metrics.map(({ label, value, note, Icon }) => <article className="metric-card" key={label}><span>{label}</span><b>{value}</b><small>{note}</small><span className="metric-icon"><Icon size={20} /></span></article>)}</div>
    <div className="portal-table-card"><div className={`portal-table-heading ${styles.heading}`}><div><h2>Tus eventos</h2><p>Entradas e ingresos acumulados por evento</p></div><div className={styles.headingActions}><Button variant="outline" onClick={() => refetch()}>Actualizar</Button><Button onClick={() => setEditor({ mode: "create" })}><Plus size={17} />Crear evento</Button></div></div>
      <div className={styles.filters} role="search" aria-label="Filtrar eventos">
        <label>Nombre<input type="search" placeholder="Buscar evento" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Estado<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Desde<DatePicker label="Desde" value={from} max={to || undefined} onChange={setFrom} /></label>
        <label>Hasta<DatePicker label="Hasta" value={to} min={from || undefined} onChange={setTo} /></label>
        <Button variant="ghost" onClick={() => { setName(""); setStatus(""); setFrom(""); setTo(""); }}>Limpiar filtros</Button>
      </div>
      <p className={styles.resultCount} role="status">{filtered.length} de {data.length} eventos</p>
      {!data.length ? <p className="p-6">Todavía no tienes eventos registrados.</p> : !filtered.length ? <p className="p-6">No hay eventos que coincidan con los filtros.</p> : <div className="portal-event-table">{filtered.map((event) => <article className={styles.row} key={event.id}>
        <div className="organizer-event-thumb"><Image src={event.imageUrl} alt="" fill sizes="50px" /></div>
        <span className={styles.title}><b>{event.title}</b><small>{event.venue} · {event.city}</small><small>{event.date || "Fecha por definir"}</small></span>
        <span className="table-sales">{event.ticketsIssued ?? 0}<small>entradas</small></span>
        <span><b>{money(event.netRevenueCents ?? 0)}</b><small>ingresos netos</small></span>
        <span className={styles.status}>{statusNames[event.status ?? ""] ?? event.status}</span>
        <div className={styles.actions}>{canFeature && <Button type="button" size="icon-sm" variant={event.featured?"secondary":"outline"} aria-pressed={event.featured} aria-label={`${event.featured?"Quitar destacado de":"Destacar"} ${event.title}`} title={event.featured?"Quitar destacado":"Destacar en hero"} disabled={Boolean(featuring)} onClick={()=>void toggleFeatured(event.id,!event.featured)}><Star fill={event.featured?"currentColor":"none"}/></Button>}<Button size="icon-sm" variant="outline" title="Ver evento" aria-label={`Ver ${event.title}`} onClick={() => setEditor({ mode: "view", slug: event.id })}><Eye /></Button>{!["cancelled","completed"].includes(event.status ?? "") && <Button size="icon-sm" variant="outline" title="Editar evento" aria-label={`Editar ${event.title}`} onClick={() => setEditor({ mode: "edit", slug: event.id })}><Pencil /></Button>}{event.status === "draft" && <Button size="icon-sm" variant="destructive" title="Eliminar evento" aria-label={`Eliminar ${event.title}`} onClick={() => setEditor({ mode: "delete", slug: event.id })}><Trash2 /></Button>}{event.status === "published" && <Link href={`/eventos/${event.id}`} className={styles.publicLink} title="Vista pública" aria-label={`Vista pública de ${event.title}`}><ExternalLink size={16} /></Link>}</div>
      </article>)}</div>}
    </div>
    {editor && <EventEditorSheet key={`${editor.mode}-${editor.slug ?? "new"}`} {...editor} canFeature={canFeature} canPublish={Boolean(access?.permissions.includes("events.publish"))} onClose={() => setEditor(undefined)} onSaved={(message) => { setEditor(undefined); setNotice(message); void refetch(); }} />}
  </section>;
}


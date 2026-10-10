"use client";
import { useEffect, useState, type FormEvent } from "react";
import { defaultSeatingLayout } from "@/modules/seating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { EventInput, ManagedEvent } from "../eventManagement.types";
import { EventConfigurationPreview } from "./EventConfigurationPreview";
import { TicketTypeEditor } from "./TicketTypeEditor";
import { EventImage } from "./EventImage";
import { isEventImageUrl } from "../services/eventImageUrl";

export type EventEditorMode = "create" | "view" | "edit" | "delete";
const localTime = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0,16);
const isoTime = (local: string) => new Date(`${local}:00-05:00`).toISOString();
const blank: EventInput = { name: "", category: "concert", description: "", imageUrl: "", venueName: "", address: "", city: "Lima", sessions: [], status: "draft",seatingLayout:defaultSeatingLayout,ticketTypes:[],minimumAge:0,entryInstructions:"" };
export function EventEditorSheet({ mode, slug, canPublish, canFeature = false, onClose, onSaved }: { mode: EventEditorMode; slug?: string; canPublish: boolean; canFeature?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState<EventInput>({ ...blank, sessions: [{ startsAt: "", endsAt: "" }] });
  const [venues,setVenues]=useState<{id:string;name:string;address:string;city:string}[]>([]);
  const [venueError,setVenueError]=useState("");
  const [detail, setDetail] = useState<ManagedEvent>();
  const [loading, setLoading] = useState(mode !== "create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readonly = mode === "view";
  useEffect(()=>{
    if(mode==="view"||mode==="delete") return;
    const controller=new AbortController();
    fetch("/api/venues",{cache:"no-store",signal:controller.signal}).then(async(response)=>{
      const data=await response.json();if(!response.ok||!Array.isArray(data)) throw new Error("No pudimos cargar el catálogo de recintos");
      if(!controller.signal.aborted) setVenues(data);
    }).catch(()=>{if(!controller.signal.aborted) setVenueError("No pudimos cargar el catálogo. Puedes introducir un recinto nuevo.");});
    return ()=>controller.abort();
  },[mode]);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/events/${slug}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No pudimos cargar el evento");
      if (controller.signal.aborted) return;
      const event = data as ManagedEvent; setDetail(event); setForm({ name: event.name, category: event.category, description: event.description, imageUrl: event.imageUrl, venueName: event.venueName, address: event.address, city: event.city, status: event.status,seatingLayout:event.seatingLayout??{...defaultSeatingLayout,enabled:(event.ticketTypes??[]).some((option)=>option.seatingType==="numbered")},featured:event.featured??false,minimumAge:event.minimumAge??0,entryInstructions:event.entryInstructions??"",ticketTypes:(event.ticketTypes??[]).map((option)=>({...option,salesStartAt:localTime(option.salesStartAt),salesEndAt:localTime(option.salesEndAt)})), sessions: event.sessions.map((session) => ({ startsAt: localTime(session.startsAt), endsAt: localTime(session.endsAt) })) });
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No pudimos cargar el evento"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);
  const field = (key: keyof Omit<EventInput,"sessions"|"ticketTypes"|"minimumAge">, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const removeSession=(index:number)=>setForm((current)=>({...current,sessions:current.sessions.filter((_,i)=>i!==index),ticketTypes:(current.ticketTypes??[]).map((option)=>({...option,sessionIndexes:option.sessionIndexes.filter((i)=>i!==index).map((i)=>i>index?i-1:i)}))}));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (readonly) return;
    if (mode !== "delete" && !detail?.hasOrders) {
      if (form.sessions.some((session) => !session.startsAt || !session.endsAt || session.endsAt <= session.startsAt)) { setError("Cada sesión necesita un inicio y un fin posterior al inicio."); return; }
      const invalidTicket = (form.ticketTypes ?? []).find((option) => !option.salesStartAt || !option.salesEndAt || option.salesEndAt <= option.salesStartAt || !option.sessionIndexes.length || (option.seatingType === "numbered" && (!option.seatRows.length || new Set(option.seatRows.map((row) => row.label.trim().toLowerCase())).size !== option.seatRows.length)));
      if (invalidTicket) { setError("Revisa las entradas: el fin de venta debe ser posterior al inicio, selecciona una sesión y configura filas con nombres únicos para los asientos numerados."); return; }
      if(!form.seatingLayout?.enabled && (form.ticketTypes??[]).some((option)=>option.seatingType==="numbered")){setError("Habilita el plano y la selección de asientos para las entradas numeradas.");return;}
      if (form.status === "published" && !form.ticketTypes?.length) { setError("Añade al menos un tipo de entrada antes de publicar."); return; }
    }
    setBusy(true); setError("");
    try {
      const payload=detail?.hasOrders?{imageUrl:form.imageUrl,...(canFeature?{featured:form.featured??false}:{})}:{...form,sessions:form.sessions.map((session)=>({startsAt:isoTime(session.startsAt),endsAt:isoTime(session.endsAt)})),ticketTypes:(form.ticketTypes??[]).map((option)=>({...option,salesStartAt:isoTime(option.salesStartAt),salesEndAt:isoTime(option.salesEndAt)}))};
      const response = await fetch(slug ? `/api/events/${slug}` : "/api/events", { method: mode === "delete" ? "DELETE" : mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, ...(mode === "delete" ? {} : { body: JSON.stringify(payload) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "No pudimos guardar el evento"); }
      onSaved(mode === "delete" ? "Borrador eliminado" : mode === "create" ? "Evento creado como borrador" : "Evento actualizado");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos completar la operación"); }
    finally { setBusy(false); }
  }
  const titles = { create: "Crear evento", view: "Detalle del evento", edit: "Editar evento", delete: "Eliminar evento" };
  return <Sheet open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><SheetContent className="event-editor-sheet" showCloseButton={!busy}>
    <SheetHeader><SheetTitle>{titles[mode]}</SheetTitle><SheetDescription>{mode === "delete" ? "Solo se pueden eliminar borradores sin pedidos ni registros financieros." : "Información del evento y sesiones en horario de Perú."}</SheetDescription></SheetHeader>
    {loading ? <p className="p-6" role="status">Cargando evento…</p> : <form className="grid gap-5 p-6" onSubmit={submit}>
      {mode !== "delete" && <nav aria-label="Pasos para configurar el evento" className="flex flex-wrap gap-2 text-sm">{[["event-details", "1. Información"], ["event-venue", "2. Recinto"], ["event-sessions", "3. Sesiones"], ["event-tickets", "4. Entradas"], ["event-preview", "5. Revisar"]].map(([id, label]) => <a key={id} href={"#"+id} className="rounded border px-3 py-2">{label}</a>)}</nav>}
      {mode!=="delete"&&<label className="grid gap-2">Imagen de portada<Input aria-label="Imagen de portada" value={form.imageUrl} maxLength={1000} disabled={readonly||busy} placeholder="https://…" onChange={(e)=>field("imageUrl",e.target.value)}/>{form.imageUrl&&isEventImageUrl(form.imageUrl)&&<span className="relative block h-48 overflow-hidden rounded-lg"><EventImage src={form.imageUrl} alt="Vista previa de la portada" fill sizes="600px"/></span>}<small>Introduce una URL HTTPS pública o conserva la imagen actual.</small></label>}
      {canFeature && mode!=="delete" && <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured??false} disabled={readonly||busy} onChange={(e)=>setForm((current)=>({...current,featured:e.target.checked}))}/>Destacado en el hero<small className="text-muted-foreground">Visible en la web al publicarse.</small></label>}
      {mode === "delete" ? <p>¿Eliminar el borrador «{detail?.name}»? Esta acción elimina sus sesiones.</p> : <fieldset disabled={readonly || busy || Boolean(detail?.hasOrders)} className="grid gap-4">
        <h2 id="event-details" className="scroll-mt-4 font-semibold">1. Información del evento</h2>
        <label className="grid gap-2">Nombre<Input required maxLength={160} value={form.name} onChange={(e) => field("name",e.target.value)} /></label>
        <label className="grid gap-2">Categoría<select className="min-h-10 rounded border bg-background p-2" value={form.category} onChange={(e) => field("category",e.target.value)}>{Object.entries({ concert:"Concierto", theater:"Teatro", sports:"Deportes", festival:"Festival", conference:"Conferencia", exhibition:"Exposición", family:"Familia", comedy:"Comedia", cinema:"Cine" }).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2">Descripción<textarea className="rounded border p-2" required rows={4} maxLength={5000} value={form.description} onChange={(e) => field("description",e.target.value)} /></label>
        <h2 id="event-venue" className="scroll-mt-4 font-semibold">2. Recinto y acceso</h2>
        <label className="grid gap-2">Elegir recinto<select className="min-h-10 rounded border bg-background p-2" value={venues.find((venue)=>venue.name===form.venueName&&venue.address===form.address&&venue.city===form.city)?.id??""} onChange={(e)=>{const venue=venues.find((item)=>item.id===e.target.value);setForm((current)=>({...current,venueName:venue?.name??"",address:venue?.address??"",city:venue?.city??"Lima"}));}}><option value="">Introducir recinto nuevo</option>{venues.map((venue)=><option key={venue.id} value={venue.id}>{venue.name} · {venue.city}</option>)}</select></label>
        {venueError&&<p className="text-sm">{venueError}</p>}
        <label className="grid gap-2">Recinto<Input required value={form.venueName} onChange={(e) => field("venueName",e.target.value)} /></label>
        <label className="grid gap-2">Dirección<Input required value={form.address} onChange={(e) => field("address",e.target.value)} /></label>
        <label className="grid gap-2">Ciudad<Input required value={form.city} onChange={(e) => field("city",e.target.value)} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.seatingLayout?.enabled??false} onChange={(e)=>setForm((current)=>({...current,seatingLayout:{...(current.seatingLayout??defaultSeatingLayout),enabled:e.target.checked}}))}/>Habilitar plano y selección de asientos</label>
        {form.seatingLayout?.enabled&&<div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2">Plantilla del plano<select className="min-h-10 rounded border bg-background p-2" value={form.seatingLayout.template} onChange={(e)=>setForm((current)=>({...current,seatingLayout:{...(current.seatingLayout??defaultSeatingLayout),template:e.target.value as "stadium"|"theater"|"custom"}}))}><option value="stadium">Estadio</option><option value="theater">Teatro</option><option value="custom">Personalizado</option></select></label><label className="grid gap-2">Posición del escenario<select className="min-h-10 rounded border bg-background p-2" value={form.seatingLayout.stagePosition} onChange={(e)=>setForm((current)=>({...current,seatingLayout:{...(current.seatingLayout??defaultSeatingLayout),stagePosition:e.target.value as "north"|"south"}}))}><option value="north">Norte</option><option value="south">Sur</option></select></label><p className="text-sm text-muted-foreground sm:col-span-2">Esquema configurable. Las filas y el aforo los define el organizador para cada tribuna.</p></div>}
        <label className="grid gap-2">Edad mínima<Input aria-label="Edad mínima" type="number" min="0" max="99" value={form.minimumAge??0} onChange={(e)=>setForm((current)=>({...current,minimumAge:Number(e.target.value)}))}/><small>0 indica ingreso para todas las edades.</small></label>
        <label className="grid gap-2">Condiciones de ingreso<textarea className="rounded border p-2" rows={3} maxLength={2000} value={form.entryInstructions??""} onChange={(e)=>field("entryInstructions",e.target.value)} placeholder="Documento, acompañamiento de menores, objetos restringidos…"/></label>
        <div id="event-sessions" className="grid scroll-mt-4 gap-3"><h2 className="font-semibold">3. Sesiones · hora de Perú</h2>{form.sessions.map((session,index) => <div key={index} className="grid gap-2 rounded border p-3"><label>Inicio<DateTimePicker label="Inicio" disabled={readonly||busy||Boolean(detail?.hasOrders)} required value={session.startsAt} onChange={(value) => setForm((current) => ({ ...current, sessions: current.sessions.map((item,i) => i === index ? { ...item, startsAt: value } : item) }))} /></label><label>Fin<DateTimePicker label="Fin" disabled={readonly||busy||Boolean(detail?.hasOrders)} required value={session.endsAt} onChange={(value) => setForm((current) => ({ ...current, sessions: current.sessions.map((item,i) => i === index ? { ...item, endsAt: value } : item) }))} /></label>{!readonly && form.sessions.length > 1 && <Button type="button" variant="outline" onClick={() => removeSession(index)}>Quitar sesión</Button>}</div>)}{!readonly && form.sessions.length < 30 && <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, sessions: [...current.sessions,{ startsAt:"",endsAt:"" }] }))}>Añadir sesión</Button>}</div>
        {mode !== "create" && <label className="grid gap-2">Estado<select className="min-h-10 rounded border bg-background p-2" value={form.status} onChange={(e) => field("status",e.target.value)}><option value="draft" disabled={detail?.status === "published"}>Borrador</option>{(canPublish || form.status === "published") && <option value="published">Publicado</option>}<option value="cancelled">Cancelado</option><option value="completed" disabled>Finalizado</option></select></label>}
        <h2 id="event-tickets" className="scroll-mt-4 font-semibold">4. Entradas y aforo</h2>
        <TicketTypeEditor mapEnabled={form.seatingLayout?.enabled??false} value={form.ticketTypes??[]} sessions={form.sessions} readonly={readonly||busy||Boolean(detail?.hasOrders)} onChange={(options)=>setForm((current)=>({...current,ticketTypes:options}))}/>
      </fieldset>}
      {mode !== "delete" && <div id="event-preview" className="grid scroll-mt-4 gap-3"><h2 className="font-semibold">5. Revisar configuración</h2><p className="text-sm">{form.sessions.length} sesiones · {(form.ticketTypes ?? []).length} tipos de entrada · {(form.ticketTypes ?? []).reduce((total, option) => total + (option.capacity || 0), 0)} entradas / espacios configurados</p><EventConfigurationPreview venue={form.venueName} address={form.address} city={form.city} options={form.ticketTypes ?? []} layout={form.seatingLayout}/></div>}
      {detail?.hasOrders && <p>Este evento tiene pedidos. Puedes actualizar su portada; las condiciones e inventario se conservan. Para configurar tribunas o un plano diferente, crea un evento nuevo sin pedidos.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>{readonly ? "Cerrar" : "Cancelar"}</Button>{!readonly && <Button type="submit" variant={mode === "delete" ? "destructive" : "default"} disabled={busy || Boolean(slug && !detail) || Boolean(mode==="delete"&&detail?.hasOrders)}>{busy ? "Guardando…" : mode === "delete" ? "Eliminar borrador" : "Guardar evento"}</Button>}</div>
    </form>}
  </SheetContent></Sheet>;
}


"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { EventInput, ManagedEvent } from "../eventManagement.types";
import { TicketTypeEditor } from "./TicketTypeEditor";
import { EventImage } from "./EventImage";
import { isEventImageUrl } from "../services/eventImageUrl";

export type EventEditorMode = "create" | "view" | "edit" | "delete";
const localTime = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0,16);
const isoTime = (local: string) => new Date(`${local}:00-05:00`).toISOString();
const blank: EventInput = { name: "", category: "concert", description: "", imageUrl: "", venueName: "", address: "", city: "Lima", sessions: [], status: "draft",ticketTypes:[],minimumAge:0,entryInstructions:"" };
export function EventEditorSheet({ mode, slug, canPublish, canFeature = false, onClose, onSaved }: { mode: EventEditorMode; slug?: string; canPublish: boolean; canFeature?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState<EventInput>({ ...blank, sessions: [{ startsAt: "", endsAt: "" }] });
  const [detail, setDetail] = useState<ManagedEvent>();
  const [loading, setLoading] = useState(mode !== "create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readonly = mode === "view";
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/events/${slug}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No pudimos cargar el evento");
      if (controller.signal.aborted) return;
      const event = data as ManagedEvent; setDetail(event); setForm({ name: event.name, category: event.category, description: event.description, imageUrl: event.imageUrl, venueName: event.venueName, address: event.address, city: event.city, status: event.status,featured:event.featured??false,minimumAge:event.minimumAge??0,entryInstructions:event.entryInstructions??"",ticketTypes:(event.ticketTypes??[]).map((option)=>({...option,salesStartAt:localTime(option.salesStartAt),salesEndAt:localTime(option.salesEndAt)})), sessions: event.sessions.map((session) => ({ startsAt: localTime(session.startsAt), endsAt: localTime(session.endsAt) })) });
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No pudimos cargar el evento"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);
  const field = (key: keyof Omit<EventInput,"sessions"|"ticketTypes"|"minimumAge">, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const removeSession=(index:number)=>setForm((current)=>({...current,sessions:current.sessions.filter((_,i)=>i!==index),ticketTypes:(current.ticketTypes??[]).map((option)=>({...option,sessionIndexes:option.sessionIndexes.filter((i)=>i!==index).map((i)=>i>index?i-1:i)}))}));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (readonly) return;
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
      {mode!=="delete"&&<label className="grid gap-2">Imagen de portada<Input aria-label="Imagen de portada" value={form.imageUrl} maxLength={1000} disabled={readonly||busy} placeholder="https://…" onChange={(e)=>field("imageUrl",e.target.value)}/>{form.imageUrl&&isEventImageUrl(form.imageUrl)&&<span className="relative block h-48 overflow-hidden rounded-lg"><EventImage src={form.imageUrl} alt="Vista previa de la portada" fill sizes="600px"/></span>}<small>Introduce una URL HTTPS pública o conserva la imagen actual.</small></label>}
      {canFeature && mode!=="delete" && <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured??false} disabled={readonly||busy} onChange={(e)=>setForm((current)=>({...current,featured:e.target.checked}))}/>Destacado en el hero<small className="text-muted-foreground">Visible en la web al publicarse.</small></label>}
      {mode === "delete" ? <p>¿Eliminar el borrador «{detail?.name}»? Esta acción elimina sus sesiones.</p> : <fieldset disabled={readonly || busy || Boolean(detail?.hasOrders)} className="grid gap-4">
        <label className="grid gap-2">Nombre<Input required maxLength={160} value={form.name} onChange={(e) => field("name",e.target.value)} /></label>
        <label className="grid gap-2">Categoría<select className="rounded border p-2" value={form.category} onChange={(e) => field("category",e.target.value)}>{Object.entries({ concert:"Concierto", theater:"Teatro", sports:"Deportes", festival:"Festival", conference:"Conferencia", exhibition:"Exposición", family:"Familia", comedy:"Comedia", cinema:"Cine" }).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2">Descripción<textarea className="rounded border p-2" required rows={4} maxLength={5000} value={form.description} onChange={(e) => field("description",e.target.value)} /></label>
        <label className="grid gap-2">Recinto<Input required value={form.venueName} onChange={(e) => field("venueName",e.target.value)} /></label>
        <label className="grid gap-2">Dirección<Input required value={form.address} onChange={(e) => field("address",e.target.value)} /></label>
        <label className="grid gap-2">Ciudad<Input required value={form.city} onChange={(e) => field("city",e.target.value)} /></label>
        <label className="grid gap-2">Edad mínima<Input aria-label="Edad mínima" type="number" min="0" max="99" value={form.minimumAge??0} onChange={(e)=>setForm((current)=>({...current,minimumAge:Number(e.target.value)}))}/><small>0 indica ingreso para todas las edades.</small></label>
        <label className="grid gap-2">Condiciones de ingreso<textarea className="rounded border p-2" rows={3} maxLength={2000} value={form.entryInstructions??""} onChange={(e)=>field("entryInstructions",e.target.value)} placeholder="Documento, acompañamiento de menores, objetos restringidos…"/></label>
        <div className="grid gap-3"><b>Sesiones · hora de Perú</b>{form.sessions.map((session,index) => <div key={index} className="grid gap-2 rounded border p-3"><label>Inicio<DateTimePicker label="Inicio" disabled={readonly||busy||Boolean(detail?.hasOrders)} required value={session.startsAt} onChange={(value) => setForm((current) => ({ ...current, sessions: current.sessions.map((item,i) => i === index ? { ...item, startsAt: value } : item) }))} /></label><label>Fin<DateTimePicker label="Fin" disabled={readonly||busy||Boolean(detail?.hasOrders)} required value={session.endsAt} onChange={(value) => setForm((current) => ({ ...current, sessions: current.sessions.map((item,i) => i === index ? { ...item, endsAt: value } : item) }))} /></label>{!readonly && form.sessions.length > 1 && <Button type="button" variant="outline" onClick={() => removeSession(index)}>Quitar sesión</Button>}</div>)}{!readonly && form.sessions.length < 30 && <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, sessions: [...current.sessions,{ startsAt:"",endsAt:"" }] }))}>Añadir sesión</Button>}</div>
        {mode !== "create" && <label className="grid gap-2">Estado<select className="rounded border p-2" value={form.status} onChange={(e) => field("status",e.target.value)}><option value="draft" disabled={detail?.status === "published"}>Borrador</option>{(canPublish || form.status === "published") && <option value="published">Publicado</option>}<option value="cancelled">Cancelado</option><option value="completed" disabled>Finalizado</option></select></label>}
        <TicketTypeEditor value={form.ticketTypes??[]} sessions={form.sessions} readonly={readonly||busy||Boolean(detail?.hasOrders)} onChange={(options)=>setForm((current)=>({...current,ticketTypes:options}))}/>
      </fieldset>}
      {detail?.hasOrders && <p>Este evento tiene pedidos. Puedes actualizar su portada; las condiciones e inventario se conservan.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>{readonly ? "Cerrar" : "Cancelar"}</Button>{!readonly && <Button type="submit" variant={mode === "delete" ? "destructive" : "default"} disabled={busy || Boolean(slug && !detail) || Boolean(mode==="delete"&&detail?.hasOrders)}>{busy ? "Guardando…" : mode === "delete" ? "Eliminar borrador" : "Guardar evento"}</Button>}</div>
    </form>}
  </SheetContent></Sheet>;
}


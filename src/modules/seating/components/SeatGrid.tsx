"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MapSection, SeatCoordinate } from "../types";

const key = (seat: SeatCoordinate) => JSON.stringify([seat.rowLabel.trim().toLowerCase(), seat.seatNumber]);

/** At most 8 rows × 50 seats rendered. maxSelected optionally enforces a purchase cap. */
export function SeatGrid({ section, selected, occupied, onToggle, disabled = false, maxSelected = Infinity }: {
  section: MapSection; selected: SeatCoordinate[]; occupied: SeatCoordinate[];
  onToggle?: (seat: SeatCoordinate) => void; disabled?: boolean; maxSelected?: number;
}) {
  const [rowPage, setRowPage] = useState(0);
  const [seatPage, setSeatPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const helpId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resetView = () => {
    setZoom(1);
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
  };
  const rows = section.seatRows.slice(rowPage * 8, (rowPage + 1) * 8);
  const rowPages = Math.ceil(section.seatRows.length / 8);
  const seatPages = Math.ceil(Math.max(0, ...rows.map((row) => row.seats)) / 50);
  const chosen = new Set(selected.map(key));
  const taken = new Set(occupied.map(key));
  const longestRow = Math.max(1, ...section.seatRows.map((row) => row.seats));
  return <section className="grid gap-3" aria-label={`Asientos de ${section.name}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{section.name} · {selected.length} seleccionados</h4><span className="text-xs">{Number.isFinite(maxSelected) ? `Máximo ${maxSelected}` : `${section.capacity} lugares`}</span></div>
    <div className="flex flex-wrap gap-4 text-xs"><span>🟣 Disponible</span><span>◆ Seleccionado</span><span>◻ Ocupado</span></div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Controles del plano">
      <Button type="button" size="sm" variant="outline" aria-label="Alejar plano" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>−</Button>
      <span className="w-12 text-center text-xs" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <Button type="button" size="sm" variant="outline" aria-label="Acercar plano" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>+</Button>
      <Button type="button" size="sm" variant="outline" onClick={resetView}>Restablecer vista</Button>
    </div>
    <p id={helpId} className="text-xs text-muted-foreground">Arrastra el fondo o desliza con el dedo para desplazarte. Con el plano enfocado, usa las flechas, +, − y 0 para restablecer.</p>
    <div ref={viewport} role="region" aria-label="Plano de asientos" aria-describedby={helpId} tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const movement: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
        if (movement[event.key]) {
          event.preventDefault();
          event.currentTarget.scrollLeft += movement[event.key][0];
          event.currentTarget.scrollTop += movement[event.key][1];
        } else if (event.key === "+" || event.key === "=" || event.key === "-") {
          event.preventDefault();
          setZoom((value) => Math.max(0.5, Math.min(2, value + (event.key === "-" ? -0.25 : 0.25))));
        } else if (event.key === "0") { event.preventDefault(); resetView(); }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
        event.preventDefault();
        event.currentTarget.focus();
        drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
        event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      className="max-h-96 overflow-auto rounded-xl border bg-violet-50/50 p-4 focus-visible:outline-2 focus-visible:outline-violet-700 dark:bg-violet-950/10">
      <div style={{ zoom }} className="min-w-max">
      <div className="mb-6 rounded-lg bg-zinc-900 py-2 text-center text-xs tracking-widest text-white">ESCENARIO / VISTA AL CAMPO</div>
      <div className="grid min-w-max gap-2">{rows.map((row) => <div key={row.label} className="flex items-center gap-1.5"><span className="w-10 shrink-0 text-xs font-semibold">{row.label}</span>{Array.from({ length: Math.max(0, Math.min(50, row.seats - seatPage * 50)) }, (_, index) => {
        const seat = { rowLabel: row.label, seatNumber: seatPage * 50 + index + 1 };
        const active = chosen.has(key(seat));
        const unavailable = taken.has(key(seat));
        return <button key={seat.seatNumber} type="button" aria-label={`Fila ${row.label}, asiento ${seat.seatNumber}${unavailable ? ", ocupado" : ""}`} aria-pressed={active} disabled={disabled || !onToggle || unavailable || (!active && selected.length >= maxSelected)} onClick={() => onToggle?.(seat)} className={`h-9 w-9 shrink-0 rounded-t-xl rounded-b-md border text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed ${unavailable ? "border-zinc-300 bg-zinc-200 text-zinc-500" : active ? "border-violet-950 bg-violet-950 text-white" : "border-violet-500 bg-violet-500 text-white hover:bg-violet-700 disabled:opacity-40"}`}>{seat.seatNumber}</button>;
      })}</div>)}</div>
      </div>
    </div>
    <nav aria-label="Minimapa de filas" className="grid max-h-40 gap-1 overflow-auto rounded-lg border p-2">
      <span className="text-xs font-semibold">Minimapa · elige un grupo de filas</span>
      {section.seatRows.map((row, index) => <button key={row.label} type="button" aria-label={`Ver fila ${row.label}, ${row.seats} asientos`} aria-current={Math.floor(index / 8) === rowPage ? "true" : undefined}
        onClick={() => { setRowPage(Math.floor(index / 8)); setSeatPage(0); resetView(); }} className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-violet-700">
        <span className="w-10 shrink-0">{row.label}</span>
        <span className="relative h-2 rounded bg-violet-200" style={{ width: `${row.seats / longestRow * 100}%` }}>
          {Math.floor(index / 8) === rowPage && <span className="absolute inset-y-0 rounded border border-violet-900 bg-violet-500" style={{ left: `${Math.min(row.seats, seatPage * 50) / Math.max(1, row.seats) * 100}%`, width: `${Math.max(0, Math.min(50, row.seats - seatPage * 50)) / Math.max(1, row.seats) * 100}%` }} />}
        </span><span className="shrink-0">{row.seats}</span>
      </button>)}
    </nav>
    <div className="flex flex-wrap items-center gap-2">
      {rowPages > 1 && <><Button type="button" size="sm" variant="outline" disabled={rowPage === 0} onClick={() => { setRowPage((page) => page - 1); setSeatPage(0); }}>Filas anteriores</Button><span className="text-xs">Filas {rowPage + 1}/{rowPages}</span><Button type="button" size="sm" variant="outline" disabled={rowPage + 1 >= rowPages} onClick={() => { setRowPage((page) => page + 1); setSeatPage(0); }}>Filas siguientes</Button></>}
      {seatPages > 1 && <><Button type="button" size="sm" variant="outline" disabled={seatPage === 0} onClick={() => setSeatPage((page) => page - 1)}>Asientos anteriores</Button><span className="text-xs">Asientos {seatPage * 50 + 1}–{(seatPage + 1) * 50}</span><Button type="button" size="sm" variant="outline" disabled={seatPage + 1 >= seatPages} onClick={() => setSeatPage((page) => page + 1)}>Asientos siguientes</Button></>}
    </div>
    {!!selected.length && <p className="text-sm">Seleccionados: {selected.map((seat) => `${seat.rowLabel}-${seat.seatNumber}`).join(", ")}</p>}
  </section>;
}

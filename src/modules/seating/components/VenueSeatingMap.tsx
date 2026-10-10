"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MapSection, SeatingLayout, SectionPosition } from "../types";

const positions: Record<SectionPosition, { x: number; y: number; width: number; height: number }> = {
  north: { x: 150, y: 40, width: 300, height: 85 },
  south: { x: 150, y: 295, width: 300, height: 85 },
  west: { x: 35, y: 135, width: 105, height: 150 },
  east: { x: 460, y: 135, width: 105, height: 150 },
  center: { x: 175, y: 155, width: 250, height: 115 },
};

export function VenueSeatingMap({ venueName, layout, sections, selectedSectionId, onSectionSelect }: {
  venueName: string; layout: SeatingLayout; sections: MapSection[];
  selectedSectionId?: string; onSectionSelect?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const positionFor = (section: MapSection, index: number) => section.mapPosition ?? (["north", "east", "south", "west", "center"] as const)[index % 5];
  return <section className="grid gap-3" aria-label={`Plano de ${venueName}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">{venueName || "Plano del recinto"}</h3><p className="text-xs text-muted-foreground">Selecciona una tribuna o zona · Esquema referencial</p></div>
      <div className="flex flex-wrap gap-1" aria-label="Controles del plano">
        <Button type="button" size="sm" variant="outline" aria-label="Alejar plano" onClick={() => setZoom((value) => Math.max(1, value - .25))}>−</Button>
        <Button type="button" size="sm" variant="outline" aria-label="Acercar plano" onClick={() => setZoom((value) => Math.min(2.5, value + .25))}>+</Button>
        <Button type="button" size="sm" variant="outline" aria-label="Mover plano a la izquierda" onClick={() => setPan((value) => ({ ...value, x: Math.max(-150, value.x - 30) }))}>←</Button>
        <Button type="button" size="sm" variant="outline" aria-label="Mover plano a la derecha" onClick={() => setPan((value) => ({ ...value, x: Math.min(150, value.x + 30) }))}>→</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Restablecer</Button>
      </div>
    </div>
    <div tabIndex={0} className="overflow-hidden rounded-2xl border bg-violet-50 p-2 focus-visible:outline-2 focus-visible:outline-violet-600 dark:bg-violet-950/20" aria-label="Vista del estadio. Usa flechas para desplazar y más o menos para ampliar" onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(event.key)) event.preventDefault();
      if (event.key === "+") setZoom((value) => Math.min(2.5, value + .25));
      if (event.key === "-") setZoom((value) => Math.max(1, value - .25));
      if (event.key.startsWith("Arrow")) setPan((value) => ({ x: Math.max(-150, Math.min(150, value.x + (event.key === "ArrowRight" ? 30 : event.key === "ArrowLeft" ? -30 : 0))), y: Math.max(-100, Math.min(100, value.y + (event.key === "ArrowDown" ? 30 : event.key === "ArrowUp" ? -30 : 0))) }));
    }}>
      <svg viewBox="0 0 600 420" className="mx-auto max-h-96 w-full" role="group" aria-label={`${layout.template === "stadium" ? "Estadio" : layout.template === "theater" ? "Teatro" : "Recinto"}: ${sections.length} zonas`}>
        <g transform={`translate(${300 + pan.x} ${210 + pan.y}) scale(${zoom}) translate(-300 -210)`}>
          <rect x="15" y="20" width="570" height="380" rx={layout.template === "theater" ? 24 : 140} fill="none" stroke="#ddd6fe" strokeWidth="12" />
          <rect x="155" y="135" width="290" height="150" rx="30" fill="#ede9fe" stroke="#c4b5fd" strokeDasharray="5 5" />
          {sections.map((section, index) => {
            const position = positionFor(section, index);
            const box = positions[position];
            const peers = sections.filter((item, itemIndex) => positionFor(item, itemIndex) === position);
            const peerIndex = peers.indexOf(section);
            const width = box.width / peers.length;
            const active = section.id === selectedSectionId;
            const id = section.id ?? `section-${index}`;
            return <g key={id} role="button" tabIndex={onSectionSelect ? 0 : undefined} aria-label={`${section.name}, ${section.capacity} lugares`} aria-pressed={active} className={onSectionSelect ? "cursor-pointer outline-none focus-visible:stroke-violet-950" : ""} onClick={() => onSectionSelect?.(id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSectionSelect?.(id); } }}>
              <rect x={box.x + peerIndex * width + 3} y={box.y} width={Math.max(12, width - 6)} height={box.height} rx="15" fill={active ? "#5b21b6" : "#8b5cf6"} stroke={active ? "#3b0764" : "#c4b5fd"} strokeWidth={active ? 4 : 2} />
              <text x={box.x + (peerIndex + .5) * width} y={box.y + box.height / 2 - 4} fill="white" textAnchor="middle" fontSize="12" fontWeight="600">{section.name.length > 15 ? `${section.name.slice(0, 14)}…` : section.name}</text>
              <text x={box.x + (peerIndex + .5) * width} y={box.y + box.height / 2 + 15} fill="#ede9fe" textAnchor="middle" fontSize="11">{section.capacity} lugares</text>
            </g>;
          })}
          <rect x="240" y={layout.stagePosition === "north" ? 128 : 274} width="120" height="24" rx="6" fill="#18181b" />
          <text x="300" y={layout.stagePosition === "north" ? 144 : 290} textAnchor="middle" fill="white" fontSize="10">ESCENARIO</text>
        </g>
      </svg>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section, index) => <button key={section.id ?? index} type="button" disabled={!onSectionSelect} aria-pressed={section.id === selectedSectionId} onClick={() => onSectionSelect?.(section.id ?? `section-${index}`)} className={`rounded-xl border p-3 text-left transition ${section.id === selectedSectionId ? "border-violet-600 bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100" : "hover:border-violet-400"}`}>
      <span className="block text-sm font-semibold">{section.name} · {section.zone}</span><span className="text-xs">{section.capacity} lugares · S/ {(section.priceCents / 100).toFixed(2)}{section.seatingType === "numbered" ? " · Numerados" : " · General"}</span>
    </button>)}</div>
  </section>;
}

"use client";

import { useState } from "react";
import { SeatGrid, VenueSeatingMap, defaultSeatingLayout, type SeatingLayout, type MapSection } from "@/modules/seating";
import type { TicketTypeInput } from "../eventManagement.types";

export function EventConfigurationPreview({ venue, address, city, options, layout = defaultSeatingLayout }: { venue: string; address?: string; city: string; options: (Pick<TicketTypeInput, "name" | "zone" | "seatingType" | "capacity" | "seatRows"> & Partial<Pick<TicketTypeInput,"id"|"mapPosition"|"priceCents">>)[]; layout?:SeatingLayout }) {
  const [selectedSectionId,setSelectedSectionId]=useState<string>();
  const location = [venue, address, city].filter((part) => part?.trim()).join(", ");
  const sections:MapSection[]=options.map((option,index)=>({...option,id:option.id??`section-${index}`,name:option.name||option.zone||`Zona ${index+1}`,priceCents:option.priceCents??0,mapPosition:option.mapPosition??"west"}));
  const selected=sections.find((section)=>section.id===selectedSectionId)??sections[0];
  return <section aria-label="Vista previa de ubicación y zonas" className="grid gap-4 rounded-xl border bg-muted/20 p-4">
    <h2 className="font-semibold">Ubicación y distribución</h2>
    {venue.trim() && city.trim() ? <div className="grid gap-2"><p>{location}</p><a className="text-sm underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer">Ver recinto en Google Maps</a></div> : <p className="text-sm text-muted-foreground">Completa el recinto y la ciudad para consultar su ubicación.</p>}
    {layout.enabled?<><p className="text-xs text-muted-foreground">Vista previa de configuración; no representa disponibilidad de venta ni un plano certificado del recinto.</p><VenueSeatingMap venueName={venue} layout={layout} sections={sections} selectedSectionId={selected?.id} onSectionSelect={setSelectedSectionId}/>{selected?.seatingType==="numbered"&&<SeatGrid key={selected.id} section={selected} selected={[]} occupied={[]} disabled/>}</>:<p className="text-sm text-muted-foreground">Plano deshabilitado. Las entradas se venden por zona sin selección de asientos.</p>}
    {options.map((option, index) => <article key={index} className="grid gap-2 rounded-lg border bg-background p-3"><h3 className="font-medium">{option.zone || option.name || `Zona ${index + 1}`}</h3><p className="text-sm">{option.capacity} {option.seatingType === "box" ? "espacios" : "entradas"} · {{standing: "De pie, sin asiento asignado", seated: "Asiento libre, sin numeración", numbered: "Asientos numerados", box: "Mesa o box"}[option.seatingType]}</p></article>)}
  </section>;
}

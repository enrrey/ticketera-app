"use client";

import Image from "next/image";
import { ArrowUpRight, Heart, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { getEventDateParts } from "@/lib/formatEventDate";
import { CATEGORY_META } from "../categories";
import type { Event } from "../types";

interface EventCardProps {
  event: Event;
  saved?: boolean;
  onToggleSaved?: (id: string) => void;
}

export function EventCard({ event, saved = false, onToggleSaved }: EventCardProps) {
  const date = getEventDateParts(event.date);
  return (
    <article className="event-card">
      <div className="event-artwork">
        <Image src={event.imageUrl} alt={event.title} fill sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 23vw" className="event-photo" />
        {onToggleSaved && <button className="favorite-button" aria-label={`${saved ? "Quitar" : "Guardar"} ${event.title}`} aria-pressed={saved} onClick={() => onToggleSaved(event.id)}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>}
      </div>
      <div className="event-info">
        <div className="event-topline"><span>{event.genre ?? CATEGORY_META[event.category].label}</span><span>{event.city}</span></div>
        <div className="event-title-row">
          <div><h3>{event.ticketUrl ? <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">{event.title}<span className="sr-only"> (venta oficial, abre otra pestaña)</span></a> : event.title}</h3><p className="event-tour">{event.tour}</p></div>
          {date && <time dateTime={event.date} className="date-badge" data-testid="event-date-badge"><strong>{date.day}{event.endDate && <small>–{getEventDateParts(event.endDate)?.day}</small>}</strong><span>{date.month}</span></time>}
        </div>
        <p className="event-venue"><MapPin size={13} aria-hidden="true" />{event.venue}, {event.city}</p>
        <div className="event-bottom"><span>{event.price != null ? <>Desde <strong>{formatCurrency(event.price, event.currency)}</strong></> : "Precios en la web oficial"}</span>{event.ticketUrl && <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver entradas de ${event.title} en Teleticket (abre otra pestaña)`}>Ver entradas <ArrowUpRight size={15} /></a>}</div>
      </div>
    </article>
  );
}

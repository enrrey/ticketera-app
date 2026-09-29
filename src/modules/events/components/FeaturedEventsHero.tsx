"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, AudioLines, MapPin, Pause, Play } from "lucide-react";
import type { Event } from "../types";

export function FeaturedEventsHero({ events }: { events: Event[] }) {
  const [paused, setPaused] = useState(false);
  const artists = events.filter((event) => event.city === "Lima").slice(0, 8);
  const columns = [artists.filter((_, i) => i % 2 === 0), artists.filter((_, i) => i % 2 !== 0)];

  return (
    <section className={`immersive-hero ${paused ? "is-paused" : ""}`} aria-label="Descubre conciertos en Perú">
      <div className="hero-ambient" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
      <div className="page-shell immersive-inner">
        <div className="immersive-copy">
          <p className="hero-live-label"><span /> PERÚ. MÚSICA. EN VIVO.</p>
          <h1>No es lo mismo<br />escucharlo.<br /><span>Que vivirlo.</span></h1>
          <p className="immersive-description">La piel de gallina. Tu canción a todo volumen.<br className="desktop-break" /> Ese momento en el que todo lo demás desaparece.</p>
          <div className="immersive-actions"><a href="#explorar" className="button button-coral">Encuentra tu concierto <ArrowUpRight size={20} /></a><a href="#destacados" className="hero-secondary">Ver destacados <ArrowDown size={17} /></a></div>
          <div className="hero-location"><MapPin size={15} /><span>Lima & Arequipa</span><i /><span>Oct — Dic 2026</span></div>
          <div className="hero-edition"><AudioLines size={24} /><span>TU PRÓXIMA GRAN HISTORIA<br /><strong>EMPIEZA FRENTE A UN ESCENARIO.</strong></span></div>
        </div>
        <div className="artist-wall" aria-hidden="true">
          {columns.map((column, col) => (
            <div className={`artist-column column-${col}`} key={col}>
              <div className="artist-track">
                {[0, 1].map((copy) => (
                  <div className="artist-group" key={copy}>
                    {column.map((event, index) => <div className={`artist-tile tile-${event.id}`} key={event.id}>
                      <Image src={event.imageUrl} alt="" fill sizes="(max-width: 767px) 47vw, 320px" priority={copy === 0 && index < 2} className="artist-image" />
                      <div className="artist-tile-shade" />
                      <div className="artist-tile-label"><span>{event.genre} · {event.city}</span><strong>{event.title}</strong></div>
                      <span className="artist-tile-arrow"><AudioLines size={17} /></span>
                    </div>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-floor page-shell"><span><span className="floor-cross">✳</span> MENOS SCROLL. MÁS RECUERDOS.</span><button className="motion-control" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "Reanudar animación del hero" : "Pausar animación del hero"}>{paused ? <Play size={14} /> : <Pause size={14} />}<span>{paused ? "Reanudar" : "Pausar"}</span></button><span className="reduced-motion-label">Movimiento reducido</span></div>
    </section>
  );
}


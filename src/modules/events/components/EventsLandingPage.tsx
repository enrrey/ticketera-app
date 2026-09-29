"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, CalendarDays, Check, Disc3, Guitar, MapPin, Mic2, Music2, Radio, Search, SlidersHorizontal, Sparkles, Ticket, X } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { sortEventsByDate, useEventFilters } from "../hooks/useEventFilters";
import { useEvents } from "../hooks/useEvents";
import type { Event, EventCategory } from "../types";
import { EventsGrid } from "./EventsGrid";
import { FeaturedEventsHero } from "./FeaturedEventsHero";

const genres = [
  { label: "Todos", value: "", icon: AudioLines },
  { label: "Rock", value: "Rock", icon: Guitar },
  { label: "Pop", value: "Pop", icon: Mic2 },
  { label: "Urbano", value: "Urbano", icon: Radio },
  { label: "Electrónica", value: "Electrónica", icon: Disc3 },
  { label: "Salsa", value: "Salsa", icon: Music2 },
  { label: "Reggae", value: "Reggae", icon: AudioLines },
];

export function EventsLandingPage({ initialEvents }: { initialEvents?: Event[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [city, setCity] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const { data: events = [], isLoading, isError, refetch } = useEvents(initialEvents);
  const filtered = useEventFilters(events, { searchQuery, category, genre, city, month });
  const visible = sortEventsByDate(filtered.filter((event) => !savedOnly || savedIds.includes(event.id)));
  const featured = events.filter((event) => event.featured).slice(0, 4);

  const hasFilters = Boolean(searchQuery || genre || city || month || category !== "all" || savedOnly);
  const toggleSaved = (id: string) => setSavedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const reset = () => { setSearchQuery(""); setGenre(""); setCity(""); setMonth(""); setCategory("all"); setSavedOnly(false); };
  const goToEvents = () => document.getElementById("explorar")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <a className="skip-link" href="#explorar">Saltar a conciertos</a>
      <SiteHeader searchValue={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={goToEvents} savedCount={savedIds.length} onSavedClick={() => { reset(); setSavedOnly(true); goToEvents(); }} />
      <main>
        {isLoading ? <div className="hero-loading" aria-label="Cargando conciertos" /> : <FeaturedEventsHero events={events} />}
        <div className="page-shell">
          <div className="editorial-strip"><span><Check size={15} /> Eventos con fuente oficial</span><span><MapPin size={15} /> Lima y Arequipa</span><span><CalendarDays size={15} /> Octubre — diciembre 2026</span><span className="strip-note">Hecho para vivirlo, no para contarlo.</span></div>
          <section className="featured-section" id="destacados" data-testid="featured-events-section" aria-labelledby="featured-title">
            <div className="section-heading"><div><p className="eyebrow">EN PRIMERA FILA</p><h2 id="featured-title">Grandes nombres. Grandes noches<span className="text-green">.</span></h2><p>Una selección para marcar en tu calendario.</p></div><a className="text-link" href="#explorar">Ver toda la agenda <ArrowUpRight size={17} /></a></div>
            <EventsGrid events={featured} isLoading={isLoading} savedIds={savedIds} onToggleSaved={toggleSaved} />
          </section>
        </div>
        <section className="discovery-section" id="explorar" data-testid="events-grid-section" aria-labelledby="explore-title">
          <div className="page-shell">
            <div className="section-heading"><div><p className="eyebrow">ENCUENTRA TU PLAN</p><h2 id="explore-title">¿A qué suena tu próxima salida?</h2><p>Tu música, tu ciudad, tu momento.</p></div><span className="season-label">AGENDA <b>2026</b></span></div>
            <div className="genre-list" role="group" aria-label="Género musical">{genres.map(({ label, value, icon: Icon }) => <button key={label} aria-pressed={genre === value} onClick={() => setGenre(value)} className={`genre-chip ${genre === value ? "selected" : ""}`}><Icon size={18} strokeWidth={1.6} />{label}</button>)}</div>
            <div className="filter-bar">
              <div className="catalog-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Buscar en la cartelera" placeholder="¿Qué artista quieres ver?" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
              <label className="select-filter"><MapPin size={17} /><span className="sr-only">Ciudad</span><select aria-label="Ciudad" value={city} onChange={(event) => setCity(event.target.value)}><option value="">Todo el Perú</option><option>Lima</option><option>Arequipa</option></select></label>
              <label className="select-filter"><CalendarDays size={17} /><span className="sr-only">Mes</span><select aria-label="Mes" value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Cualquier fecha</option><option value="2026-10">Octubre 2026</option><option value="2026-11">Noviembre 2026</option><option value="2026-12">Diciembre 2026</option></select></label>
            </div>
            <div className="results-toolbar"><div className="event-type-tabs" role="group" aria-label="Tipo de evento"><button aria-pressed={category === "all"} onClick={() => setCategory("all")}>Todos los eventos</button><button aria-pressed={category === "concert"} onClick={() => setCategory("concert")}>Conciertos</button><button aria-pressed={category === "festival"} onClick={() => setCategory("festival")}>Festivales</button></div><span className="sort-label"><SlidersHorizontal size={14} /> Más próximos primero</span></div>
            <div className="results-summary"><p role="status">{visible.length} {visible.length === 1 ? "evento" : "eventos"}{savedOnly ? " en tu selección de esta visita" : " para vivir en persona"}</p>{hasFilters && <button onClick={reset}><X size={14} />Limpiar filtros</button>}</div>
            {isError ? <div className="empty-state"><p>No pudimos cargar la cartelera.</p><button className="button button-green" onClick={() => refetch()}>Volver a intentar</button></div> : <EventsGrid events={visible} isLoading={isLoading} savedIds={savedIds} onToggleSaved={toggleSaved} />}
            {!isLoading && !isError && visible.length === 0 && <div className="empty-action"><p>{savedOnly ? "Toca el corazón de un concierto para añadirlo a tu selección durante esta visita." : "Prueba con otro artista, ciudad o fecha."}</p><button className="text-link" onClick={reset}>Explorar todos los conciertos <ArrowRight size={16} /></button></div>}
            <p className="catalog-note">Cartelera consultada el 28 de septiembre de 2026. Fechas y condiciones sujetas a cambios del organizador.</p>
          </div>
        </section>
        <section className="page-shell city-section" aria-labelledby="city-title"><div className="city-copy"><p className="eyebrow">LA MÚSICA NOS ACERCA</p><h2 id="city-title">El próximo recuerdo<br />puede estar en otra ciudad.</h2><p>De Lima a Arequipa, sigue a tus artistas y descubre una nueva forma de vivir el Perú.</p><button className="text-link" onClick={() => { reset(); setCity("Arequipa"); goToEvents(); }}>Descubre conciertos en Arequipa <ArrowUpRight size={17} /></button></div><div className="city-ticket"><div className="ticket-top"><span><Ticket size={17} /> TU PRÓXIMO DESTINO</span><ArrowUpRight size={23} /></div><div className="ticket-route"><div><small>SALIDA</small><strong>LIM</strong><span>Lima</span></div><div className="route-line"><span />✳<span /></div><div><small>DESTINO</small><strong>AQP</strong><span>Arequipa</span></div></div><div className="ticket-bottom"><span>MOTIVO DEL VIAJE</span><strong>Cantarlo todo.</strong><AudioLines size={35} /></div></div></section>
        <section className="how-section" id="ayuda"><div className="page-shell"><div className="section-heading"><div><p className="eyebrow">MENOS VUELTAS. MÁS MÚSICA.</p><h2>Del «quiero ir» al «ahí estaré».</h2></div><Sparkles size={28} className="text-green" /></div><div className="how-grid"><div><span className="step-number">01</span><h3>Encuentra tu concierto</h3><p>Explora por género, ciudad o fecha. La próxima gran noche tiene tu nombre.</p></div><div><span className="step-number">02</span><h3>Arma tu selección</h3><p>Guarda tus favoritos con el corazón y compara tus planes durante esta visita.</p></div><div><span className="step-number">03</span><h3>Ve a la venta oficial</h3><p>Consulta precios, zonas y disponibilidad directamente en la ticketera del evento.</p></div></div><details className="faq"><summary>¿Cómo compro mis entradas?<span>+</span></summary><p>Ticketera es una guía independiente de conciertos. El botón «Ver entradas» abre Teleticket en otra pestaña, donde puedes consultar precios y completar tu compra. No procesamos pagos ni emitimos entradas.</p></details><details className="faq"><summary>¿Dónde reviso cambios de fecha o condiciones de ingreso?<span>+</span></summary><p>En la página oficial enlazada en cada concierto. Antes de comprar, revisa la fecha, el recinto, las restricciones de edad y las condiciones del organizador. Las imágenes promocionales pertenecen a sus respectivos titulares.</p></details></div></section>
      </main>
    </>
  );
}




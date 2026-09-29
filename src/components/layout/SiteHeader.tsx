"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, Menu, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";

interface SiteHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  savedCount?: number;
  onSavedClick?: () => void;
  onSearchSubmit?: () => void;
}

export function SiteHeader({ searchValue, onSearchChange, savedCount = 0, onSavedClick, onSearchSubmit }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="page-shell header-inner">
        <Link href="/" className="brand" aria-label="Ticketera, inicio"><span className="brand-icon"><Ticket size={23} strokeWidth={2} /></span>ticketera<span className="brand-dot">.</span></Link>
        <nav className="desktop-nav" aria-label="Navegación principal">
          <a href="#explorar" className="nav-active">Descubrir</a>
          <a href="#destacados">Destacados</a>
          <a href="#ayuda">Cómo funciona <ArrowUpRight size={12} /></a>
        </nav>
        <form className="header-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearchSubmit?.(); }}>
          <button type="submit" aria-label="Ver resultados de búsqueda"><Search size={17} aria-hidden="true" /></button>
          <input type="search" aria-label="Buscar eventos, artistas, lugares" placeholder="Buscar eventos, artistas, lugares…" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
        </form>
        <button className="saved-button" onClick={onSavedClick} aria-label={`Mi selección, ${savedCount} eventos`}><Heart size={17} /><span>Mi selección</span>{savedCount > 0 && <b>{savedCount}</b>}</button>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="mobile-menu" />}><Menu /><span className="sr-only">Abrir menú</span></SheetTrigger>
          <SheetContent side="right"><SheetHeader><SheetTitle>Explora Ticketera</SheetTitle></SheetHeader><nav className="mobile-links" aria-label="Navegación móvil">{[["Descubrir conciertos", "#explorar"], ["Selección destacada", "#destacados"], ["Cómo funciona", "#ayuda"]].map(([label, href]) => <SheetClose nativeButton={false} key={href} render={<a href={href} />}>{label}<ArrowUpRight size={16} /></SheetClose>)}</nav></SheetContent>
        </Sheet>
      </div>
    </header>
  );
}


import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-shell"><div className="footer-top"><div><Link href="/" className="brand"><span className="brand-icon"><Ticket size={23} /></span>ticketera<span className="brand-dot">.</span></Link><p>La vida se vive en vivo.</p></div><nav aria-label="Enlaces del pie de página"><a href="#explorar">Explorar conciertos</a><a href="#destacados">Nuestra selección</a><a href="#ayuda">Cómo funciona</a><a href="https://teleticket.com.pe/Conciertos" target="_blank" rel="noopener noreferrer">Cartelera oficial <ArrowUpRight size={14} /></a></nav></div><div className="footer-bottom"><p>© {new Date().getFullYear()} Ticketera · Guía independiente de conciertos.</p><span>Hecho en Perú. Para vivirlo en vivo. <span className="peru-flag" aria-label="Perú">▌▌</span></span></div></div></footer>;
}


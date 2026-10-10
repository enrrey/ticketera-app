"use client";

import { SignIn } from "@clerk/nextjs";

import Link from "next/link";

import { Ticket } from "lucide-react";



export function LoginPage({ returnTo = "/" }: { returnTo?: string }) {
  const destination = ["/", "/mis-compras", "/mis-entradas", "/organizador", "/organizador/configuracion", "/organizador/metricas", "/organizador/reembolsos", "/organizador/eventos/nuevo", "/administracion/usuarios", "/validar-entradas"].includes(returnTo) ? returnTo : "/";
  return <main className="portal-auth"><Link href="/" className="brand"><span className="brand-icon"><Ticket size={22} /></span>ticketera<span className="brand-dot">.</span></Link><section aria-label="Ingresar a Ticketera"><SignIn routing="hash" withSignUp forceRedirectUrl={destination} signUpForceRedirectUrl={destination} /></section></main>;
}

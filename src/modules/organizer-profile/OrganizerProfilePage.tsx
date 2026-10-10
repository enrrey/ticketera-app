"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { organizerProfileSchema } from "./profileValidation";
import type { OrganizerProfile } from "./types";

export function OrganizerProfilePage() {
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [ruc, setRuc] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/organizer-profile", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el perfil");
      setProfile(data); setBusinessName(data.businessName); setRuc(data.ruc);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el perfil"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const input = organizerProfileSchema.safeParse({ businessName, ruc });
    if (!input.success) { setError("Ingresa un nombre de negocio y un RUC de 11 dígitos."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/organizer-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el perfil");
      setProfile(data); setBusinessName(data.businessName); setRuc(data.ruc); setMessage("Datos del negocio guardados.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil"); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">Configuración del organizador</h1>
    <Card><CardHeader><CardTitle>Datos de tu negocio</CardTitle></CardHeader><CardContent>
      <p className="mb-5 text-sm text-muted-foreground">Estos datos corresponden a tu propio negocio. El RUC se valida por formato; no implica verificación tributaria.</p>
      {loading ? <p role="status">Cargando perfil…</p> : <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><label htmlFor="business-name">Nombre del negocio</label><Input id="business-name" value={businessName} maxLength={150} required disabled={!profile || saving} onChange={(event) => setBusinessName(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="business-ruc">RUC</label><Input id="business-ruc" value={ruc} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} required disabled={!profile || saving} onChange={(event) => setRuc(event.target.value)} /></div>
        <Button type="submit" disabled={!profile || saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
      </form>}
      {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
      {message && <p role="status" className="mt-4">{message}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Stripe Connect</CardTitle></CardHeader><CardContent>
      {profile?.connect.available ? <dl className="space-y-2">
        <div><dt className="font-medium">Datos enviados</dt><dd>{profile.connect.detailsSubmitted === undefined ? "No disponible" : profile.connect.detailsSubmitted ? "Sí" : "Pendientes"}</dd></div>
        <div><dt className="font-medium">Cobros</dt><dd>{profile.connect.chargesEnabled === undefined ? "No disponible" : profile.connect.chargesEnabled ? "Habilitados" : "No habilitados"}</dd></div>
        <div><dt className="font-medium">Transferencias</dt><dd>{profile.connect.payoutsEnabled === undefined ? "No disponible" : profile.connect.payoutsEnabled ? "Habilitadas" : "No habilitadas"}</dd></div>
      </dl> : <p>Estado externo no disponible. Antes de iniciar la vinculación, confirma el país y la elegibilidad de tu negocio.</p>}
    </CardContent></Card>
  </div>;
}

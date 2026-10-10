"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedSeat } from "../types";

type HoldItem = { ticketTypeId: string; seats: SelectedSeat[] };
type Availability = { ticketTypeId: string; occupied: SelectedSeat[] }[];
type AvailabilityResponse = { availability: Availability; own: { items: HoldItem[]; expiresAt: string | null } | null; serverTime: string };
type HoldResponse = { holdToken: string; expiresAt: string | null; serverTime: string; items: HoldItem[] };

export function useSeatHolds(eventId: string, enabled: boolean) {
  const [selections, setSelections] = useState<Record<string, SelectedSeat[]>>({});
  const [availability, setAvailability] = useState<Availability>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const mounted = useRef(false);
  const offset = useRef<number | null>(null);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const storageKey = `ticketera:seat-hold:${eventId}`;
  const url = `/api/checkout/seats/${encodeURIComponent(eventId)}`;
  function storeToken(value: string | null) {
    token.current = value;
    setHoldToken(value);
    try { if (value) sessionStorage.setItem(storageKey, value); else sessionStorage.removeItem(storageKey); } catch { /* Optional in restricted browsers. */ }
  }
  const applyOwn = useCallback((items: HoldItem[], expiry: string | null, serverTime: string) => {
    const serverNow = Date.parse(serverTime);
    // Keep the calibrated clock stable: a delayed read must not extend a lease.
    if (offset.current === null) offset.current = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
    const end = expiry ? Date.parse(expiry) : null;
    const seconds = end ? Math.min(60, Math.max(0, Math.ceil((end - Date.now() - offset.current) / 1000))) : 0;
    setExpiresAt(end); setRemaining(seconds);
    setSelections(seconds > 0 ? Object.fromEntries(items.map((item) => [item.ticketTypeId, item.seats])) : {});
  }, []);
  const refresh = useCallback(async () => {
    if (!enabled || pending.current) return;
    const version = generation.current;
    const read = ++readSequence.current;
    try {
      const response = await fetch(url, { cache: "no-store", headers: token.current ? { "x-seat-hold-token": token.current } : {} });
      if (!response.ok) throw new Error();
      const body: AvailabilityResponse = await response.json();
      if (!mounted.current || version !== generation.current || read !== readSequence.current || pending.current) return;
      setHoldToken(token.current);
      setAvailability(body.availability);
      applyOwn(body.own?.items ?? [], body.own?.expiresAt ?? null, body.serverTime);
      setReady(true); setError(null);
    } catch { if (mounted.current && version === generation.current && read === readSequence.current) { setReady(false); setError("No pudimos actualizar los asientos. Intenta nuevamente."); } }
  }, [enabled, url, applyOwn]);
  useEffect(() => {
    mounted.current = true;
    try { token.current = sessionStorage.getItem(storageKey); } catch { token.current = null; }
    if (enabled) void refresh();
    const poll = enabled ? setInterval(() => { void refresh(); }, 5000) : undefined;
    return () => { mounted.current = false; invalidate(); if (poll) clearInterval(poll); };
  }, [enabled, refresh, storageKey, invalidate]);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const seconds = Math.min(60, Math.max(0, Math.ceil((expiresAt - Date.now() - (offset.current ?? 0)) / 1000)));
      setRemaining(seconds);
      if (seconds === 0) { setSelections({}); setExpiresAt(null); setError("El bloqueo de 60 segundos venció. Selecciona tus asientos nuevamente."); }
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [expiresAt]);
  async function replace(next: Record<string, SelectedSeat[]>) {
    if (pending.current || !enabled) return;
    pending.current = true; setBusy(true); setError(null);
    const version = ++generation.current;
    const items = Object.entries(next).filter(([, seats]) => seats.length).map(([ticketTypeId, seats]) => ({ ticketTypeId, seats }));
    try {
      const response = await fetch(url, { method: items.length ? "POST" : "DELETE", headers: { ...(items.length ? { "Content-Type": "application/json" } : {}), ...(token.current ? { "x-seat-hold-token": token.current } : {}) }, ...(items.length ? { body: JSON.stringify({ items }) } : {}) });
      if (!response.ok) throw new Error(response.status === 409 ? "Otro comprador bloqueó ese asiento. El mapa se ha actualizado." : "No pudimos bloquear los asientos. Intenta nuevamente.");
      if (!mounted.current || version !== generation.current) return;
      if (items.length) {
        const body: HoldResponse = await response.json();
        storeToken(body.holdToken); applyOwn(body.items, body.expiresAt, body.serverTime);
      } else { setSelections({}); setExpiresAt(null); setRemaining(0); storeToken(null); }
      setReady(true);
    } catch (failure) {
      if (mounted.current && version === generation.current) {
        pending.current = false;
        await refresh();
        setError(failure instanceof Error ? failure.message : "No pudimos bloquear los asientos.");
      }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return { selections, availability, busy, ready, error, remaining,
    holdToken: remaining > 0 ? holdToken : null,
    confirmed: ready && !busy && (Object.values(selections).every((seats) => !seats.length) || remaining > 0),
    change: (ticketTypeId: string, seats: SelectedSeat[]) => replace({ ...selections, [ticketTypeId]: seats }),
    renew: () => replace(selections), refresh,
  };
}

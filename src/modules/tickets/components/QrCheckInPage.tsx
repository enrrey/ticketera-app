"use client";

import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CheckInEvent, CheckInResult } from '../checkIn.types';

const resultCodes = ['accepted', 'already_used', 'invalid', 'refunded', 'event_cancelled'];

export function QrCheckInPage({ events }: { events: CheckInEvent[] }) {
  const [slug, setSlug] = useState(events[0]?.slug ?? '');
  const [credential, setCredential] = useState('');
  const [result, setResult] = useState<CheckInResult>();
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const [camera, setCamera] = useState(false);
  const [opening, setOpening] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const generationRef = useRef(0);
  const submittingRef = useRef(false);
  const openingRef = useRef(false);
  const mountedRef = useRef(true);
  const event = events.find(item => item.slug === slug);

  function releaseVideo(video: HTMLVideoElement | null) {
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (video) video.srcObject = null;
  }

  function stopCamera() {
    generationRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    releaseVideo(videoRef.current);
    if (mountedRef.current) setCamera(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      controlsRef.current?.stop();
      controlsRef.current = null;
      releaseVideo(video);
    };
  }, []);

  async function submit(value: string) {
    if (submittingRef.current || !event || !value.trim()) return;
    submittingRef.current = true;
    stopCamera();
    setCredential(value);
    setPending(true);
    setResult(undefined);
    setError('');
    setUncertain(false);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/check-in`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: value }),
      });
      const body = await response.json();
      if (!mountedRef.current) return;
      if ((response.status === 200 || response.status === 409) && resultCodes.includes(body.code) && typeof body.message === 'string') {
        setResult(body as CheckInResult);
      } else if ([401, 403, 503].includes(response.status)) {
        setError(typeof body.error === 'string' ? body.error : 'No se pudo validar la entrada. Reintenta cuando el servicio esté disponible.');
      } else {
        throw new Error('Unknown response');
      }
    } catch {
      if (mountedRef.current) {
        setUncertain(true);
        setError('No pudimos confirmar el resultado. Reintenta la confirmación con el mismo código; la entrada podría haberse registrado.');
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }

  async function startCamera() {
    if (!event || submittingRef.current || openingRef.current || camera) return;
    const video = videoRef.current;
    if (!video) return;
    const generation = ++generationRef.current;
    openingRef.current = true;
    setOpening(true);
    setCamera(true);
    setError('');
    setResult(undefined);
    setUncertain(false);
    let read = false;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (generation !== generationRef.current) return;
      const controls = await new BrowserQRCodeReader().decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (decoded, _error, scannerControls) => {
          if (!decoded || read || generation !== generationRef.current) return;
          read = true;
          scannerControls.stop();
          void submit(decoded.getText());
        },
      );
      if (generation !== generationRef.current) {
        controls.stop();
        releaseVideo(video);
      } else {
        controlsRef.current = controls;
      }
    } catch (cause) {
      if (generation === generationRef.current && mountedRef.current) {
        stopCamera();
        const denied = typeof cause === 'object' && cause !== null && 'name' in cause && (cause.name === 'NotAllowedError' || cause.name === 'PermissionDeniedError');
        setError(denied ? 'Permiso de cámara denegado. Puedes ingresar el código manualmente.' : 'No pudimos abrir la cámara. Puedes ingresar el código manualmente.');
      }
      releaseVideo(video);
    } finally {
      openingRef.current = false;
      if (mountedRef.current) setOpening(false);
    }
  }

  const color = result?.code === 'accepted'
    ? 'border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
    : result?.code === 'already_used'
      ? 'border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
      : 'border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100';

  return <section className="mx-auto grid w-full max-w-3xl gap-6" aria-label="Check-in de entradas">
    <header><h1 className="text-2xl font-semibold">Check-in de entradas</h1><p className="text-muted-foreground">Selecciona el evento y valida cada entrada al ingresar.</p></header>
    {!events.length ? <p role="status">No tienes eventos disponibles para realizar check-in.</p> : <>
      <div className="grid gap-2"><label htmlFor="check-in-event" className="font-medium">Evento</label>
        <select id="check-in-event" value={slug} disabled={pending} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={change => {
          stopCamera();
          setSlug(change.target.value);
          setCredential('');
          setResult(undefined);
          setError('');
          setUncertain(false);
        }}>{events.map(item => <option key={item.slug} value={item.slug}>{item.name}{item.status === 'cancelled' ? ' (Cancelado)' : ''}</option>)}</select>
      </div>
      <div className="grid gap-3 rounded-xl border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Escanear QR</h2>
        <p className="text-sm text-muted-foreground">La cámara lee el QR en este dispositivo. El video no se envía al servidor.</p>
        <video ref={videoRef} hidden={!camera} muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" aria-label="Vista de la cámara" />
        {camera ? <Button type="button" variant="outline" className="h-10 w-full sm:w-fit" onClick={stopCamera}>Detener cámara</Button> : <Button type="button" className="h-10 w-full sm:w-fit" disabled={pending || opening || !event} onClick={() => void startCamera()}>{opening ? 'Cerrando cámara…' : 'Activar cámara'}</Button>}
      </div>
      <form className="grid gap-3 rounded-xl border p-4 sm:p-6" onSubmit={submitEvent => { submitEvent.preventDefault(); void submit(credential); }}>
        <label htmlFor="check-in-credential" className="font-semibold">Código de la entrada</label>
        <p className="text-sm text-muted-foreground">Si no puedes usar la cámara, pega el contenido del QR.</p>
        <Input id="check-in-credential" className="h-10" value={credential} onChange={change => setCredential(change.target.value)} disabled={pending} autoComplete="off" spellCheck={false} placeholder="Pega el código QR" />
        <Button type="submit" className="h-10 w-full sm:w-fit" disabled={pending || !event || !credential.trim()}>{pending ? 'Validando…' : uncertain ? 'Reintentar confirmación' : 'Validar entrada'}</Button>
      </form>
      {pending && <p role="status">Esperando confirmación del servidor…</p>}
      {result && <div role="status" className={`rounded-xl border p-4 ${color}`}><p className="font-semibold">{result.code === 'accepted' ? 'Ingreso registrado' : result.code === 'already_used' ? 'Entrada ya utilizada' : 'Ingreso rechazado'}</p><p>{result.message}</p>{result.checkedAt && <p className="text-sm">Registrado: {new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.checkedAt))}</p>}</div>}
      {error && <p role="alert" className="rounded-xl border p-4">{error}</p>}
    </>}
  </section>;
}

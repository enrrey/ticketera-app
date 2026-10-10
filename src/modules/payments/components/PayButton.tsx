"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readOrderToken, startPayment } from "../services/paymentClient";

export function PayButton({ orderId, token, disabled = false, navigate = (url) => window.location.assign(url) }: { orderId: string; token?: string | null; disabled?: boolean; navigate?: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    if (busy || disabled) return;
    setBusy(true); setError(null);
    try { navigate(await startPayment(orderId, token ?? readOrderToken(orderId))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos iniciar el pago. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-2">
    <Button type="button" disabled={busy || disabled} onClick={pay}>{busy ? "Abriendo pago seguro…" : "Pagar con Stripe"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

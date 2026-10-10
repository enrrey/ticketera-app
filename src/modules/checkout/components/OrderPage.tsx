"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readOrderToken } from "@/modules/payments";
import { loadCheckout } from "../services/checkoutClient";
import type { CheckoutSummary } from "../types";
import { OrderSummary } from "./OrderSummary";

type State = { kind: "loading" } | { kind: "ready"; summary: CheckoutSummary } | { kind: "missing" } | { kind: "error" };

export function OrderPage({ orderId, outcome }: { orderId: string; outcome?: "exito" | "cancelado" | "fallido" }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reads = 0;
    async function refresh() {
      const result = await loadCheckout(orderId, readOrderToken(orderId));
      if (!active) return;
      if (result.ok) {
        setState({ kind: "ready", summary: result.data });
        if (result.data.status === "pending" && outcome === "exito" && ++reads < 30) timer = setTimeout(refresh, 2000);
      } else setState({ kind: result.status === 404 ? "missing" : "error" });
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, outcome]);

  return (
    <main className="page-shell grid gap-6 py-10">
      <Link href="/" className="text-sm underline">Volver a eventos</Link>
      {outcome === "exito" && state.kind === "ready" && state.summary.status === "pending" && <p role="status">Estamos verificando el pago. La confirmación aparecerá cuando Stripe la notifique. Puedes volver a cargar esta página.</p>}
      {outcome === "cancelado" && state.kind === "ready" && state.summary.status === "pending" && <p>Volviste del pago. Puedes reintentarlo mientras tu reserva esté vigente.</p>}
      {outcome === "fallido" && state.kind === "ready" && state.summary.status === "pending" && <p>No se pudo completar el pago. Puedes reintentarlo mientras tu reserva esté vigente.</p>}
      {state.kind === "loading" && <p role="status">Cargando tu pedido…</p>}
      {state.kind === "ready" && <OrderSummary summary={state.summary} accessToken={readOrderToken(orderId)??undefined} />}
      {state.kind === "missing" && <p role="alert">No encontramos este pedido. Revisa el enlace o inicia sesión con la cuenta con la que compraste.</p>}
      {state.kind === "error" && <p role="alert">No pudimos cargar tu pedido. Inténtalo de nuevo en unos minutos.</p>}
    </main>
  );
}

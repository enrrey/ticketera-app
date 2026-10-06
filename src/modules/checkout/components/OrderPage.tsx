"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadCheckout } from "../services/checkoutClient";
import type { CheckoutSummary } from "../types";
import { OrderSummary } from "./OrderSummary";

type State = { kind: "loading" } | { kind: "ready"; summary: CheckoutSummary } | { kind: "missing" } | { kind: "error" };

/** Reads the guest access token from the URL fragment, which browsers never send to servers or in Referer. */
function tokenFromHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t");
}

export function OrderPage({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    loadCheckout(orderId, tokenFromHash()).then((result) => {
      if (!active) return;
      if (result.ok) setState({ kind: "ready", summary: result.data });
      else setState({ kind: result.status === 404 ? "missing" : "error" });
    });
    return () => { active = false; };
  }, [orderId]);

  return (
    <main className="page-shell grid gap-6 py-10">
      <Link href="/" className="text-sm underline">Volver a eventos</Link>
      {state.kind === "loading" && <p role="status">Cargando tu pedido…</p>}
      {state.kind === "ready" && <OrderSummary summary={state.summary} />}
      {state.kind === "missing" && <p role="alert">No encontramos este pedido. Revisa el enlace o inicia sesión con la cuenta con la que compraste.</p>}
      {state.kind === "error" && <p role="alert">No pudimos cargar tu pedido. Inténtalo de nuevo en unos minutos.</p>}
    </main>
  );
}

import type { CheckoutErrorBody, CheckoutSummary, CreatedCheckout } from "../types";

export type CheckoutRequest = {
  eventId: string;
  seatHoldToken?: string;
  items: { ticketTypeId: string; quantity: number; seats?: { rowLabel: string; seatNumber: number }[] }[];
  buyer: { email: string; name: string };
  acceptedTerms?:true;
  termsVersion?:'2026-10-09';
};

export type CheckoutResult<T> = { ok: true; data: T } | { ok: false; status: number; error: CheckoutErrorBody };

async function readBody<T>(response: Response): Promise<CheckoutResult<T>> {
  const body = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: body as T };
  return { ok: false, status: response.status, error: (body as CheckoutErrorBody | null) ?? { error: "No pudimos completar la operación" } };
}

const unreachable = { ok: false, status: 0, error: { error: "No pudimos conectar con el servidor. Revisa tu conexión." } } as const;

export async function submitCheckout(request: CheckoutRequest): Promise<CheckoutResult<CreatedCheckout>> {
  try {
    return await readBody<CreatedCheckout>(await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    }));
  } catch {
    return unreachable;
  }
}

export async function loadCheckout(orderId: string, token: string | null): Promise<CheckoutResult<CheckoutSummary>> {
  try {
    return await readBody<CheckoutSummary>(await fetch(`/api/checkout/${encodeURIComponent(orderId)}`, {
      headers: token ? { "x-order-token": token } : {}, cache: "no-store",
    }));
  } catch {
    return unreachable;
  }
}

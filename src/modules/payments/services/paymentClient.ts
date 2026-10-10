export function readOrderToken(orderId: string) {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t");
  if (fragment) return fragment;
  try { return window.sessionStorage.getItem(`ticketera:order:${orderId}`); } catch { return null; }
}

export async function startPayment(orderId: string, token: string | null) {
  const response = await fetch(`/api/checkout/${encodeURIComponent(orderId)}/payment`, {
    method: "POST", headers: token ? { "x-order-token": token } : {}, cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No pudimos iniciar el pago");
  const url = new URL(body.url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("No pudimos abrir el pago seguro");
  if (token) window.sessionStorage.setItem(`ticketera:order:${orderId}`, token);
  return url.toString();
}

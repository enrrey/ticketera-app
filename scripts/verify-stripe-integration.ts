import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createStripeGateway, getStripeClient } from "../src/modules/payments/services/stripeClient";

config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "")) throw new Error("Esta verificación solo permite claves de prueba");
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== "acct_1ULZrh0RxQwFKGJe") throw new Error("La cuenta configurada no coincide con Ticketera");
  const gateway = createStripeGateway(stripe);
  const orderId = randomUUID();
  const session = await gateway.createSession({ orderId, paymentId: randomUUID(), idempotencyKey: `ticketera:integration-check:${orderId}`, amountCents: 1000, currency: "pen", buyerEmail: "stripe-validation@example.com", appUrl: new URL(process.env.APP_URL ?? "http://localhost:3000").origin });
  try {
    if (session.livemode || session.amountCents !== 1000 || session.currency !== "pen") throw new Error("La sesión de prueba no es válida");
    const canonical = await stripe.checkout.sessions.retrieve(session.id);
    if (!canonical.invoice_creation?.enabled) throw new Error("No se configuró el comprobante postpago");
    console.log(JSON.stringify({ account: account.id, testMode: true, currency: session.currency, invoiceCreation: true, charged: false }));
  } finally {
    const closed = await gateway.expireSession(session.id);
    if (closed.status !== "expired") throw new Error("No se pudo cerrar la sesión de verificación");
    console.log(JSON.stringify({ sessionClosed: true, databaseOrdersCreated: 0 }));
  }
}
main().catch(() => { console.error("No se pudo verificar Stripe. Revisa las credenciales de prueba y permisos sin compartirlas."); process.exitCode = 1; });

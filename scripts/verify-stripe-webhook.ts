import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { getStripeClient } from "../src/modules/payments/services/stripeClient";

config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "") || !process.env.PAYMENT_JOBS_SECRET || !process.env.DATABASE_URL) throw new Error("Falta configuración de pruebas");
  const stripe = getStripeClient();
  if ((await stripe.accounts.retrieve(null)).id !== "acct_1ULZrh0RxQwFKGJe") throw new Error("Cuenta de prueba inesperada");
  const customer = await stripe.customers.create({ name: "PRUEBA · canal webhook Ticketera", description: "Cliente temporal sin correo ni cobros; se elimina al verificar el listener." }, { idempotencyKey: `ticketera:webhook-check:${randomUUID()}` });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    let received = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const { rows } = await pool.query("select id from webhook_event where provider='stripe' and type='customer.created' and object_id=$1", [customer.id]);
      if (rows.length) { received = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!received) throw new Error("No llegó el evento al inbox local");
    const response = await fetch(`${new URL(process.env.APP_URL ?? "http://localhost:3000").origin}/api/internal/payment-jobs`, { method: "POST", headers: { authorization: `Bearer ${process.env.PAYMENT_JOBS_SECRET}` }, signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error("No respondió el procesador");
    const { rows } = await pool.query("select status from webhook_event where provider='stripe' and type='customer.created' and object_id=$1", [customer.id]);
    if (rows[0]?.status !== "processed") throw new Error("El inbox no terminó el evento");
    const counts = await pool.query('select (select count(*)::int from "order") as orders, (select count(*)::int from payment) as payments, (select count(*)::int from ticket) as tickets');
    console.log(JSON.stringify({ webhookReceived: true, signatureVerified: true, inboxProcessed: true, charged: false, counts: counts.rows[0] }));
  } finally {
    await pool.end();
    await stripe.customers.del(customer.id);
  }
}
main().catch(() => { console.error("No se pudo verificar el canal webhook. Revisa listener, servidor y configuración; no compartas secretos."); process.exitCode = 1; });

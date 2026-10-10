import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  if (!process.env.PAYMENT_JOBS_SECRET) throw new Error("Falta PAYMENT_JOBS_SECRET");
  const response = await fetch(`${new URL(process.env.APP_URL ?? "http://localhost:3000").origin}/api/internal/payment-jobs`, {
    method: "POST", headers: { authorization: `Bearer ${process.env.PAYMENT_JOBS_SECRET}` }, signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Las tareas respondieron ${response.status}`);
  console.log(JSON.stringify(await response.json()));
}
async function run() {
  try { await main(); }
  catch { console.error("No se pudieron procesar las tareas de pagos. Revisa el servidor y la configuración."); if (!process.argv.includes("--watch")) process.exitCode = 1; }
}
async function start() {
  await run();
  if (process.argv.includes("--watch")) {
    // One batch at a time, with no overlapping requests if Stripe is slow.
    while (true) { await new Promise((resolve) => setTimeout(resolve, 60_000)); await run(); }
  }
}
void start();

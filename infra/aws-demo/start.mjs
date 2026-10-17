import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateDemoEnvironment(env) {
  for (const name of ["CLERK_SECRET_KEY", "STRIPE_SECRET_KEY"]) {
    if (!env[name]?.startsWith("sk_test_")) throw new Error(`${name}: se requiere una clave de sandbox`);
  }
  for (const name of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
    if (!env[name]?.startsWith("pk_test_")) throw new Error(`${name}: se requiere una clave de sandbox`);
  }
  if (!/^[a-f0-9]{64}$/i.test(env.QR_SIGNING_SECRET ?? "")) throw new Error("QR_SIGNING_SECRET: configuración inválida");
  let app, database;
  try { app = new URL(env.APP_URL); database = new URL(env.DATABASE_URL); }
  catch { throw new Error("APP_URL o DATABASE_URL: configuración inválida"); }
  if (app.protocol !== "https:" || app.username || app.password) throw new Error("APP_URL: se requiere HTTPS sin credenciales");
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("DATABASE_URL: se requiere PostgreSQL de demostración");
  return { ...env, NOTIFICATIONS_ENABLED: "false" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = validateDemoEnvironment(process.env);
    mkdirSync("/tmp/ticketera-cache", { recursive: true });
    const child = spawn(process.execPath, ["server.js"], { env, stdio: "inherit" });
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
    child.on("error", () => { console.error("No se pudo iniciar Ticketera demo"); process.exitCode = 1; });
    child.on("exit", code => { process.exitCode = code ?? 1; });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

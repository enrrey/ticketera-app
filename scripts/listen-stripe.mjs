import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
const key = process.env.STRIPE_SECRET_KEY;
if (!/^(sk|rk)_test_/.test(key ?? "")) throw new Error("El listener local requiere la clave de prueba configurada");
// Use this project's key and a temporary CLI configuration; do not change the user's other Stripe account.
const directory = mkdtempSync(join(tmpdir(), "ticketera-stripe-"));
const listener = spawn("stripe", ["--config", join(directory, "config.toml"), "listen", "--forward-to", `${new URL(process.env.APP_URL ?? "http://localhost:3000").origin}/api/webhooks/stripe`], {
  env: { ...process.env, STRIPE_API_KEY: key }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
const redact = (line) => line.replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, "[secreto oculto]");
function processLine(line) {
  const secret = line.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if (secret) {
    let existing = "";
    try { existing = readFileSync(".env.local", "utf8"); } catch { /* First local override. */ }
    const entry = `STRIPE_WEBHOOK_SECRET=${secret}`;
    writeFileSync(".env.local", /^STRIPE_WEBHOOK_SECRET=.*$/m.test(existing) ? existing.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, entry) : `${existing}\n${entry}\n`);
    console.log("Listener de Stripe conectado; signing secret actualizado en .env.local sin mostrarlo.");
  }
  if (line.trim()) console.log(redact(line));
}
for (const stream of [listener.stdout, listener.stderr]) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  });
  stream.on("end", () => { if (buffer) processLine(buffer); });
}
listener.on("error", () => { console.error("No se pudo iniciar Stripe CLI; verifica que esté instalado."); process.exitCode = 1; });
listener.on("exit", (code) => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => { listener.kill(); });
process.on("SIGTERM", () => { listener.kill(); });

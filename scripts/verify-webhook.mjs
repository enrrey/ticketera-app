import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import Stripe from "stripe";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });
const eventId = `evt_local_verification_${randomUUID()}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpoint = "http://localhost:3000/api/webhooks/stripe";
const payload = JSON.stringify({ id: eventId, object: "event", type: "payment_intent.succeeded", created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { id: "pi_local_verification", object: "payment_intent" } } });
const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
try {
  await client.connect();
  const unsigned = await fetch(endpoint, { method: "POST", body: payload, signal: AbortSignal.timeout(60_000) });
  assert.equal(unsigned.status, 400, "Unsigned request must be rejected");
  for (const duplicate of [false, true]) {
    const response = await fetch(endpoint, { method: "POST", body: payload, headers: { "stripe-signature": signature }, signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, "Signed request must be durably received");
    assert.deepEqual(await response.json(), { received: true, duplicate });
  }
  const saved = await client.query("select status from webhook_event where provider='stripe' and external_event_id=$1", [eventId]);
  assert.deepEqual(saved.rows, [{ status: "pending" }]);
  console.log("HTTP signature verification, database persistence and duplicate delivery: passed.");
} catch (error) {
  console.error("Webhook verification failed:", error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally {
  // Remove only this script's synthetic event; no orders or Stripe resources are created.
  try { await client.query("delete from webhook_event where provider='stripe' and external_event_id=$1", [eventId]); } catch { /* Connection may not have opened. */ }
  await client.end();
}

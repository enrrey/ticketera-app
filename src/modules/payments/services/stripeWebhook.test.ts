// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { handleStripeWebhook } from "./stripeWebhook";

const secret = "whsec_test_local_only";
const stripe = new Stripe("sk_test_local_only");
const payload = JSON.stringify({
  id: "evt_test", object: "event", type: "payment_intent.succeeded", livemode: false,
  created: Math.floor(Date.now() / 1000), data: { object: { id: "pi_test", object: "payment_intent" } },
});
function request(body = payload, signingSecret = secret) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST", body,
    headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret }) },
  });
}
afterEach(() => vi.unstubAllEnvs());

describe("Stripe webhook", () => {
  it("rejects forged signatures before touching persistence", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const save = vi.fn();
    expect((await handleStripeWebhook(request(payload, "whsec_wrong"), save)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it("persists a verified event reference without buyer or card data", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const saved: unknown[] = [];
    const response = await handleStripeWebhook(request(), async (event) => { saved.push(event); return true; });
    expect(response.status).toBe(200);
    expect(saved).toEqual([expect.objectContaining({ externalEventId: "evt_test", objectId: "pi_test", type: "payment_intent.succeeded", status: "pending", provider: "stripe", livemode: false })]);
    expect(saved[0]).not.toHaveProperty("data");
    expect(await response.json()).toEqual({ received: true, duplicate: false });
  });
  it("acknowledges an already persisted delivery", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const response = await handleStripeWebhook(request(), async () => false);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
  });
  it("returns a retryable error if persistence fails", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    expect((await handleStripeWebhook(request(), async () => { throw new Error("DB unavailable"); })).status).toBe(503);
  });
  it("fails closed when webhook configuration is missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await handleStripeWebhook(request(), async () => true)).status).toBe(503);
  });
  it("rejects an unsigned request", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    expect((await handleStripeWebhook(new Request("http://localhost", { method: "POST", body: payload }), async () => true)).status).toBe(400);
  });
  it("rejects a body changed after signing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const modified = new Request("http://localhost", { method: "POST", body: payload.replace("pi_test", "pi_tampered"), headers: { "stripe-signature": signature } });
    expect((await handleStripeWebhook(modified, async () => true)).status).toBe(400);
  });
});

// @vitest-environment node
import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStripeGateway } from "./stripeClient";

afterEach(() => vi.unstubAllEnvs());
describe("canonical Stripe adapter", () => {
  it('creates an Elements session with private client secret and preserves server invoice settings',async()=>{
    const stripe=new Stripe('sk_test_placeholder');
    const create=vi.spyOn(stripe.checkout.sessions,'create').mockResolvedValue({id:'cs_test',client_secret:'cs_test_secret_private',metadata:{payment_id:'p'},client_reference_id:'o',status:'open',payment_status:'unpaid',amount_total:1000,currency:'pen',livemode:false,url:null} as never);
    const session=await createStripeGateway(stripe).createSession({paymentId:'a1234567',orderId:'o',amountCents:1000,currency:'pen',buyerEmail:'test@example.com',appUrl:'http://localhost:3000',idempotencyKey:'stable',uiMode:'elements'});
    expect(session.clientSecret).toBe('cs_test_secret_private');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ui_mode:'elements',return_url:'http://localhost:3000/pedidos/o/pago/exito?session_id={CHECKOUT_SESSION_ID}',invoice_creation:expect.objectContaining({enabled:true})}),{idempotencyKey:'stable'});
    const params=create.mock.calls[0][0];expect(params).not.toHaveProperty('success_url');expect(params).not.toHaveProperty('cancel_url');expect(params).not.toHaveProperty('payment_method_types');
  });
  it("normalizes a canceled Stripe refund to the database state without creating another refund", async () => {
    const stripe = new Stripe("sk_test_placeholder");
    vi.spyOn(stripe.refunds, "retrieve").mockResolvedValue({ id: "re_test", payment_intent: "pi_test", amount: 1000, status: "canceled" } as never);
    const create = vi.spyOn(stripe.refunds, "create");
    expect(await createStripeGateway(stripe).refund("pi_test", 1000, "key", "re_test")).toEqual({ id: "re_test", amountCents: 1000, status: "cancelled" });
    expect(create).not.toHaveBeenCalled();
  });
  it("uses the success event timestamp rather than Charge.created or webhook arrival", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
    const stripe = new Stripe("sk_test_placeholder");
    vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue({ id: "cs_test", metadata: { payment_id: "p" }, client_reference_id: "o", status: "complete", payment_status: "paid", amount_total: 1000, currency: "pen", livemode: false, payment_intent: { id: "pi_test", status: "succeeded", created: 100, amount_received: 1000, currency: "pen", latest_charge: { id: "ch_test", created: 100 } } } as never);
    const list = vi.spyOn(stripe.events, "list").mockReturnValue({ async *[Symbol.asyncIterator]() { yield { created: 400, data: { object: { id: "pi_test" } } }; } } as never);
    const result = await createStripeGateway(stripe).readSession("cs_test", { id: "evt_checkout", type: "checkout.session.completed", objectId: "cs_test", livemode: false, paidAt: new Date(900_000) });
    expect(result.intent?.paidAt).toEqual(new Date(400_000));
    expect(list).toHaveBeenCalled();
  });
  it("will not fulfill until a canonical completion timestamp is available", async () => {
    const stripe = new Stripe("sk_test_placeholder");
    vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue({ id: "cs_test", metadata: {}, status: "complete", payment_status: "paid", amount_total: 1000, currency: "pen", payment_intent: { id: "pi_test", status: "succeeded", created: 100, amount_received: 1000, currency: "pen", latest_charge: { id: "ch_test" } } } as never);
    vi.spyOn(stripe.events, "list").mockReturnValue({ async *[Symbol.asyncIterator]() {} } as never);
    await expect(createStripeGateway(stripe).readSession("cs_test")).rejects.toThrow("completion timestamp");
  });
});

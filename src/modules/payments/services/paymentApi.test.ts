// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCreatePayment, handlePaymentJobs } from "./paymentApi";
import { PaymentError } from "../types";

afterEach(() => vi.unstubAllEnvs());
describe("payment handlers", () => {
  it("rejects foreign origins and inactive users before creating a payment", async () => {
    const create = vi.fn();
    expect((await handleCreatePayment(new Request("http://localhost:3000/api/pay", { method: "POST", headers: { origin: "https://other.example" } }), "o", { create })).status).toBe(403);
    expect((await handleCreatePayment(new Request("http://localhost:3000/api/pay", { method: "POST", headers: { origin: "http://localhost:3000" } }), "o", { create, getMember: async () => ({ id: "u", status: "inactive" }) })).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
  it("forwards access proof without accepting client amounts and returns generic failures", async () => {
    const request = () => new Request("http://localhost:3000/api/pay", { method: "POST", headers: { origin: "http://localhost:3000", "x-order-token": "secret" }, body: '{"amountCents":1}' });
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com" });
    expect((await handleCreatePayment(request(), "o", { create, getMember: async () => null })).status).toBe(200);
    expect(create).toHaveBeenCalledWith("o", { userId: null, token: "secret" });
    create.mockRejectedValueOnce(new PaymentError(404, "Pedido no encontrado"));
    expect((await handleCreatePayment(request(), "o", { create, getMember: async () => null })).status).toBe(404);
    create.mockRejectedValueOnce(new Error("private-key-internal-error"));
    const failure = await handleCreatePayment(request(), "o", { create, getMember: async () => null });
    expect(failure.status).toBe(503); expect(await failure.text()).not.toContain("private-key");
  });
  it("requires the separate job secret", async () => {
    vi.stubEnv("PAYMENT_JOBS_SECRET", "scheduler-secret"); const run = vi.fn(async () => ({ processed: 1 }));
    expect((await handlePaymentJobs(new Request("http://localhost/api/jobs", { method: "POST" }), run)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect((await handlePaymentJobs(new Request("http://localhost/api/jobs", { method: "POST", headers: { authorization: "Bearer scheduler-secret" } }), run)).status).toBe(200);
  });
});

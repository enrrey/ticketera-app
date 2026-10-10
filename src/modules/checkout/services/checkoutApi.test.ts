// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleCreateCheckout, handleGetCheckout } from "./checkoutApi";
import { CheckoutError } from "./createCheckout";

const body = { eventId: "main-event", items: [{ ticketTypeId: "00000000-0000-4000-8000-0000000000e1", quantity: 1 }], buyer: { email: "ana@example.com", name: "Ana",documentType:'dni',documentNumber:'12345678',phone:'999999999' },acceptedTerms:true,termsVersion:'2026-10-09' };
const post = (payload: unknown, origin: string | null = "http://localhost:3000") => new Request("http://localhost:3000/api/checkout", {
  method: "POST", body: typeof payload === "string" ? payload : JSON.stringify(payload), headers: origin ? { origin, "content-type": "application/json" } : {},
});
const created = { orderId: "o1", status: "pending", totalCents: 10000, currency: "pen", expiresAt: "2026-10-05T00:15:00.000Z", serverTime: "2026-10-05T00:00:00.000Z", expired: false, items: [] };

describe("POST /api/checkout", () => {
  it('requires identity details and explicit current-version consent for new public orders',async()=>{
    const create=vi.fn();const getMember=async()=>null;
    expect((await handleCreateCheckout(post({...body,acceptedTerms:false}),{create,getMember})).status).toBe(400);
    expect((await handleCreateCheckout(post({...body,buyer:{email:'a@example.com',name:'A'}}),{create,getMember})).status).toBe(400);
    expect((await handleCreateCheckout(post({...body,buyer:{...body.buyer,documentNumber:'123'}}),{create,getMember})).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects missing or foreign origins before reading anything (CA-08)", async () => {
    const create = vi.fn(); const getMember = vi.fn();
    expect((await handleCreateCheckout(post(body, null), { create, getMember })).status).toBe(403);
    expect((await handleCreateCheckout(post(body, "https://evil.example"), { create, getMember })).status).toBe(403);
    expect(create).not.toHaveBeenCalled(); expect(getMember).not.toHaveBeenCalled();
  });

  it("returns 201 no-store and passes the session member to the service (CA-03)", async () => {
    const create = vi.fn().mockResolvedValue(created);
    const response = await handleCreateCheckout(post(body), { create, getMember: async () => ({ id: "user-1", status: "active" }) });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(created);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ eventId: "main-event" }), { id: "user-1", status: "active" });
  });

  it("returns 400 for invalid JSON, extra fields and out-of-range values", async () => {
    const create = vi.fn(); const getMember = async () => null;
    expect((await handleCreateCheckout(post("{nope"), { create, getMember })).status).toBe(400);
    expect((await handleCreateCheckout(post({ ...body, userId: "x" }), { create, getMember })).status).toBe(400);
    expect((await handleCreateCheckout(post({ ...body, items: [{ ...body.items[0], quantity: 0 }] }), { create, getMember })).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps business errors to their status, code and remaining stock", async () => {
    const details = [{ ticketTypeId: body.items[0].ticketTypeId, available: 2 }];
    const create = vi.fn().mockRejectedValue(new CheckoutError(409, "insufficient_inventory", "No hay cupo suficiente", details));
    const response = await handleCreateCheckout(post(body), { create, getMember: async () => null });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "No hay cupo suficiente", code: "insufficient_inventory", details });
  });

  it("returns a generic 503 when the database or identity provider fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection refused: postgres://user:secret@host"));
    const response = await handleCreateCheckout(post(body), { create, getMember: async () => null });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect((await handleCreateCheckout(post(body), { create, getMember: async () => { throw new Error("clerk down"); } })).status).toBe(503);
  });
});

describe("GET /api/checkout/[orderId]", () => {
  const get = (token?: string) => new Request("http://localhost:3000/api/checkout/o1", { headers: token ? { "x-order-token": token } : {} });

  it("passes the session user and the token header and returns the summary no-store (CA-18)", async () => {
    const read = vi.fn().mockResolvedValue(created);
    const response = await handleGetCheckout(get("tok"), "o1", { read, getMember: async () => ({ id: "user-1", status: "active" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(read).toHaveBeenCalledWith("o1", { userId: "user-1", token: "tok" });
  });

  it("answers 404 without revealing whether the order exists", async () => {
    const response = await handleGetCheckout(get(), "o1", { read: async () => null, getMember: async () => null });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Pedido no encontrado" });
  });

  it("answers 503 when reading fails", async () => {
    expect((await handleGetCheckout(get(), "o1", { read: async () => { throw new Error("db"); }, getMember: async () => null })).status).toBe(503);
  });
});

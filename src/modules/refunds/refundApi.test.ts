import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), refund: vi.fn(), cancel: vi.fn() }));
vi.mock("@/modules/identity-access", () => ({ getCurrentAccessUser: mocks.actor, AccessError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("./requestRefund", () => ({ requestTicketRefund: mocks.refund, requestCancelEvent: mocks.cancel }));
import { handleTicketRefund, handleCancelEvent } from "./refundApi";
const id = "00000000-0000-4000-8000-0000000000f1";
const request = (origin = "https://app.test") => new Request("https://app.test/api/refunds", { method: "POST", headers: { origin } });
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ id: "authenticated-owner" }); mocks.refund.mockResolvedValue({ id, status: "pending" }); });
describe("refund API", () => {
  it("passes only the authenticated actor and route ticket to durable request", async () => {
    expect((await handleTicketRefund(request(), id)).status).toBe(202);
    expect(mocks.refund).toHaveBeenCalledWith("authenticated-owner", id);
  });
  it("rejects foreign origins and unsigned visitors before writing", async () => {
    expect((await handleTicketRefund(request("https://foreign.test"), id)).status).toBe(403);
    mocks.actor.mockResolvedValue(null);
    expect((await handleTicketRefund(request(), id)).status).toBe(401);
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("validates event IDs and refuses unsupported methods", async () => {
    expect((await handleCancelEvent(request(), "bad-id")).status).toBe(400);
    expect((await handleTicketRefund(new Request("https://app.test/api/refunds"), id)).status).toBe(405);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});

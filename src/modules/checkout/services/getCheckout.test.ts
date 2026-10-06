// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCheckout } from "./createCheckout";
import { getCheckout } from "./getCheckout";
import { createTestDatabase, ids } from "./testDatabase";

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { ctx = await createTestDatabase(); }, 60_000);
afterAll(async () => ctx.pg.close());
beforeEach(async () => { await ctx.pg.exec(`delete from inventory_reservation; delete from order_item; delete from "order";`); });

const buy = (buyer: { id: string; status: string } | null) => createCheckout(
  { eventId: "main-event", items: [{ ticketTypeId: ids.general, quantity: 2 }, { ticketTypeId: ids.vip, quantity: 1 }], buyer: { email: "ana@example.com", name: "Ana" } }, buyer, ctx.db);

describe("getCheckout", () => {
  it("returns the summary to a guest holding the token, with a server clock and expiry (CA-16, CA-18)", async () => {
    const order = await buy(null);
    const summary = await getCheckout(order.orderId, { userId: null, token: order.accessToken! }, ctx.db);
    expect(summary).toMatchObject({ orderId: order.orderId, status: "pending", totalCents: 45050, currency: "pen", expired: false });
    expect(summary!.items.map((item) => item.name)).toEqual(["General", "VIP"]);
    expect(new Date(summary!.expiresAt).getTime() - new Date(summary!.serverTime).getTime()).toBeGreaterThan(0);
  });

  it("returns the summary to the session owner without a token", async () => {
    const order = await buy({ id: ids.user, status: "active" });
    expect(await getCheckout(order.orderId, { userId: ids.user, token: null }, ctx.db)).toMatchObject({ orderId: order.orderId });
  });

  it("returns null for a wrong token, another user, no proof, a malformed id or a missing order", async () => {
    const guest = await buy(null);
    const member = await buy({ id: ids.user, status: "active" });
    expect(await getCheckout(guest.orderId, { userId: null, token: "wrong" }, ctx.db)).toBeNull();
    expect(await getCheckout(guest.orderId, { userId: null, token: null }, ctx.db)).toBeNull();
    expect(await getCheckout(guest.orderId, { userId: ids.user, token: null }, ctx.db)).toBeNull();
    expect(await getCheckout(member.orderId, { userId: ids.inactiveUser, token: null }, ctx.db)).toBeNull();
    expect(await getCheckout(member.orderId, { userId: null, token: guest.accessToken! }, ctx.db)).toBeNull();
    expect(await getCheckout("not-a-uuid", { userId: null, token: guest.accessToken! }, ctx.db)).toBeNull();
    expect(await getCheckout("00000000-0000-4000-8000-00000000ffff", { userId: null, token: guest.accessToken! }, ctx.db)).toBeNull();
  });

  it("marks the order as expired once the reservation time has passed (CA-16)", async () => {
    const order = await buy(null);
    await ctx.pg.exec(`update inventory_reservation set created_at = now() - interval '20 minutes', expires_at = now() - interval '5 minutes' where order_item_id in (select id from order_item where order_id='${order.orderId}')`);
    expect(await getCheckout(order.orderId, { userId: null, token: order.accessToken! }, ctx.db)).toMatchObject({ expired: true });
  });
});

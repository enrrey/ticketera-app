// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { inventoryReservations, orderItems, orders, ticketTypes } from "@/lib/db/schema";
import { listDatabaseEvents } from "@/modules/events/server";
import { availableUnitsSql } from "./availability";
import { CheckoutError, createCheckout } from "./createCheckout";
import { checkoutSchema, type CheckoutInput } from "./checkoutSchema";
import { createTestDatabase, ids } from "./testDatabase";

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { ctx = await createTestDatabase(); }, 60_000);
afterAll(async () => ctx.pg.close());
beforeEach(async () => {
  await ctx.pg.exec(`delete from inventory_reservation; delete from order_item; delete from "order";`);
});

const input = (items: CheckoutInput["items"], overrides: Partial<CheckoutInput> = {}): CheckoutInput =>
  ({ eventId: "main-event", items, buyer: { email: "ana@example.com", name: "Ana" }, ...overrides });
const guest = null;
const available = async (id: string) => (await ctx.db.select({ n: availableUnitsSql(sql.raw("ticket_type.id"), sql.raw("ticket_type.capacity")) }).from(ticketTypes).where(eq(ticketTypes.id, id)))[0].n;
const failure = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as CheckoutError);

describe("createCheckout", () => {
  it("creates a pending order, one item and one 15-minute reservation per line (CA-01, CA-02)", async () => {
    const result = await createCheckout(input([{ ticketTypeId: ids.general, quantity: 2 }, { ticketTypeId: ids.vip, quantity: 1 }]), guest, ctx.db);
    expect(result).toMatchObject({ status: "pending", currency: "pen", totalCents: 2 * 10000 + 25050, expired: false });
    expect(result.items).toHaveLength(2);
    const [order] = await ctx.db.select().from(orders).where(eq(orders.id, result.orderId));
    expect(order).toMatchObject({ status: "pending", subtotalCents: 45050, discountCents: 0, totalCents: 45050, currency: "pen" });
    const reservations = await ctx.db.select().from(inventoryReservations);
    expect(reservations).toHaveLength(2);
    for (const reservation of reservations) {
      expect(reservation.status).toBe("active");
      expect(reservation.expiresAt.getTime() - reservation.createdAt.getTime()).toBe(15 * 60 * 1000);
    }
    expect((await ctx.db.select().from(orderItems)).map((item) => item.unitPriceCents).sort()).toEqual([10000, 25050]);
  });

  it("stores the session user for members and none for guests, with a one-time token only for guests (CA-03, CA-18)", async () => {
    const member = await createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }]), { id: ids.user, status: "active" }, ctx.db);
    const anonymous = await createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }]), guest, ctx.db);
    const rows = Object.fromEntries((await ctx.db.select().from(orders)).map((order) => [order.id, order]));
    expect(rows[member.orderId]).toMatchObject({ userId: ids.user, accessTokenHash: null });
    expect(member.accessToken).toBeUndefined();
    expect(rows[anonymous.orderId].userId).toBeNull();
    expect(anonymous.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rows[anonymous.orderId].accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[anonymous.orderId].accessTokenHash).not.toContain(anonymous.accessToken!);
  });

  it("normalizes the buyer email without touching dots or plus tags (CA-04)", () => {
    const parsed = checkoutSchema.parse({ eventId: "x", items: [{ ticketTypeId: ids.general, quantity: 1 }], buyer: { email: "  Ana.Perez+Tag@Example.COM ", name: " Ana " } });
    expect(parsed.buyer).toEqual({ email: "ana.perez+tag@example.com", name: "Ana" });
  });

  it("rejects inactive accounts and writes nothing (CA-08)", async () => {
    const error = await failure(createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }]), { id: ids.inactiveUser, status: "inactive" }, ctx.db));
    expect(error).toMatchObject({ status: 403, code: "account_inactive" });
    expect(await ctx.db.select().from(orders)).toHaveLength(0);
  });

  it("returns 404 for unpublished events and ticket types of another event (CA-05)", async () => {
    expect(await failure(createCheckout(input([{ ticketTypeId: ids.draftType, quantity: 1 }], { eventId: "draft-event" }), guest, ctx.db))).toMatchObject({ status: 404 });
    expect(await failure(createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }], { eventId: "missing" }), guest, ctx.db))).toMatchObject({ status: 404 });
    expect(await failure(createCheckout(input([{ ticketTypeId: ids.foreign, quantity: 1 }]), guest, ctx.db))).toMatchObject({ status: 404 });
    expect(await failure(createCheckout(input([{ ticketTypeId: "00000000-0000-4000-8000-00000000ffff", quantity: 1 }]), guest, ctx.db))).toMatchObject({ status: 404 });
    expect(await ctx.db.select().from(orders)).toHaveLength(0);
  });

  it("returns 409 sales_closed outside the sales window or without a future session (CA-06)", async () => {
    for (const type of [ids.closed, ids.upcoming]) {
      expect(await failure(createCheckout(input([{ ticketTypeId: type, quantity: 1 }]), guest, ctx.db))).toMatchObject({ status: 409, code: "sales_closed" });
    }
    expect(await failure(createCheckout(input([{ ticketTypeId: ids.pastEventType, quantity: 1 }], { eventId: "other-event" }), guest, ctx.db))).toMatchObject({ status: 409, code: "sales_closed" });
  });

  it("enforces the per-type order limit and the request shape (CA-07)", async () => {
    expect(await failure(createCheckout(input([{ ticketTypeId: ids.general, quantity: 5 }]), guest, ctx.db))).toMatchObject({ status: 400, code: "invalid_quantity" });
    const bad = (items: unknown) => checkoutSchema.safeParse({ eventId: "x", items, buyer: { email: "a@b.co", name: "A" } }).success;
    expect(bad([])).toBe(false);
    expect(bad([{ ticketTypeId: ids.general, quantity: 0 }])).toBe(false);
    expect(bad([{ ticketTypeId: ids.general, quantity: 1.5 }])).toBe(false);
    expect(bad([{ ticketTypeId: ids.general, quantity: 1 }, { ticketTypeId: ids.general, quantity: 2 }])).toBe(false);
    expect(bad(Array.from({ length: 11 }, (_, i) => ({ ticketTypeId: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`, quantity: 1 })))).toBe(false);
    expect(bad([{ ticketTypeId: ids.general, quantity: 1, priceCents: 1 }])).toBe(false);
    expect(checkoutSchema.safeParse({ eventId: "x", items: [{ ticketTypeId: ids.general, quantity: 1 }], buyer: { email: "a@b.co", name: "A" }, userId: ids.user }).success).toBe(false);
  });

  it("counts converted and unexpired active reservations, not released or expired ones (CA-09, CA-13)", async () => {
    const make = async (quantity: number) => createCheckout(input([{ ticketTypeId: ids.general, quantity }]), guest, ctx.db);
    const [a, b, c, d] = [await make(1), await make(1), await make(1), await make(1)];
    expect(await available(ids.general)).toBe(1);
    const status = (orderId: string, value: string, expired = false) => ctx.pg.exec(
      `update inventory_reservation set status='${value}' ${expired ? ", created_at = now() - interval '20 minutes', expires_at = now() - interval '5 minutes'" : ""} where order_item_id in (select id from order_item where order_id='${orderId}')`);
    await status(a.orderId, "converted");
    await status(b.orderId, "released");
    await status(c.orderId, "active", true);
    expect(await available(ids.general)).toBe(5 - 1 - 1);
    await status(d.orderId, "released");
    expect(await available(ids.general)).toBe(4);
  });

  it("shows the same remaining units in the public listing as the reservation uses (CA-14)", async () => {
    await createCheckout(input([{ ticketTypeId: ids.general, quantity: 2 }]), guest, ctx.db);
    const listed = (await listDatabaseEvents("public", null, ctx.db)).find((event) => event.id === "main-event");
    const option = listed!.ticketOptions!.find((candidate) => candidate.id === ids.general)!;
    expect(option.available).toBe(3);
    expect(option.available).toBe(await available(ids.general));
    expect(listed!.ticketOptions!.find((candidate) => candidate.id === ids.vip)!.available).toBe(3);
  });

  it("rolls back every line when one line lacks stock and reports the remaining units (CA-10)", async () => {
    await createCheckout(input([{ ticketTypeId: ids.vip, quantity: 3 }]), guest, ctx.db);
    const before = (await ctx.db.select().from(orders)).length;
    const error = await failure(createCheckout(input([{ ticketTypeId: ids.general, quantity: 2 }, { ticketTypeId: ids.vip, quantity: 1 }]), guest, ctx.db));
    expect(error).toMatchObject({ status: 409, code: "insufficient_inventory", details: [{ ticketTypeId: ids.vip, available: 0 }] });
    expect((await ctx.db.select().from(orders)).length).toBe(before);
    expect(await available(ids.general)).toBe(5);
  });

  it("never reserves more than capacity when more buyers than units compete (CA-11 logic)", async () => {
    const results = await Promise.all(Array.from({ length: 9 }, () => failure(createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }]), guest, ctx.db))));
    expect(results.filter((error) => error === null)).toHaveLength(5);
    expect(results.filter((error) => error?.code === "insufficient_inventory")).toHaveLength(4);
    expect(await available(ids.general)).toBe(0);
  });

  it("serves orders that request the same types in opposite order without deadlock (CA-12 logic)", async () => {
    const [x, y] = await Promise.all([
      createCheckout(input([{ ticketTypeId: ids.general, quantity: 1 }, { ticketTypeId: ids.vip, quantity: 1 }]), guest, ctx.db),
      createCheckout(input([{ ticketTypeId: ids.vip, quantity: 1 }, { ticketTypeId: ids.general, quantity: 1 }]), guest, ctx.db),
    ]);
    expect(x.orderId).not.toBe(y.orderId);
  });
});

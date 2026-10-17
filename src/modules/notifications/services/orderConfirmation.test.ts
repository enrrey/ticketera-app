// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, ids } from '@/modules/checkout/testing';
import { getCheckout } from '@/modules/checkout/server';
import { issueTickets } from '@/modules/tickets/server';
import { auditLogs, inventoryReservations, notificationOutbox, orderItems, orders, payments, tickets } from '@/lib/db/schema';
import { enqueueOrderConfirmation, processNotificationOutbox } from '../server';

describe('order confirmation outbox', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { ctx = await createTestDatabase(); }, 60000);
  afterAll(async () => { await ctx?.pg.close(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    await ctx.db.delete(notificationOutbox);
    vi.stubEnv('QR_SIGNING_SECRET', 'ab'.repeat(32));
    vi.stubEnv('NOTIFICATIONS_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'Tickets <tickets@example.com>');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://tickets.example.com');
  });
  async function order(status = 'paid') {
    const [row] = await ctx.db.insert(orders).values({ id: randomUUID(), buyerName: '<Ana>', buyerEmail: 'ana@example.com', status, subtotalCents: 10000, totalCents: 10000, accessTokenHash: createHash('sha256').update(randomUUID()).digest('hex') }).returning();
    const [item] = await ctx.db.insert(orderItems).values({ orderId: row.id, ticketTypeId: ids.general, quantity: 1, unitPriceCents: 10000, totalCents: 10000 }).returning();
    await ctx.db.insert(inventoryReservations).values({ orderItemId: item.id, quantity: 1, status: 'converted' });
    return row;
  }
  it('enqueues once only for paid orders and preserves the original credential', async () => {
    const paid = await order();
    await ctx.db.transaction(async tx => { await enqueueOrderConfirmation(tx, paid.id); await enqueueOrderConfirmation(tx, paid.id); });
    await enqueueOrderConfirmation(ctx.db, (await order('pending')).id);
    const rows = await ctx.db.select().from(notificationOutbox);
    expect(rows).toHaveLength(1);
    const [saved] = await ctx.db.select().from(orders).where(eq(orders.id, paid.id));
    expect(saved.accessTokenHash).toBe(paid.accessTokenHash);
    expect(saved.confirmationTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('retries the identical encrypted payload and idempotency key after an ambiguous timeout', async () => {
    const paid = await order(); await enqueueOrderConfirmation(ctx.db, paid.id);
    const sent: { payload: string; key: string }[] = [];
    const gateway = { send: async (payload: string, key: string) => { sent.push({ payload, key }); if (sent.length === 1) throw new Error('timeout'); return 'provider-id'; } };
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ retried: 1 });
    const [pending] = await ctx.db.select().from(notificationOutbox);
    expect(pending.encryptedPayload).not.toContain('ana@example.com');
    await ctx.db.update(orders).set({ buyerName: 'Changed' }).where(eq(orders.id, paid.id));
    await ctx.db.update(notificationOutbox).set({ nextAttemptAt: new Date(0) });
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ sent: 1 });
    expect(sent[1]).toEqual(sent[0]);
    const mail = JSON.parse(sent[0].payload);
    expect(mail.html).toContain('&lt;Ana&gt;');
    expect(mail.text).toContain('S/ 100.00');
    const link = mail.text.match(/https:\/\/tickets\.example\.com\/pedidos\/[^\s]+/)[0];
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('t')!;
    expect(await getCheckout(paid.id, { userId: null, token }, ctx.db)).toMatchObject({ orderId: paid.id });
    expect(await getCheckout(paid.id, { userId: null, token: 'foreign' }, ctx.db)).toBeNull();
    const [saved] = await ctx.db.select().from(notificationOutbox);
    expect(saved).toMatchObject({ status: 'sent', providerMessageId: 'provider-id', attempts: 2 });
  });
  it('leaves pending rows untouched without configuration', async () => {
    await enqueueOrderConfirmation(ctx.db, (await order()).id);
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await processNotificationOutbox({ database: ctx.db })).toMatchObject({ configured: false });
    expect((await ctx.db.select().from(notificationOutbox))[0]).toMatchObject({ status: 'pending', attempts: 0 });
  });
  it.each([undefined, 'false'])('keeps queued confirmations untouched when notifications are %s despite provider credentials', async enabled => {
    const paid = await order();
    await enqueueOrderConfirmation(ctx.db, paid.id);
    const before = await ctx.db.select().from(notificationOutbox);
    const [orderBefore] = await ctx.db.select().from(orders).where(eq(orders.id, paid.id));
    vi.stubEnv('NOTIFICATIONS_ENABLED', enabled);
    const gateway = { send: vi.fn(async () => 'must-not-send') };

    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toEqual({ configured: false, sent: 0, retried: 0, failed: 0, cancelled: 0 });
    expect(gateway.send).not.toHaveBeenCalled();
    expect(await ctx.db.select().from(notificationOutbox)).toEqual(before);
    const [orderAfter] = await ctx.db.select().from(orders).where(eq(orders.id, paid.id));
    expect(orderAfter.confirmationTokenHash).toBe(orderBefore.confirmationTokenHash);
    expect(orderAfter.accessTokenHash).toBe(paid.accessTokenHash);
  });
  it('commits tickets and outbox together only with a captured payment', async () => {
    const paid = await order();
    await expect(ctx.db.transaction(tx => issueTickets(tx, paid.id))).rejects.toThrow('captured payment');
    expect(await ctx.db.select().from(notificationOutbox)).toHaveLength(0);
    await ctx.db.insert(payments).values({ orderId: paid.id, status: 'succeeded', amountCents: paid.totalCents, idempotencyKey: randomUUID() });
    await ctx.db.transaction(tx => issueTickets(tx, paid.id));
    expect(await ctx.db.select().from(notificationOutbox)).toHaveLength(1);
    expect(await ctx.db.select().from(tickets)).toHaveLength(1);
    await ctx.db.transaction(tx => issueTickets(tx, paid.id));
    expect(await ctx.db.select().from(notificationOutbox)).toHaveLength(1);
  });
  it('reclaims a stale worker and stops after the fifth failed delivery', async () => {
    await enqueueOrderConfirmation(ctx.db, (await order()).id);
    await ctx.db.update(notificationOutbox).set({ status: 'processing', attempts: 4, claimedAt: new Date(Date.now() - 6 * 60000), claimToken: randomUUID() });
    const gateway = { send: async () => { throw new Error('secret provider details'); } };
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ failed: 1 });
    const [saved] = await ctx.db.select().from(notificationOutbox);
    expect(saved).toMatchObject({ status: 'failed', attempts: 5, claimToken: null });
    expect((await ctx.db.select().from(auditLogs)).at(-1)?.metadata).toEqual({ reason: 'attempts_exhausted' });
  });
  it('stops ambiguous attempts after the provider deduplication window with a safe audit', async () => {
    await enqueueOrderConfirmation(ctx.db, (await order()).id);
    await ctx.db.update(notificationOutbox).set({ attempts: 1, firstAttemptAt: new Date(Date.now() - 25 * 3600000) });
    const gateway = { send: vi.fn(async () => 'never') };
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ failed: 1 });
    expect(gateway.send).not.toHaveBeenCalled();
    expect((await ctx.db.select().from(auditLogs)).at(-1)?.metadata).toEqual({ reason: 'idempotency_window_expired' });
  });
  it.each([
    ['expired lease', "NEW.claimed_at := clock_timestamp() - interval '6 minutes';"],
    ['expired deduplication window', "NEW.first_attempt_at := clock_timestamp() - interval '24 hours';"],
    ['replaced ownership', "NEW.claim_token := '00000000-0000-4000-8000-000000000099'::uuid;"],
  ])('does not send or overwrite when %s changes before network delivery', async (_, mutation) => {
    await enqueueOrderConfirmation(ctx.db, (await order()).id);
    await ctx.pg.exec(`
      CREATE FUNCTION interrupt_notification_claim() RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'processing' AND OLD.status = 'pending' THEN ${mutation} END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER interrupt_notification_claim BEFORE UPDATE ON notification_outbox
        FOR EACH ROW EXECUTE FUNCTION interrupt_notification_claim();
    `);
    try {
      const gateway = { send: vi.fn(async () => 'must-not-send') };
      expect(await processNotificationOutbox({ database: ctx.db, gateway, limit: 1 })).toMatchObject({ sent: 0, retried: 0, failed: 0 });
      expect(gateway.send).not.toHaveBeenCalled();
      const [saved] = await ctx.db.select().from(notificationOutbox);
      expect(saved).toMatchObject({ status: 'processing', attempts: 1, providerMessageId: null, sentAt: null });
    } finally {
      await ctx.pg.exec('DROP TRIGGER interrupt_notification_claim ON notification_outbox; DROP FUNCTION interrupt_notification_claim();');
    }
  });
  it('cancels unpaid orders and cannot overwrite a replaced claim', async () => {
    const paid = await order(); await enqueueOrderConfirmation(ctx.db, paid.id);
    const gateway = { send: async () => { await ctx.db.update(notificationOutbox).set({ claimToken: randomUUID() }); return 'stale'; } };
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ sent: 0 });
    expect((await ctx.db.select().from(notificationOutbox))[0].providerMessageId).toBeNull();
    await ctx.db.update(notificationOutbox).set({ status: 'pending', nextAttemptAt: new Date(0) });
    await ctx.db.update(orders).set({ status: 'refunded' }).where(eq(orders.id, paid.id));
    expect(await processNotificationOutbox({ database: ctx.db, gateway })).toMatchObject({ cancelled: 1 });
  });
});

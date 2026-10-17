import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDatabase } from '@/lib/db';
import { auditLogs, events, notificationOutbox, orderItems, orders, ticketTypes } from '@/lib/db/schema';

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
/** Serialized body is preserved byte for byte across retries. */
export interface ConfirmationGateway { send(payload: string, idempotencyKey: string): Promise<string> }

function signingKey() {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('Confirmation signing is not configured');
  return Buffer.from(value, 'hex');
}
function confirmationToken(orderId: string) {
  return createHmac('sha256', signingKey()).update(`order-confirmation:v1:${orderId}`).digest('base64url');
}
function payloadKey() { return createHmac('sha256', signingKey()).update('notification-payload-encryption:v1').digest(); }
function encrypt(payload: string, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', payloadKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}
function decrypt(payload: string, id: string) {
  const [version, iv, tag, body] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Invalid notification payload');
  const cipher = createDecipheriv('aes-256-gcm', payloadKey(), Buffer.from(iv, 'base64url'));
  cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([cipher.update(Buffer.from(body, 'base64url')), cipher.final()]).toString('utf8');
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Called inside the ticket issuance transaction, so payment/tickets/outbox commit together. */
export async function enqueueOrderConfirmation(database: Database, orderId: string): Promise<void> {
  const [order] = await database.select().from(orders).where(eq(orders.id, orderId)).for('update');
  if (!order || order.status !== 'paid') return;
  const tokenHash = createHash('sha256').update(confirmationToken(order.id)).digest('hex');
  if (!order.confirmationTokenHash) await database.update(orders).set({ confirmationTokenHash: tokenHash }).where(eq(orders.id, orderId));
  await database.insert(notificationOutbox).values({ orderId }).onConflictDoNothing({ target: notificationOutbox.orderId });
}

function configuration() {
  if (process.env.NOTIFICATIONS_ENABLED !== 'true') return null;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '');
    signingKey();
    if (!apiKey || !from || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return { apiKey, from, origin: url.origin };
  } catch { return null; }
}
function resendGateway(apiKey: string): ConfirmationGateway {
  return { async send(payload, idempotencyKey) {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: payload, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Notification delivery failed');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id.trim()) throw new Error('Notification acknowledgement missing');
    return result.id;
  } };
}
async function buildPayload(database: Database, order: typeof orders.$inferSelect, from: string, origin: string) {
  const items = await database.select({ name: ticketTypes.name, event: events.name, quantity: orderItems.quantity })
    .from(orderItems).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).innerJoin(events, eq(events.id, ticketTypes.eventId)).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.id);
  const link = `${origin}/pedidos/${order.id}#t=${confirmationToken(order.id)}`;
  const total = `S/ ${(order.totalCents / 100).toFixed(2)}`;
  const text = `Hola ${order.buyerName}, tu compra está confirmada.\n${items.map(item => `${item.event} — ${item.name} × ${item.quantity}`).join('\n')}\nTotal: ${total}\nVer tus entradas: ${link}`;
  const html = `<p>Hola ${escapeHtml(order.buyerName)}, tu compra está confirmada.</p><ul>${items.map(item => `<li>${escapeHtml(item.event)} — ${escapeHtml(item.name)} × ${item.quantity}</li>`).join('')}</ul><p>Total: ${total}</p><p><a href="${escapeHtml(link)}">Ver tus entradas</a></p>`;
  return JSON.stringify({ from, to: [order.buyerEmail], subject: 'Tu compra de entradas está confirmada', html, text });
}

export async function processNotificationOutbox(options: { database?: Database; gateway?: ConfirmationGateway; limit?: number } = {}) {
  const config = configuration();
  const result = { configured: !!config, sent: 0, retried: 0, failed: 0, cancelled: 0 };
  // Do not claim any work when a deployment has not configured email delivery.
  if (!config) return result;
  const database = options.database ?? getDatabase();
  const gateway = options.gateway ?? resendGateway(config.apiKey);
  for (let count = 0; count < Math.min(options.limit ?? 20, 100); count++) {
    const claim = await database.transaction(async tx => {
      const [row] = await tx.select().from(notificationOutbox).where(or(
        and(eq(notificationOutbox.status, 'pending'), sql`${notificationOutbox.nextAttemptAt} <= now()`),
        and(eq(notificationOutbox.status, 'processing'), sql`${notificationOutbox.claimedAt} < now() - interval '5 minutes'`),
      )).orderBy(notificationOutbox.nextAttemptAt, notificationOutbox.id).limit(1).for('update', { skipLocked: true });
      if (!row) return null;
      const [order] = await tx.select().from(orders).where(eq(orders.id, row.orderId)).for('update');
      if (!order || order.status !== 'paid') {
        await tx.update(notificationOutbox).set({ status: 'cancelled', claimToken: null }).where(eq(notificationOutbox.id, row.id));
        return { kind: 'cancelled' as const };
      }
      // Include the request timeout margin: never cross the provider's 24h window during a retry.
      const expired = row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() >= 24 * 3600000 - 15000;
      if (expired || row.attempts >= 5) {
        await tx.update(notificationOutbox).set({ status: 'failed', claimToken: null }).where(eq(notificationOutbox.id, row.id));
        await tx.insert(auditLogs).values({ action: 'notification.confirmation_failed', entity: 'notification_outbox', entityId: row.id, metadata: { reason: expired ? 'idempotency_window_expired' : 'attempts_exhausted' } });
        return { kind: 'failed' as const };
      }
      const encryptedPayload = row.encryptedPayload ?? encrypt(await buildPayload(tx, order, config.from, config.origin), row.id);
      const claimToken = randomUUID();
      const [saved] = await tx.update(notificationOutbox).set({ status: 'processing', attempts: row.attempts + 1, claimedAt: new Date(), claimToken, encryptedPayload, firstAttemptAt: row.firstAttemptAt ?? new Date() }).where(eq(notificationOutbox.id, row.id)).returning();
      return { kind: 'send' as const, row: { ...saved, claimToken } };
    });
    if (!claim) break;
    if (claim.kind !== 'send') { result[claim.kind]++; continue; }
    const row = claim.row;
    const ownsClaim = and(eq(notificationOutbox.id, row.id), eq(notificationOutbox.status, 'processing'), eq(notificationOutbox.claimToken, row.claimToken!));
    try {
      const payload = decrypt(row.encryptedPayload!, row.id);
      // A worker may have paused since claiming: recheck ownership and both deadlines
      // using the database wall clock immediately before the external side effect.
      const [liveClaim] = await database.select({ id: notificationOutbox.id }).from(notificationOutbox).where(and(
        ownsClaim,
        sql`${notificationOutbox.claimedAt} > clock_timestamp() - interval '5 minutes'`,
        sql`${notificationOutbox.firstAttemptAt} > clock_timestamp() - interval '24 hours' + interval '15 seconds'`,
      )).limit(1);
      if (!liveClaim) continue;
      const providerMessageId = await gateway.send(payload, `notification/${row.id}`);
      const updated = await database.update(notificationOutbox).set({ status: 'sent', sentAt: new Date(), providerMessageId, claimToken: null }).where(ownsClaim).returning({ id: notificationOutbox.id });
      result.sent += updated.length;
    } catch {
      const terminal = row.attempts >= 5;
      const updated = await database.transaction(async tx => {
        const changed = await tx.update(notificationOutbox).set({ status: terminal ? 'failed' : 'pending', claimToken: null, nextAttemptAt: new Date(Date.now() + 60000 * 2 ** (row.attempts - 1)) }).where(ownsClaim).returning({ id: notificationOutbox.id });
        if (terminal && changed.length) await tx.insert(auditLogs).values({ action: 'notification.confirmation_failed', entity: 'notification_outbox', entityId: row.id, metadata: { reason: 'attempts_exhausted' } });
        return changed;
      });
      if (terminal) result.failed += updated.length; else result.retried += updated.length;
    }
  }
  return result;
}

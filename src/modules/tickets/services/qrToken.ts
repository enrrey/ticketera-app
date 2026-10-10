import { createHash, createHmac } from 'node:crypto';

/** Preserve this private key: credentials are reconstructed, never stored as plaintext. */
export function ticketCredential(ticketId: string) {
  const key = process.env.QR_SIGNING_SECRET;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('Ticket signing is not configured');
  return `ticketera:v1:${createHmac('sha256', Buffer.from(key, 'hex')).update(`ticket:${ticketId}`).digest('base64url')}`;
}
export const hashTicketCredential = (credential: string) => createHash('sha256').update(credential).digest('hex');

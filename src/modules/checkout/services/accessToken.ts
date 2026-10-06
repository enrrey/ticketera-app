import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque secret handed to a guest buyer once; only its hash is stored. */
export function generateAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function accessTokenMatches(token: string, storedHash: string | null) {
  if (!storedHash) return false;
  const candidate = Buffer.from(hashAccessToken(token));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

import { createHash, randomBytes, randomInt } from 'node:crypto';

export const sha256Hex = (input: string): string => createHash('sha256').update(input).digest('hex');

/** 32 random bytes, base64url: the raw session token that only ever lives in the cookie. */
export const newSessionToken = (): string => randomBytes(32).toString('base64url');

// Crockford base32 without I, L, O, U, so references are easy to read aloud and type.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Booking reference like SEAT-7KQ4-M2XP (8 random symbols, 40 bits). Uniqueness is enforced by an index. */
export function newBookingReference(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CROCKFORD[randomInt(CROCKFORD.length)];
  return `SEAT-${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Request fingerprint stored with an idempotency key. Inputs are already normalised by the Zod
 * schema (lower-case eventId, upper-case seatId) and serialised in a fixed key order.
 */
export function bookingFingerprint(input: { eventId: string; seatId: string }): string {
  const canonical = JSON.stringify({ eventId: input.eventId.toLowerCase(), seatId: input.seatId.toUpperCase() });
  return sha256Hex(`POST /api/bookings\n${canonical}`);
}

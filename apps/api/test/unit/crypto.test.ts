import { describe, expect, it } from 'vitest';
import { bookingFingerprint, newBookingReference, newSessionToken, sha256Hex } from '../../src/lib/crypto';

describe('bookingFingerprint', () => {
  const eventId = '66fd2a0000000000000000ab';
  it('ignores key order and letter case', () => {
    const a = bookingFingerprint({ eventId, seatId: 'A7' });
    const b = bookingFingerprint({ seatId: 'a7', eventId: eventId.toUpperCase() } as { eventId: string; seatId: string });
    expect(a).toBe(b);
  });
  it('changes when the seat or event changes', () => {
    const base = bookingFingerprint({ eventId, seatId: 'A7' });
    expect(bookingFingerprint({ eventId, seatId: 'A8' })).not.toBe(base);
    expect(bookingFingerprint({ eventId: '66fd2a0000000000000000ac', seatId: 'A7' })).not.toBe(base);
  });
});

describe('newBookingReference', () => {
  it('matches SEAT-XXXX-XXXX in Crockford base32 (no I, L, O, U)', () => {
    for (let i = 0; i < 200; i++) expect(newBookingReference()).toMatch(/^SEAT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });
});

describe('session tokens', () => {
  it('are random 43-char base64url strings and are stored only as a sha256 hash', () => {
    const t = newSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(t);
    expect(sha256Hex(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

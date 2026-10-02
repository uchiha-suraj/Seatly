import { describe, expect, it } from 'vitest';
import { createBookingSchema, fieldErrors, idempotencyKeySchema, loginSchema, registerSchema, seatIdSchema } from '../src';

describe('seatIdSchema', () => {
  it.each(['A1', 'A7', 'F10', 'Z99', ' b3 '])('accepts %s', (v) => {
    expect(seatIdSchema.safeParse(v).success).toBe(true);
  });
  it('normalises to upper case', () => {
    expect(seatIdSchema.parse('a7')).toBe('A7');
  });
  it.each(['', 'A0', 'A100', '7A', 'AA1', 'A-1', 'A01'])('rejects %j', (v) => {
    expect(seatIdSchema.safeParse(v).success).toBe(false);
  });
});

describe('createBookingSchema', () => {
  const eventId = '66FD2A0000000000000000AB';
  it('lower-cases the event id and upper-cases the seat', () => {
    expect(createBookingSchema.parse({ eventId, seatId: 'a7' })).toEqual({ eventId: eventId.toLowerCase(), seatId: 'A7' });
  });
  it('rejects a client-supplied userId instead of ignoring it (AC-13)', () => {
    const r = createBookingSchema.safeParse({ eventId, seatId: 'A7', userId: 'someone-else' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toHaveProperty('userId');
  });
  it('rejects malformed event ids', () => {
    expect(createBookingSchema.safeParse({ eventId: 'abc', seatId: 'A7' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration and normalises the email', () => {
    expect(registerSchema.parse({ name: ' Priya ', email: ' Priya@Example.COM ', password: 'correct-horse-9' })).toEqual({
      name: 'Priya',
      email: 'priya@example.com',
      password: 'correct-horse-9',
    });
  });
  it('returns the Figma messages per field (AC-3)', () => {
    const r = registerSchema.safeParse({ name: '', email: 'priya@example', password: 'short' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrors(r.error)).toEqual({
        name: ['Enter your name.'],
        email: ['Enter a valid email address, like name@example.com.'],
        password: ['Use at least 8 characters.'],
      });
    }
  });
  it('limits passwords to 72 characters', () => {
    expect(registerSchema.safeParse({ name: 'P', email: 'p@example.com', password: 'x'.repeat(73) }).success).toBe(false);
  });
});

describe('loginSchema / idempotencyKeySchema', () => {
  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'p@example.com', password: '' }).success).toBe(false);
  });
  it('accepts UUIDs only', () => {
    expect(idempotencyKeySchema.safeParse('3f0c8f0e-2c55-4f7a-9b8e-5d2f6f1f9a10').success).toBe(true);
    expect(idempotencyKeySchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

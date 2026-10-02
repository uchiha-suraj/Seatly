import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { AppError, hasErrorLabel, isDuplicateKey } from '../../src/lib/errors';

describe('error helpers', () => {
  it('maps codes to HTTP status', () => {
    expect(new AppError('SEAT_TAKEN', 'x').status).toBe(409);
    expect(new AppError('IDEMPOTENCY_KEY_REUSED', 'x').status).toBe(422);
    expect(new AppError('BOOKING_UNAVAILABLE', 'x').status).toBe(503);
  });
  it('recognises duplicate-key errors by index field', () => {
    const err = { code: 11000, keyPattern: { eventId: 1, seatId: 1 } };
    expect(isDuplicateKey(err)).toBe(true);
    expect(isDuplicateKey(err, 'seatId')).toBe(true);
    expect(isDuplicateKey(err, 'reference')).toBe(false);
    expect(isDuplicateKey({ code: 11001 })).toBe(false);
  });
  it('reads error labels from driver errors and plain objects', () => {
    expect(hasErrorLabel({ errorLabels: ['TransientTransactionError'] }, 'TransientTransactionError')).toBe(true);
    expect(hasErrorLabel({ hasErrorLabel: (l: string) => l === 'UnknownTransactionCommitResult' }, 'UnknownTransactionCommitResult')).toBe(true);
    expect(hasErrorLabel(null, 'x')).toBe(false);
  });
});

describe('loadConfig', () => {
  it('requires MONGODB_URI and applies the Stage 3 defaults', () => {
    expect(() => loadConfig({})).toThrow(/MONGODB_URI/);
    const c = loadConfig({ MONGODB_URI: 'mongodb://localhost:27017/seatly?replicaSet=rs0' });
    expect(c.bookingDeadlineMs).toBe(4000);
    expect(c.idempotencyLeaseMs).toBe(15000);
    expect(c.idempotencyTtlMs).toBe(24 * 3_600_000);
    expect(c.sessionIdleMs).toBe(120 * 60_000);
    expect(c.appOrigin).toBe('http://localhost:5173');
  });
  it('rejects invalid values', () => {
    expect(() => loadConfig({ MONGODB_URI: 'x', COOKIE_SECURE: 'maybe' })).toThrow(/COOKIE_SECURE/);
  });

  it('refuses a production start without APP_ORIGIN or secure cookies', () => {
    const prod = { NODE_ENV: 'production', MONGODB_URI: 'x', COOKIE_SECURE: 'true' };
    expect(() => loadConfig(prod)).toThrow(/APP_ORIGIN is required/);
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'https://seatly.onrender.com', COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE must be true/);
    expect(loadConfig({ ...prod, APP_ORIGIN: 'https://seatly.onrender.com/' }).appOrigin).toBe('https://seatly.onrender.com');
  });
});

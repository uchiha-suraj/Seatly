import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api/client';
import { formatBookedAt, formatCardDate, formatLong, formatLongRange, formatShortRange } from '../src/lib/format';
import { bookingIntentFrom, safeReturnTo } from '../src/lib/returnTo';
import { inProgressDelay, retryDelay } from '../src/lib/retry';
import { delay, http, HttpResponse, server } from './msw';

describe('safeReturnTo', () => {
  const origin = 'http://localhost';
  it.each(['/events/abc?seat=A7', '/bookings', '/'])('allows %s', (p) => expect(safeReturnTo(p, origin)).toBe(p));
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', 'events', '', null])('rejects %j', (p) =>
    expect(safeReturnTo(p, origin)).toBeNull(),
  );
  it('extracts the booking intent', () => {
    expect(bookingIntentFrom('/events/66fd?seat=A7')).toEqual({ eventId: '66fd', seatId: 'A7' });
    expect(bookingIntentFrom('/bookings')).toBeNull();
  });
});

describe('retry schedule (Stage 3)', () => {
  it('waits 1 s then 3 s plus up to 250 ms jitter, honouring a larger Retry-After', () => {
    expect(retryDelay(0, null, () => 0)).toBe(1000);
    expect(retryDelay(1, null, () => 0.999)).toBe(3249);
    expect(retryDelay(0, 2000, () => 0)).toBe(2000);
    expect(inProgressDelay(null)).toBe(1000);
  });
});

describe('format', () => {
  it('formats in the event time zone', () => {
    expect(formatCardDate('2026-11-14T14:00:00.000Z', 'Asia/Kolkata')).toBe('SAT, 14 NOV · 7:30 PM');
    expect(formatLongRange('2026-11-14T14:00:00.000Z', '2026-11-14T16:30:00.000Z', 'Asia/Kolkata')).toBe('Saturday, 14 November 2026 · 7:30 – 10:00 PM');
    expect(formatShortRange('2026-11-14T14:00:00.000Z', '2026-11-14T16:30:00.000Z', 'Asia/Kolkata')).toBe('Sat, 14 Nov 2026 · 7:30 – 10:00 PM');
    expect(formatLong('2026-11-14T14:00:00.000Z', 'Asia/Kolkata')).toBe('Saturday, 14 November 2026 · 7:30 PM');
  });
  it('formats "booked on" like the Figma confirmation (date, 12-hour time, zone)', () => {
    expect(formatBookedAt('2026-10-02T10:42:09.884Z')).toMatch(/^2 October 2026, \d{1,2}:\d{2} (AM|PM) \S+$/);
  });
});

describe('api client', () => {
  it('maps the error envelope and Retry-After', async () => {
    server.use(
      http.get('*/api/x', () =>
        HttpResponse.json({ error: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'busy', details: null, requestId: 'r1' } }, { status: 409, headers: { 'Retry-After': '1' } }),
      ),
    );
    const e = await api('/x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ kind: 'http', status: 409, code: 'IDEMPOTENCY_IN_PROGRESS', retryAfterMs: 1000, requestId: 'r1' });
    expect((e as ApiError).isUncertain).toBe(false);
  });

  it('turns a slow response into a timeout (uncertain outcome)', async () => {
    server.use(
      http.get('*/api/slow', async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    const e = (await api('/slow', { timeoutMs: 30 }).catch((x: unknown) => x)) as ApiError;
    expect(e.kind).toBe('timeout');
    expect(e.isUncertain).toBe(true);
  });

  it('treats 5xx as uncertain and network failures as network errors', async () => {
    server.use(http.get('*/api/boom', () => HttpResponse.json({}, { status: 503 })), http.get('*/api/down', () => HttpResponse.error()));
    expect(((await api('/boom').catch((x: unknown) => x)) as ApiError).isUncertain).toBe(true);
    expect(((await api('/down').catch((x: unknown) => x)) as ApiError).kind).toBe('network');
    vi.restoreAllMocks();
  });
});

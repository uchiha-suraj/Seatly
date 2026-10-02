import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import type { BookingDto, EventDetailDto, SeatDto, UserDto } from '@seatly/shared';

export const EVENT_ID = '66fd2a0000000000000000ab';
export const PRIYA: UserDto = { id: 'u1', name: 'Priya Sharma', email: 'priya@example.com' };

export const EVENT: EventDetailDto = {
  id: EVENT_ID,
  slug: 'midnight-jazz',
  title: 'Midnight Jazz at the Lantern Room',
  imageUrl: '/images/events/midnight-jazz.webp',
  imageAlt: 'Stage lights',
  startsAt: '2026-11-14T14:00:00.000Z',
  endsAt: '2026-11-14T16:30:00.000Z',
  timezone: 'Asia/Kolkata',
  venue: 'The Lantern Room, Jubilee Hills',
  totalSeats: 6,
  availableSeats: 4,
  description: 'Late-night standards.',
  layout: { rows: ['A', 'B'], seatsPerRow: 3 },
};

type BookingResponder = (req: { seatId: string; key: string; attempt: number }) => Response | Promise<Response>;

export const db = {
  me: null as UserDto | null,
  booked: new Set<string>(),
  bookingKeys: [] as string[],
  seatFetches: 0,
  bookings: [] as BookingDto[],
  bookingResponder: null as BookingResponder | null,
};

export function resetDb(opts: { me?: UserDto | null; booked?: string[] } = {}) {
  db.me = opts.me === undefined ? PRIYA : opts.me;
  db.booked = new Set(opts.booked ?? ['A2', 'B3']);
  db.bookingKeys = [];
  db.seatFetches = 0;
  db.bookings = [];
  db.bookingResponder = null;
}

function seats(): SeatDto[] {
  return EVENT.layout.rows.flatMap((row) =>
    Array.from({ length: EVENT.layout.seatsPerRow }, (_, i) => {
      const seatId = `${row}${i + 1}`;
      return { seatId, row, number: i + 1, status: db.booked.has(seatId) ? ('booked' as const) : ('available' as const) };
    }),
  );
}

export const err = (status: number, code: string, message = code, headers: Record<string, string> = {}) =>
  HttpResponse.json({ error: { code, message, details: null, requestId: 'test' } }, { status, headers });

export function makeBooking(seatId: string): BookingDto {
  return {
    id: `b-${seatId}`,
    reference: 'SEAT-7KQ4-M2XP',
    bookedAt: '2026-10-02T10:42:09.884Z',
    seat: { seatId, row: seatId[0]!, number: Number(seatId.slice(1)) },
    event: { id: EVENT.id, title: EVENT.title, startsAt: EVENT.startsAt, timezone: EVENT.timezone, venue: EVENT.venue },
    bookedBy: { name: PRIYA.name, email: PRIYA.email },
  };
}

export const handlers = [
  http.get('*/api/auth/me', () => (db.me ? HttpResponse.json({ user: db.me }) : err(401, 'UNAUTHENTICATED'))),
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== 'correct-horse-9') return err(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    db.me = PRIYA;
    return HttpResponse.json({ user: PRIYA });
  }),
  http.post('*/api/auth/logout', () => {
    db.me = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/events', () => HttpResponse.json({ events: [{ ...EVENT, availableSeats: seats().filter((s) => s.status === 'available').length }] })),
  http.get('*/api/events/:id', ({ params }) => (params.id === EVENT_ID ? HttpResponse.json({ event: EVENT }) : err(404, 'EVENT_NOT_FOUND'))),
  http.get('*/api/events/:id/seats', () => {
    db.seatFetches++;
    const s = seats();
    return HttpResponse.json({
      eventId: EVENT_ID,
      asOf: new Date().toISOString(),
      availableSeats: s.filter((x) => x.status === 'available').length,
      totalSeats: s.length,
      layout: EVENT.layout,
      seats: s,
    });
  }),
  http.post('*/api/bookings', async ({ request }) => {
    const key = request.headers.get('Idempotency-Key') ?? '';
    const { seatId } = (await request.json()) as { seatId: string };
    db.bookingKeys.push(key);
    if (db.bookingResponder) return db.bookingResponder({ seatId, key, attempt: db.bookingKeys.length });
    if (!db.me) return err(401, 'UNAUTHENTICATED');
    if (db.booked.has(seatId)) return err(409, 'SEAT_TAKEN', `Seat ${seatId} was just booked by someone else.`);
    db.booked.add(seatId);
    const booking = makeBooking(seatId);
    db.bookings.unshift(booking);
    return HttpResponse.json({ booking }, { status: 201 });
  }),
  http.get('*/api/bookings/:id', ({ params }) => {
    const b = db.bookings.find((x) => x.id === params.id);
    return b ? HttpResponse.json({ booking: b }) : err(404, 'BOOKING_NOT_FOUND');
  }),
  http.get('*/api/me/bookings', () => (db.me ? HttpResponse.json({ bookings: db.bookings }) : err(401, 'UNAUTHENTICATED'))),
];

export const server = setupServer(...handlers);
export { delay, http, HttpResponse };

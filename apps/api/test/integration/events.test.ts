import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Booking, Event, Seat } from '../../src/db/models';
import { seedDatabase } from '../../src/db/seed';
import { eventId, oid, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.stop());

describe('seed', () => {
  it('is idempotent: running it again changes nothing (AC-7)', async () => {
    const counts = async () => [await Event.countDocuments(), await Seat.countDocuments(), await Booking.countDocuments()];
    const before = await counts();
    await seedDatabase(t.clock);
    await seedDatabase(t.clock);
    expect(await counts()).toEqual(before);
    expect(before[0]).toBe(7);
    expect(before[1]).toBe(361);
  });
});

describe('GET /api/events', () => {
  it('lists events with availability, sorted by start time, without login (AC-8)', async () => {
    const res = await supertest(t.server).get('/api/events').expect(200);
    const events = res.body.events as { slug: string; startsAt: string; availableSeats: number; totalSeats: number }[];
    expect(events).toHaveLength(7);
    const starts = events.map((e) => e.startsAt);
    expect([...starts].sort()).toEqual(starts);
    const bySlug = Object.fromEntries(events.map((e) => [e.slug, e]));
    expect(bySlug['midnight-jazz']).toMatchObject({ availableSeats: 42, totalSeats: 60 });
    expect(bySlug['rooftop-acoustic-sessions']).toMatchObject({ availableSeats: 0 });
    expect(bySlug['city-symphony-autumn-gala']).toMatchObject({ availableSeats: 3 });
    expect(bySlug['demo-last-seat']).toMatchObject({ availableSeats: 1, totalSeats: 1 });
    expect(Object.keys(events[0]!).sort()).toEqual(
      ['availableSeats', 'endsAt', 'id', 'imageAlt', 'imageUrl', 'slug', 'startsAt', 'timezone', 'title', 'totalSeats', 'venue'].sort(),
    );
  });
});

describe('GET /api/events/:id', () => {
  it('returns details with description and layout (AC-8)', async () => {
    const id = await eventId('midnight-jazz');
    const res = await supertest(t.server).get(`/api/events/${id}`).expect(200);
    expect(res.body.event).toMatchObject({ id, title: 'Midnight Jazz at the Lantern Room', layout: { rows: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 10 } });
    expect(res.body.event.description).toMatch(/Lantern Quartet/);
  });

  it.each([
    ['unknown', oid()],
    ['malformed', 'not-an-id'],
  ])('returns 404 EVENT_NOT_FOUND for %s ids (AC-9)', async (_label, id) => {
    const res = await supertest(t.server).get(`/api/events/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('GET /api/events/:id/seats', () => {
  it('returns an uncached seat snapshot without leaking who booked', async () => {
    const id = await eventId('midnight-jazz');
    const res = await supertest(t.server).get(`/api/events/${id}/seats`).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.seats).toHaveLength(60);
    expect(res.body.availableSeats).toBe(42);
    expect(res.body.seats[0]).toEqual({ seatId: 'A1', row: 'A', number: 1, status: 'available' });
    expect(res.body.seats.find((s: { seatId: string }) => s.seatId === 'A2').status).toBe('booked');
    expect(JSON.stringify(res.body)).not.toMatch(/userId|bookingId/);
  });

  it('404s for unknown events', async () => {
    await supertest(t.server).get(`/api/events/${oid()}/seats`).expect(404);
  });
});

describe('misc', () => {
  it('health reports the replica set', async () => {
    const res = await supertest(t.server).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(res.body.replicaSet).toBeTruthy();
  });
  it('unknown API routes use the error envelope', async () => {
    const res = await supertest(t.server).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
});

import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Booking, IdempotencyKey, Seat, User } from '../../src/db/models';
import { eventId, expectInvariantHolds, newUser, oid, postBooking, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
let jazz: string;
beforeAll(async () => {
  t = await startTestApp();
  jazz = await eventId('midnight-jazz');
});
afterAll(() => t.stop());
afterEach(() => expectInvariantHolds());

describe('POST /api/bookings — basics', () => {
  it('books an available seat and returns the confirmation payload (AC-10, AC-13)', async () => {
    const { agent, email } = await newUser(t.server, 'Priya Sharma');
    const res = await postBooking(agent, { eventId: jazz, seatId: 'a7' });
    expect(res.status).toBe(201);
    const b = res.body.booking;
    expect(b.reference).toMatch(/^SEAT-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(b.seat).toEqual({ seatId: 'A7', row: 'A', number: 7 });
    expect(b.event).toMatchObject({ id: jazz, title: 'Midnight Jazz at the Lantern Room', timezone: 'Asia/Kolkata' });
    expect(b.bookedBy).toEqual({ name: 'Priya Sharma', email });
    expect(new Date(b.bookedAt).getTime()).toBeGreaterThan(0);

    const user = await User.findOne({ email }).lean();
    const stored = await Booking.findById(b.id).lean();
    expect(stored?.userId.toString()).toBe(user!._id.toString());
    const seat = await Seat.findOne({ seatId: 'A7', eventId: stored!.eventId }).lean();
    expect(seat).toMatchObject({ status: 'booked' });
    expect(seat!.bookingId!.toString()).toBe(b.id);
  });

  it('returns 409 SEAT_TAKEN for a booked seat (AC-11)', async () => {
    const { agent } = await newUser(t.server);
    const res = await postBooking(agent, { eventId: jazz, seatId: 'A7' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEAT_TAKEN');
    expect(res.body.error.message).toBe('Seat A7 was just booked by someone else.');
  });

  it('rejects seats outside the layout (404) and malformed seats (400) without changing data (AC-12)', async () => {
    const { agent } = await newUser(t.server);
    const before = [await Booking.countDocuments(), await Seat.countDocuments({ status: 'booked' })];
    for (const seatId of ['G1', 'A11']) {
      const res = await postBooking(agent, { eventId: jazz, seatId });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SEAT_NOT_FOUND');
    }
    for (const seatId of ['A0', '7A', '', 'A-1']) {
      const res = await postBooking(agent, { eventId: jazz, seatId });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const bad = await postBooking(agent, { eventId: 'nope', seatId: 'A1' });
    expect(bad.status).toBe(400);
    const unknown = await postBooking(agent, { eventId: oid(), seatId: 'A1' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('EVENT_NOT_FOUND');
    expect([await Booking.countDocuments(), await Seat.countDocuments({ status: 'booked' })]).toEqual(before);
  });

  it('never accepts a user id from the client (AC-13)', async () => {
    const victim = await newUser(t.server);
    const { agent } = await newUser(t.server);
    const res = await postBooking(agent, { eventId: jazz, seatId: 'A8', userId: victim.user.id });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.userId).toBeDefined();
    expect(await Seat.findOne({ seatId: 'A8', status: 'booked' }).lean()).toBeNull();
  });

  it('requires a session and a valid Idempotency-Key', async () => {
    const anon = await postBooking(supertest.agent(t.server), { eventId: jazz, seatId: 'A9' });
    expect(anon.status).toBe(401);
    const { agent } = await newUser(t.server);
    const missing = await postBooking(agent, { eventId: jazz, seatId: 'A9' }, null);
    expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_MISSING');
    const invalid = await postBooking(agent, { eventId: jazz, seatId: 'A9' }, 'not-a-uuid');
    expect(invalid.body.error.code).toBe('IDEMPOTENCY_KEY_INVALID');
    expect(await IdempotencyKey.countDocuments({ key: 'not-a-uuid' })).toBe(0);
  });

  it('books different seats independently (AC-16)', async () => {
    const a = await newUser(t.server);
    const b = await newUser(t.server);
    const [ra, rb] = await Promise.all([postBooking(a.agent, { eventId: jazz, seatId: 'B1' }), postBooking(b.agent, { eventId: jazz, seatId: 'B2' })]);
    expect([ra.status, rb.status]).toEqual([201, 201]);
  });
});

describe('reading bookings', () => {
  it('lists only my bookings, most recently booked first (AC-24)', async () => {
    const me = await newUser(t.server);
    const other = await newUser(t.server);
    await postBooking(other.agent, { eventId: jazz, seatId: 'C2' }).expect(201);
    const first = await postBooking(me.agent, { eventId: jazz, seatId: 'C3' }).expect(201);
    t.clock.advance(1000);
    const second = await postBooking(me.agent, { eventId: jazz, seatId: 'C5' }).expect(201);
    const res = await me.agent.get('/api/me/bookings').expect(200);
    expect(res.body.bookings.map((b: { id: string }) => b.id)).toEqual([second.body.booking.id, first.body.booking.id]);
  });

  it('hides other users’ bookings behind the same 404 as a random id (AC-25)', async () => {
    const owner = await newUser(t.server);
    const intruder = await newUser(t.server);
    const booked = await postBooking(owner.agent, { eventId: jazz, seatId: 'C6' }).expect(201);
    const id = booked.body.booking.id as string;
    await owner.agent.get(`/api/bookings/${id}`).expect(200);
    const theirs = await intruder.agent.get(`/api/bookings/${id}`);
    const random = await intruder.agent.get(`/api/bookings/${oid()}`);
    const malformed = await intruder.agent.get('/api/bookings/xyz');
    for (const res of [theirs, random, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
      expect(res.body.error.message).toBe(theirs.body.error.message);
    }
    await supertest(t.server).get(`/api/bookings/${id}`).expect(401);
  });

  it('protects every booking route', async () => {
    const anon = supertest(t.server);
    await anon.get('/api/me/bookings').expect(401);
    await anon.get(`/api/bookings/${oid()}`).expect(401);
    await anon.post('/api/bookings').set('Idempotency-Key', randomUUID()).send({ eventId: jazz, seatId: 'D1' }).expect(401);
  });
});

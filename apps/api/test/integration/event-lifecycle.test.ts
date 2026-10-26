import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Booking, Event, IdempotencyKey, Seat } from '../../src/db/models';
import { DEMO_ROLL_DAYS, rollDemoDates } from '../../src/db/seed';
import { eventId, expectInvariantHolds, newUser, postBooking, startTestApp, type TestContext } from '../helpers/app';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let t: TestContext;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.stop());
afterEach(() => expectInvariantHolds());

/** Moves a seeded event so that it started `agoMs` ago (keeps its duration). */
async function startEvent(slug: string, agoMs: number) {
  const e = (await Event.findOne({ slug }).lean())!;
  const startsAt = new Date(t.clock.now().getTime() - agoMs);
  await Event.updateOne({ _id: e._id }, { $set: { startsAt, endsAt: new Date(startsAt.getTime() + (e.endsAt.getTime() - e.startsAt.getTime())) } });
  return e._id.toString();
}

describe('booking closes when an event starts (AC-28)', () => {
  it('hides started events from the list but keeps them reachable, marked closed', async () => {
    const id = await startEvent('stand-up-saturday', HOUR);
    const list = await supertest(t.server).get('/api/events').expect(200);
    const slugs = (list.body.events as { slug: string; bookingOpen: boolean }[]).map((e) => e.slug);
    expect(slugs).not.toContain('stand-up-saturday');
    expect((list.body.events as { bookingOpen: boolean }[]).every((e) => e.bookingOpen)).toBe(true);

    const detail = await supertest(t.server).get(`/api/events/${id}`).expect(200);
    expect(detail.body.event).toMatchObject({ slug: 'stand-up-saturday', bookingOpen: false });
    await supertest(t.server).get(`/api/events/${id}/seats`).expect(200);
  });

  it('rejects a booking for a started event with a final 409 BOOKING_CLOSED that is replayed', async () => {
    const id = await startEvent('design-systems-meetup', 5 * 60_000);
    const seat = (await Seat.findOne({ eventId: id, status: 'available' }).lean())!;
    const { agent } = await newUser(t.server);
    const key = randomUUID();

    const first = await postBooking(agent, { eventId: id, seatId: seat.seatId }, key);
    expect(first.status).toBe(409);
    expect(first.body.error.code).toBe('BOOKING_CLOSED');

    const again = await postBooking(agent, { eventId: id, seatId: seat.seatId }, key);
    expect(again.status).toBe(409);
    expect(again.headers['idempotent-replayed']).toBe('true');

    expect(await Booking.countDocuments({ eventId: id, seatId: seat.seatId })).toBe(0);
    expect((await Seat.findById(seat._id).lean())!.status).toBe('available');
    expect((await IdempotencyKey.findOne({ key }).lean())!.status).toBe('completed');
  });

  it('still books an event that starts in the future', async () => {
    const id = await eventId('shorts-after-dark');
    const seat = (await Seat.findOne({ eventId: id, status: 'available' }).lean())!;
    const { agent } = await newUser(t.server);
    await postBooking(agent, { eventId: id, seatId: seat.seatId }).expect(201);
  });
});

describe('demo date rolling', () => {
  it('moves a started seeded event forward by whole 7-week steps, keeping weekday, time, seats and bookings', async () => {
    const id = await startEvent('midnight-jazz', 100 * DAY);
    const before = (await Event.findById(id).lean())!;
    const bookingsBefore = await Booking.countDocuments({ eventId: id });

    expect(await rollDemoDates(t.clock)).toBeGreaterThanOrEqual(1);

    const after = (await Event.findById(id).lean())!;
    const shift = after.startsAt.getTime() - before.startsAt.getTime();
    expect(shift % (DEMO_ROLL_DAYS * DAY)).toBe(0);
    expect(after.startsAt.getTime()).toBeGreaterThan(t.clock.now().getTime());
    expect(after.endsAt.getTime() - after.startsAt.getTime()).toBe(before.endsAt.getTime() - before.startsAt.getTime());
    expect(await Booking.countDocuments({ eventId: id })).toBe(bookingsBefore);

    // Nothing left to move: a second run is a no-op.
    expect(await rollDemoDates(t.clock)).toBe(0);
  });

  it('two processes rolling at once move each event only once', async () => {
    const id = await startEvent('rooftop-acoustic-sessions', 2 * DAY);
    const before = (await Event.findById(id).lean())!;
    const moved = await Promise.all([rollDemoDates(t.clock), rollDemoDates(t.clock)]);
    expect(moved[0]! + moved[1]!).toBe(1);
    const after = (await Event.findById(id).lean())!;
    expect(after.startsAt.getTime() - before.startsAt.getTime()).toBe(DEMO_ROLL_DAYS * DAY);
  });

  it('leaves events that have not started alone', async () => {
    const before = await Event.find().sort({ slug: 1 }).lean();
    expect(await rollDemoDates(t.clock)).toBe(0);
    const after = await Event.find().sort({ slug: 1 }).lean();
    expect(after.map((e) => e.startsAt.getTime())).toEqual(before.map((e) => e.startsAt.getTime()));
  });
});

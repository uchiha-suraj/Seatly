import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Booking, Seat } from '../../src/db/models';
import { resetDemoEvent } from '../../src/db/seed';
import { eventId, expectInvariantHolds, newUser, postBooking, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.stop());

describe('one seat, many users (AC-22, in-suite size)', () => {
  it('50 users with distinct keys racing for the last seat → exactly one booking', async () => {
    const demo = await eventId('demo-last-seat');
    await resetDemoEvent('demo-last-seat');
    const users = [];
    for (let i = 0; i < 50; i++) users.push(await newUser(t.server, `Racer ${i}`));

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const racing = users.map(async (u) => {
      await gate;
      return postBooking(u.agent, { eventId: demo, seatId: 'A1' }, randomUUID());
    });
    release();
    const results = await Promise.all(racing);

    const created = results.filter((r) => r.status === 201);
    const taken = results.filter((r) => r.status === 409 && r.body.error.code === 'SEAT_TAKEN');
    expect(created).toHaveLength(1);
    expect(taken).toHaveLength(49);

    const eid = new Types.ObjectId(demo);
    const bookings = await Booking.find({ eventId: eid, seatId: 'A1' }).lean();
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!._id.toString()).toBe(created[0]!.body.booking.id);
    const seat = await Seat.findOne({ eventId: eid, seatId: 'A1' }).lean();
    expect(seat?.bookingId?.toString()).toBe(bookings[0]!._id.toString());
    await expectInvariantHolds();
  });
});

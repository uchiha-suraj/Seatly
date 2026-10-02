import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Booking, IdempotencyKey, Seat } from '../../src/db/models';
import { MAX_TRANSACTION_ATTEMPTS } from '../../src/modules/bookings/service';
import { eventId, expectInvariantHolds, failPoint, newUser, postBooking, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
let jazz: string;
beforeAll(async () => {
  t = await startTestApp();
  jazz = await eventId('midnight-jazz');
});
afterAll(async () => {
  await failPoint(t.appName, 'off');
  await t.stop();
});
afterEach(async () => {
  t.faults.reset();
  await failPoint(t.appName, 'off');
  await expectInvariantHolds();
});

async function seatState(seatId: string) {
  const seat = await Seat.findOne({ seatId, eventId: jazz }).lean();
  return { status: seat?.status, bookingId: seat?.bookingId ?? null, bookings: await Booking.countDocuments({ seatId, eventId: jazz }) };
}

describe('a failed booking never leaves a booked seat without a booking (AC-21)', () => {
  it.each(['afterSeatClaimed', 'beforeKeyCompleted', 'beforeCommit'] as const)('crash at %s → everything rolled back, key released', async (point) => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    t.faults.on(point, async () => {
      throw new Error(`simulated crash at ${point}`);
    });
    const res = await postBooking(agent, { eventId: jazz, seatId: 'F2' }, key);
    expect(res.status).toBe(500);
    expect(await seatState('F2')).toEqual({ status: 'available', bookingId: null, bookings: 0 });
    expect(await IdempotencyKey.countDocuments({ key })).toBe(0);

    // The same key can be retried and now succeeds exactly once.
    t.faults.reset();
    await postBooking(agent, { eventId: jazz, seatId: 'F2' }, key).expect(201);
    expect(await Booking.countDocuments({ seatId: 'F2', eventId: jazz })).toBe(1);
    await Seat.updateOne({ seatId: 'F2', eventId: jazz }, { $set: { status: 'available', bookingId: null, bookedAt: null } });
    await Booking.deleteMany({ seatId: 'F2', eventId: jazz });
  });
});

describe('MongoDB-level faults (failCommand failpoint)', () => {
  it('retries a transient write conflict on the seat claim and books once', async () => {
    const { agent } = await newUser(t.server);
    await failPoint(t.appName, { times: 2 }, { failCommands: ['findAndModify'], errorLabels: ['TransientTransactionError'] });
    const res = await postBooking(agent, { eventId: jazz, seatId: 'F3' });
    expect(res.status).toBe(201);
    expect(await seatState('F3')).toMatchObject({ status: 'booked', bookings: 1 });
  });

  it(`gives up after ${MAX_TRANSACTION_ATTEMPTS} attempts with 503, writes nothing, then the same key succeeds`, async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    await failPoint(t.appName, 'alwaysOn', { failCommands: ['findAndModify'], errorLabels: ['TransientTransactionError'] });
    const res = await postBooking(agent, { eventId: jazz, seatId: 'F4' }, key);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('BOOKING_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('1');
    expect(await seatState('F4')).toEqual({ status: 'available', bookingId: null, bookings: 0 });
    expect(await IdempotencyKey.countDocuments({ key })).toBe(0);
    await failPoint(t.appName, 'off');
    await postBooking(agent, { eventId: jazz, seatId: 'F4' }, key).expect(201);
  });

  it('retries a commit whose result is unknown and books once', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    // MaxTimeMSExpired (50) on commit is the usual "unknown result": the server stays healthy,
    // so the retry path is exercised without depending on how fast the driver rediscovers a primary.
    await failPoint(t.appName, { times: 1 }, { failCommands: ['commitTransaction'], errorLabels: ['UnknownTransactionCommitResult'], errorCode: 50 });
    const res = await postBooking(agent, { eventId: jazz, seatId: 'F5' }, key);
    expect(res.status).toBe(201);
    expect(await seatState('F5')).toMatchObject({ status: 'booked', bookings: 1 });
    expect((await IdempotencyKey.findOne({ key }).lean())?.status).toBe('completed');
  });

  it('a primary shutting down during commit never double-books (201, or a safe 503 that keeps the key)', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    // ShutdownInProgress (91) makes the driver rediscover the primary; how long that takes depends
    // on the machine, so the request may finish within the deadline or end as a retryable 503.
    await failPoint(t.appName, { times: 1 }, { failCommands: ['commitTransaction'], errorLabels: ['UnknownTransactionCommitResult'], errorCode: 91 });
    const res = await postBooking(agent, { eventId: jazz, seatId: 'F9' }, key);
    expect([201, 503]).toContain(res.status);
    const state = await seatState('F9');
    expect(state.bookings).toBeLessThanOrEqual(1);
    if (res.status === 201) expect(state).toMatchObject({ status: 'booked', bookings: 1 });
    // afterEach checks the full invariant: booked seat ⇔ exactly one booking.
  });

  it('a crash after commit (response lost) is recovered by a same-key retry: same booking, no duplicate', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    t.faults.on('afterCommit', async () => {
      throw new Error('connection dropped after commit');
    });
    const lost = await postBooking(agent, { eventId: jazz, seatId: 'F7' }, key);
    expect(lost.status).toBe(500);
    t.faults.reset();
    const retry = await postBooking(agent, { eventId: jazz, seatId: 'F7' }, key).expect(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(await Booking.countDocuments({ seatId: 'F7', eventId: jazz })).toBe(1);
  });
});

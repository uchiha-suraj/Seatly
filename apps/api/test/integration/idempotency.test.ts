import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Booking, IdempotencyKey } from '../../src/db/models';
import { deferred, eventId, expectInvariantHolds, newUser, postBooking, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
let jazz: string;
beforeAll(async () => {
  t = await startTestApp();
  jazz = await eventId('midnight-jazz');
});
afterAll(() => t.stop());
afterEach(async () => {
  t.faults.reset();
  await expectInvariantHolds();
});

describe('idempotent booking', () => {
  it('replays the original booking for a sequential retry (AC-17)', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    const first = await postBooking(agent, { eventId: jazz, seatId: 'D1' }, key).expect(201);
    const retry = await postBooking(agent, { eventId: jazz, seatId: 'd1' }, key).expect(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(retry.body).toEqual(first.body);
    expect(await Booking.countDocuments({ eventId: jazz, seatId: 'D1' })).toBe(1);
  });

  it('rejects the same key with a different payload and leaves the original untouched (AC-18)', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    await postBooking(agent, { eventId: jazz, seatId: 'D2' }, key).expect(201);
    const before = await IdempotencyKey.findOne({ key }).lean();
    const res = await postBooking(agent, { eventId: jazz, seatId: 'D3' }, key);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await IdempotencyKey.findOne({ key }).lean()).toEqual(before);
    expect(await Booking.countDocuments({ eventId: jazz, seatId: 'D3' })).toBe(0);
  });

  it('20 concurrent same-key requests create exactly one booking (AC-19)', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 20 }, () => postBooking(agent, { eventId: jazz, seatId: 'D6' }, key)));
    const created = results.filter((r) => r.status === 201);
    const inProgress = results.filter((r) => r.status === 409 && r.body.error.code === 'IDEMPOTENCY_IN_PROGRESS');
    expect(created.length + inProgress.length).toBe(20);
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(new Set(created.map((r) => r.body.booking.id)).size).toBe(1);
    for (const r of inProgress) expect(r.headers['retry-after']).toBe('1');
    const bookingId = created[0]!.body.booking.id;
    const followUp = await postBooking(agent, { eventId: jazz, seatId: 'D6' }, key).expect(201);
    expect(followUp.headers['idempotent-replayed']).toBe('true');
    expect(followUp.body.booking.id).toBe(bookingId);
    expect(await Booking.countDocuments({ eventId: jazz, seatId: 'D6' })).toBe(1);
    const keys = await IdempotencyKey.find({ key }).lean();
    expect(keys).toHaveLength(1);
    expect(keys[0]!.status).toBe('completed');
  });

  it('answers 409 IN_PROGRESS with Retry-After while the same key is being processed (AC-19b)', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    const reached = deferred();
    const hold = deferred();
    t.faults.on('afterKeyClaimed', async () => {
      reached.resolve();
      await hold.promise;
    });
    const firstP = postBooking(agent, { eventId: jazz, seatId: 'D7' }, key).then((r) => r);
    await reached.promise;
    t.faults.reset();
    const second = await postBooking(agent, { eventId: jazz, seatId: 'D7' }, key);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    expect(second.headers['retry-after']).toBe('1');
    hold.resolve();
    const first = await firstP;
    expect(first.status).toBe(201);
    const retry = await postBooking(agent, { eventId: jazz, seatId: 'D7' }, key).expect(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.booking.id).toBe(first.body.booking.id);
  });

  it('lets a retry take over a key whose owner stalled past its lease; the late owner cannot complete it', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    const reached = deferred();
    const hold = deferred();
    t.faults.on('afterKeyClaimed', async () => {
      reached.resolve();
      await hold.promise;
    });
    const staleP = postBooking(agent, { eventId: jazz, seatId: 'D8' }, key).then((r) => r);
    await reached.promise;
    t.faults.reset();
    t.clock.advance(t.config.idempotencyLeaseMs + 1000);
    const takeover = await postBooking(agent, { eventId: jazz, seatId: 'D8' }, key);
    expect(takeover.status).toBe(201);
    hold.resolve();
    const stale = await staleP;
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    expect(await Booking.countDocuments({ eventId: jazz, seatId: 'D8' })).toBe(1);
    const rec = await IdempotencyKey.findOne({ key }).lean();
    expect(rec?.status).toBe('completed');
    expect(rec?.bookingId?.toString()).toBe(takeover.body.booking.id);
  });

  it('stores SEAT_TAKEN as a final answer and replays it', async () => {
    const { agent } = await newUser(t.server);
    const key = randomUUID();
    const first = await postBooking(agent, { eventId: jazz, seatId: 'A2' }, key);
    expect(first.status).toBe(409);
    const again = await postBooking(agent, { eventId: jazz, seatId: 'A2' }, key);
    expect(again.status).toBe(409);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body).toEqual(first.body);
  });

  it('scopes keys per user: the same key value from two users books two seats', async () => {
    const key = randomUUID();
    const a = await newUser(t.server);
    const b = await newUser(t.server);
    await postBooking(a.agent, { eventId: jazz, seatId: 'E1' }, key).expect(201);
    await postBooking(b.agent, { eventId: jazz, seatId: 'E3' }, key).expect(201);
  });

  it('does not store 401s: after logging in again the same key books normally', async () => {
    const { agent, email } = await newUser(t.server);
    const key = randomUUID();
    await agent.post('/api/auth/logout').expect(204);
    await postBooking(agent, { eventId: jazz, seatId: 'E4' }, key).expect(401);
    expect(await IdempotencyKey.countDocuments({ key })).toBe(0);
    await agent.post('/api/auth/login').send({ email, password: 'correct-horse-9' }).expect(200);
    await postBooking(agent, { eventId: jazz, seatId: 'E4' }, key).expect(201);
  });
});

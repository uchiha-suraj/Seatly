import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import mongoose, { Types } from 'mongoose';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig, type Config } from '../../src/config';
import { ensureIndexes } from '../../src/db/connection';
import { Booking, Event, Seat } from '../../src/db/models';
import { seedDatabase } from '../../src/db/seed';
import type { Clock } from '../../src/lib/clock';
import type { FaultPoint, Faults } from '../../src/lib/faults';
import { createLogger } from '../../src/logger';

export class TestClock implements Clock {
  private offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  advance(ms: number): void {
    this.offsetMs += ms;
  }
}

type Handler = (ctx: { attempt: number; key: string }) => Promise<void>;

export class TestFaults implements Faults {
  private handlers = new Map<FaultPoint, Handler>();
  on(point: FaultPoint, handler: Handler): void {
    this.handlers.set(point, handler);
  }
  reset(): void {
    this.handlers.clear();
  }
  async hit(point: FaultPoint, ctx: { attempt: number; key: string }): Promise<void> {
    await this.handlers.get(point)?.(ctx);
  }
}

export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export interface TestContext {
  server: Server;
  clock: TestClock;
  faults: TestFaults;
  config: Config;
  appName: string;
  stop(): Promise<void>;
}

/** One isolated database per Vitest worker, wiped and re-seeded for every test file. */
export async function startTestApp(overrides: Partial<Config> = {}): Promise<TestContext> {
  const uri = process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/?replicaSet=rs0';
  const pool = process.env.VITEST_POOL_ID ?? '0';
  const appName = `seatly-test-${pool}`;
  await mongoose.connect(uri, { dbName: `seatly_test_${pool}`, appName, serverSelectionTimeoutMS: 5000, autoIndex: false });
  await mongoose.connection.dropDatabase();
  await ensureIndexes();
  const clock = new TestClock();
  const faults = new TestFaults();
  const config: Config = {
    ...loadConfig({ NODE_ENV: 'test', MONGODB_URI: uri, ARGON2_MEMORY_KIB: '8192', LOG_LEVEL: 'silent' }),
    ...overrides,
  };
  await seedDatabase(clock);
  const app = createApp({ config, clock, faults, logger: createLogger('silent') });
  const server = app.listen(0);
  return {
    server,
    clock,
    faults,
    config,
    appName,
    async stop() {
      await new Promise<void>((r) => server.close(() => r()));
      await mongoose.disconnect();
    },
  };
}

let userCounter = 0;
export async function newUser(server: Server, name = 'Test User') {
  const agent = supertest.agent(server);
  const email = `user-${Date.now()}-${++userCounter}@example.com`;
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'correct-horse-9' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, user: res.body.user as { id: string; name: string; email: string } };
}

export async function eventId(slug: string): Promise<string> {
  const e = await Event.findOne({ slug }).lean();
  if (!e) throw new Error(`no event ${slug}`);
  return e._id.toString();
}

export function postBooking(agent: supertest.Agent, body: Record<string, unknown>, key: string | null = randomUUID()) {
  const req = agent.post('/api/bookings');
  if (key !== null) req.set('Idempotency-Key', key);
  return req.send(body);
}

/** MongoDB's own fault injection, scoped to this worker's connections via appName. */
export async function failPoint(
  appName: string,
  mode: 'off' | 'alwaysOn' | { times: number },
  data: { failCommands: string[]; errorLabels?: string[]; errorCode?: number } = { failCommands: [] },
): Promise<void> {
  const admin = mongoose.connection.db!.admin();
  await admin.command({
    configureFailPoint: 'failCommand',
    mode,
    data: mode === 'off' ? {} : { appName, errorCode: 112, ...data },
  });
}

/**
 * The booking invariant, checked over the whole database:
 * seat.status = booked ⇔ exactly one booking for (event, seat) ⇔ seat.bookingId = booking._id.
 */
export async function expectInvariantHolds(): Promise<void> {
  const seats = await Seat.find().lean();
  const bookings = await Booking.find().lean();
  const byKey = new Map<string, (typeof bookings)[number][]>();
  for (const b of bookings) {
    const k = `${b.eventId.toString()}:${b.seatId}`;
    byKey.set(k, [...(byKey.get(k) ?? []), b]);
  }
  const problems: string[] = [];
  for (const s of seats) {
    const list = byKey.get(`${s.eventId.toString()}:${s.seatId}`) ?? [];
    if (list.length > 1) problems.push(`${s.seatId}: ${list.length} bookings`);
    if (s.status === 'booked' && (list.length !== 1 || s.bookingId?.toString() !== list[0]!._id.toString())) {
      problems.push(`${s.seatId}: booked without a matching booking`);
    }
    if (s.status === 'available' && list.length > 0) problems.push(`${s.seatId}: available but has a booking`);
    if (s.status === 'available' && s.bookingId) problems.push(`${s.seatId}: available but bookingId set`);
  }
  if (problems.length) throw new Error(`Booking invariant violated:\n${problems.join('\n')}`);
}

export const oid = () => new Types.ObjectId().toString();

/**
 * Concurrency demonstration: N distinct authenticated users, N distinct Idempotency-Keys,
 * one fresh seat, all requests released at the same instant (optionally across several API
 * processes). Afterwards MongoDB is queried directly. Reports measured numbers only and exits
 * non-zero unless: successes = 1, persisted bookings = 1, unexpected responses = 0.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Types } from 'mongoose';
import { loadConfig } from '../src/config';
import { connectDatabase, disconnectDatabase } from '../src/db/connection';
import { Booking, IdempotencyKey, Seat } from '../src/db/models';
import { resetDemoEvent } from '../src/db/seed';
import { args, assertTargetsUp, book, ensureUsers, eventIdBySlug, percentile, type Shot } from './demo-lib';

const opts = args();
const config = loadConfig();
if (!config.demoMode) {
  console.error('Set DEMO_MODE=true for the API and this script (it resets the demo event).');
  process.exit(1);
}
const n = Number(opts.users);
const targets = opts.targets.split(',').map((t) => t.trim().replace(/\/$/, ''));
const seatId = opts.seat.toUpperCase();

await assertTargetsUp(targets);
await connectDatabase(config.mongodbUri);
console.log(`\nSeatly concurrency demonstration — ${n} users, seat ${seatId} of "${opts.event}", ${targets.length} API process(es)`);

console.log('1/4  Resetting the demo seat…');
await resetDemoEvent(opts.event);

console.log(`2/4  Registering / logging in ${n} demo users (setup, not timed)…`);
const users = await ensureUsers(targets[0]!, n, Number(opts.parallel));
const eventId = await eventIdBySlug(targets[0]!, opts.event);

console.log(`3/4  Releasing ${n} booking requests at once…`);
let release!: () => void;
const gate = new Promise<void>((r) => (release = r));
const pending = users.map(async (u, i) => {
  await gate;
  return book(targets[i % targets.length]!, u.cookie, randomUUID(), eventId, seatId);
});
const t0 = performance.now();
release();
const shots: Shot[] = await Promise.all(pending);
const wallMs = performance.now() - t0;

console.log('4/4  Verifying in MongoDB…');
const eid = new Types.ObjectId(eventId);
const persisted = await Booking.find({ eventId: eid, seatId }).lean();
const seat = await Seat.findOne({ eventId: eid, seatId }).lean();
const completedKeys = await IdempotencyKey.countDocuments({ status: 'completed', bookingId: { $in: persisted.map((b) => b._id) } });

const created = shots.filter((s) => s.status === 201);
const conflicts = shots.filter((s) => s.status === 409 && s.code === 'SEAT_TAKEN');
const unavailable = shots.filter((s) => s.status === 503);
const unexpected = shots.filter((s) => !(s.status === 201 || (s.status === 409 && s.code === 'SEAT_TAKEN')));
const seatConsistent =
  seat?.status === 'booked' && persisted.length === 1 && seat.bookingId?.toString() === persisted[0]!._id.toString();
const winnerMatches = created.length === 1 && created[0]!.bookingId === persisted[0]?._id.toString();
const pass = created.length === 1 && persisted.length === 1 && unexpected.length === 0 && seatConsistent && winnerMatches;

const report = {
  ranAt: new Date().toISOString(),
  environment: { mongodbUri: config.mongodbUri.replace(/\/\/[^@]*@/, '//***@'), targets, node: process.version },
  users: n,
  event: opts.event,
  seatId,
  responses: {
    created201: created.length,
    seatTaken409: conflicts.length,
    unavailable503: unavailable.length,
    unexpected: unexpected.length,
    unexpectedSamples: unexpected.slice(0, 5),
  },
  perTarget: Object.fromEntries(targets.map((t) => [t, shots.filter((s) => s.target === t).length])),
  latencyMs: {
    p50: Math.round(percentile(shots.map((s) => s.ms), 50)),
    p95: Math.round(percentile(shots.map((s) => s.ms), 95)),
    max: Math.round(Math.max(...shots.map((s) => s.ms))),
    wall: Math.round(wallMs),
  },
  database: {
    persistedBookingsForSeat: persisted.length,
    seatStatus: seat?.status ?? null,
    seatBookingIdMatchesBooking: seatConsistent,
    completedKeysForWinner: completedKeys,
  },
  pass,
};

console.log('\n  Result');
console.table({
  'Successful bookings (201)': created.length,
  'Seat taken (409 SEAT_TAKEN)': conflicts.length,
  'Retryable (503)': unavailable.length,
  'Unexpected responses': unexpected.length,
  'Bookings persisted for seat': persisted.length,
  'Seat status': seat?.status ?? 'missing',
});
console.log(`  latency p50 ${report.latencyMs.p50} ms · p95 ${report.latencyMs.p95} ms · wall ${report.latencyMs.wall} ms`);
console.log(pass ? '\n  PASS: exactly one booking, every other request was told the seat was taken.\n' : '\n  FAIL: see report.\n');

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../demo-results');
await mkdir(outDir, { recursive: true });
const file = path.join(outDir, `concurrency-${report.ranAt.replace(/[:.]/g, '-')}.json`);
await writeFile(file, JSON.stringify(report, null, 2));
console.log(`  Report written to ${path.relative(process.cwd(), file)}`);
console.log('  Note: a local controlled run, not a measure of production capacity.\n');

await disconnectDatabase();
process.exit(pass ? 0 : 1);

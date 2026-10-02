/**
 * Idempotency demonstration on the one-seat demo event:
 *  A. same key + same payload, sequentially → original booking replayed
 *  B. same key + different payload → 422
 *  C. 20 parallel requests with one key → exactly one booking; others in-progress or replay
 */
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { loadConfig } from '../src/config';
import { connectDatabase, disconnectDatabase } from '../src/db/connection';
import { Booking, IdempotencyKey } from '../src/db/models';
import { resetDemoEvent } from '../src/db/seed';
import { args, assertTargetsUp, book, ensureUser, eventIdBySlug } from './demo-lib';

const opts = args();
const config = loadConfig();
if (!config.demoMode) {
  console.error('Set DEMO_MODE=true for the API and this script (it resets the demo event).');
  process.exit(1);
}
const base = opts.targets.split(',')[0]!.replace(/\/$/, '');
await assertTargetsUp([base]);
await connectDatabase(config.mongodbUri);
const user = await ensureUser(base, 900);
const eventId = await eventIdBySlug(base, opts.event);
const seatId = opts.seat.toUpperCase();
const checks: [string, boolean][] = [];

console.log('\nA. Sequential retry with the same key');
await resetDemoEvent(opts.event);
const k1 = randomUUID();
const a1 = await book(base, user.cookie, k1, eventId, seatId);
const a2 = await book(base, user.cookie, k1, eventId, seatId);
console.log(`   1st: ${a1.status} booking ${a1.bookingId}`);
console.log(`   2nd: ${a2.status} booking ${a2.bookingId} replayed=${a2.replayed}`);
checks.push(['A: first request created a booking', a1.status === 201]);
checks.push(['A: retry returned the same booking, marked as replay', a2.status === 201 && a2.bookingId === a1.bookingId && a2.replayed]);

console.log('\nB. Same key, different seat');
const b = await book(base, user.cookie, k1, eventId, seatId === 'A1' ? 'A2' : 'A1');
console.log(`   ${b.status} ${b.code}`);
checks.push(['B: changed payload rejected with 422 IDEMPOTENCY_KEY_REUSED', b.status === 422 && b.code === 'IDEMPOTENCY_KEY_REUSED']);

console.log('\nC. 20 simultaneous requests with one key');
await resetDemoEvent(opts.event);
const k2 = randomUUID();
let release!: () => void;
const gate = new Promise<void>((r) => (release = r));
const shots = Array.from({ length: 20 }, async () => {
  await gate;
  return book(base, user.cookie, k2, eventId, seatId);
});
release();
const results = await Promise.all(shots);
const created = results.filter((r) => r.status === 201);
const inProgress = results.filter((r) => r.status === 409 && r.code === 'IDEMPOTENCY_IN_PROGRESS');
const other = results.filter((r) => !(r.status === 201 || (r.status === 409 && r.code === 'IDEMPOTENCY_IN_PROGRESS')));
const ids = new Set(created.map((r) => r.bookingId));
const followUp = await book(base, user.cookie, k2, eventId, seatId);
const persisted = await Booking.countDocuments({ eventId: new Types.ObjectId(eventId), seatId });
const keyDocs = await IdempotencyKey.countDocuments({ key: k2 });
console.log(`   201 responses: ${created.length} (distinct bookings: ${ids.size}, replays: ${created.filter((r) => r.replayed).length})`);
console.log(`   409 IN_PROGRESS: ${inProgress.length} · other: ${other.length}`);
console.log(`   follow-up: ${followUp.status} replayed=${followUp.replayed} same booking=${ids.has(followUp.bookingId)}`);
console.log(`   persisted bookings for seat: ${persisted} · key records: ${keyDocs}`);
checks.push(['C: exactly one booking id among 201 responses', ids.size === 1]);
checks.push(['C: no unexpected responses', other.length === 0]);
checks.push(['C: follow-up returns the same booking as a replay', followUp.status === 201 && followUp.replayed && ids.has(followUp.bookingId)]);
checks.push(['C: exactly one booking persisted and one key record', persisted === 1 && keyDocs === 1]);

console.log('\nChecks');
for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
await resetDemoEvent(opts.event);
await disconnectDatabase();
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);

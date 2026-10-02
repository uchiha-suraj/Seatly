import mongoose, { Types } from 'mongoose';
import { sha256Hex } from '../lib/crypto';
import type { Clock } from '../lib/clock';
import { Booking, Event, Seat, User } from './models';

interface SeedEvent {
  slug: string;
  title: string;
  description: string;
  venue: string;
  imageAlt: string;
  /** Days after the first seed run, and local start time in IST. */
  offsetDays: number;
  localTime: string;
  durationMinutes: number;
  rows: string[];
  seatsPerRow: number;
  /** Seats pre-booked by the demo "house" account so the catalogue looks lived-in. */
  preBooked: string[] | number;
}

const SIX_ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const SEED_EVENTS: SeedEvent[] = [
  {
    slug: 'midnight-jazz',
    title: 'Midnight Jazz at the Lantern Room',
    description:
      'An evening of late-night standards and new arrangements from the Lantern Quartet, with a guest vocalist for the second set. Doors open 30 minutes before the show. Seating is reserved — pick your exact seat below.',
    venue: 'The Lantern Room, Jubilee Hills',
    imageAlt: 'Warm stage lights over a jazz quartet’s instruments',
    offsetDays: 14,
    localTime: '19:30',
    durationMinutes: 150,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: ['A2', 'A3', 'B5', 'B6', 'B9', 'C1', 'C4', 'C8', 'C9', 'D4', 'D5', 'E2', 'E5', 'E6', 'E7', 'F1', 'F6', 'F10'],
  },
  {
    slug: 'shorts-after-dark',
    title: 'Shorts After Dark: Indie Film Night',
    description:
      'Eight short films from independent South Indian filmmakers, followed by a moderated Q&A with three of the directors. Subtitled in English.',
    venue: 'Studio 9, Madhapur',
    imageAlt: 'A projector beam cutting through a dark screening room',
    offsetDays: 20,
    localTime: '20:00',
    durationMinutes: 140,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: 42,
  },
  {
    slug: 'city-symphony-autumn-gala',
    title: 'City Symphony: Autumn Gala',
    description:
      'The City Symphony opens its season with Dvořák’s New World Symphony and a new commission for sitar and orchestra. Formal dress encouraged.',
    venue: 'Orchid Hall, Banjara Hills',
    imageAlt: 'Violin bows raised in a concert hall',
    offsetDays: 22,
    localTime: '18:00',
    durationMinutes: 150,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: 57,
  },
  {
    slug: 'stand-up-saturday',
    title: 'Stand-up Saturday',
    description: 'Five comics, one microphone, no safe seats in the front row. Recommended for ages 16 and up.',
    venue: 'The Basement, Gachibowli',
    imageAlt: 'A single microphone on a stand under a spotlight',
    offsetDays: 28,
    localTime: '21:00',
    durationMinutes: 120,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: 9,
  },
  {
    slug: 'design-systems-meetup',
    title: 'Design Systems Meetup',
    description:
      'Three short talks on tokens, accessible components and design–engineering handoff, then open discussion. Snacks provided.',
    venue: 'Hall 2, Hitech City',
    imageAlt: 'Colour swatches and component sketches on a desk',
    offsetDays: 33,
    localTime: '18:30',
    durationMinutes: 150,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: 33,
  },
  {
    slug: 'rooftop-acoustic-sessions',
    title: 'Rooftop Acoustic Sessions',
    description: 'Unplugged sets from three singer-songwriters as the sun goes down over the city.',
    venue: 'Skyline Terrace, Kondapur',
    imageAlt: 'An acoustic guitar on a rooftop at sunset',
    offsetDays: 35,
    localTime: '17:00',
    durationMinutes: 180,
    rows: SIX_ROWS,
    seatsPerRow: 10,
    preBooked: 60,
  },
  {
    slug: 'demo-last-seat',
    title: 'Last Seat Standing',
    description:
      'A demonstration event with exactly one seat. Use it to see what happens when many people try to book the same seat at once: exactly one booking succeeds.',
    venue: 'Seatly Demo Hall',
    imageAlt: 'A single empty seat under a spotlight',
    offsetDays: 45,
    localTime: '19:00',
    durationMinutes: 60,
    rows: ['A'],
    seatsPerRow: 1,
    preBooked: [],
  },
];

export const HOUSE_EMAIL = 'house@seatly.test';
const IST_OFFSET_MIN = 330;

function startsAtFor(base: Date, offsetDays: number, localTime: string): Date {
  const [h, m] = localTime.split(':').map(Number) as [number, number];
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offsetDays, h, m));
  return new Date(d.getTime() - IST_OFFSET_MIN * 60_000);
}

function seatIds(rows: string[], perRow: number): string[] {
  return rows.flatMap((r) => Array.from({ length: perRow }, (_, i) => `${r}${i + 1}`));
}

/** Deterministic spread of `count` seats so re-seeding books the same ones. */
function pickSeats(all: string[], count: number): string[] {
  if (count >= all.length) return all;
  return [...all].sort((a, b) => sha256Hex(a).localeCompare(sha256Hex(b))).slice(0, count);
}

function seedReference(slug: string, seatId: string): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const h = sha256Hex(`${slug}:${seatId}`);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[Number.parseInt(h.slice(i * 2, i * 2 + 2), 16) % 32];
  return `SEAT-${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Idempotent: events are upserted by slug, seats by (eventId, seatId) with $setOnInsert, and
 * house bookings by (eventId, seatId). Running it again never un-books a seat or duplicates data.
 */
export async function seedDatabase(clock: Clock): Promise<{ events: number; seats: number }> {
  const now = clock.now();
  const house = await User.findOneAndUpdate(
    { email: HOUSE_EMAIL },
    // '!' is not a valid argon2 hash, so nobody can ever log in as the house account.
    { $setOnInsert: { name: 'Seatly house bookings', email: HOUSE_EMAIL, passwordHash: '!', createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  if (!house) throw new Error('could not create house user');

  let seatCount = 0;
  for (const e of SEED_EVENTS) {
    const startsAt = startsAtFor(now, e.offsetDays, e.localTime);
    const endsAt = new Date(startsAt.getTime() + e.durationMinutes * 60_000);
    const all = seatIds(e.rows, e.seatsPerRow);
    await Event.updateOne(
      { slug: e.slug },
      {
        $set: {
          title: e.title,
          description: e.description,
          venue: e.venue,
          imageUrl: `/images/events/${e.slug}.webp`,
          imageAlt: e.imageAlt,
          timezone: 'Asia/Kolkata',
          layout: { rows: e.rows, seatsPerRow: e.seatsPerRow },
          totalSeats: all.length,
        },
        $setOnInsert: { startsAt, endsAt },
      },
      { upsert: true },
    );
    const event = await Event.findOne({ slug: e.slug }).lean();
    if (!event) throw new Error(`event ${e.slug} missing after upsert`);

    await Seat.bulkWrite(
      all.map((seatId) => ({
        updateOne: {
          filter: { eventId: event._id, seatId },
          update: {
            $setOnInsert: {
              eventId: event._id,
              seatId,
              row: seatId.slice(0, 1),
              number: Number(seatId.slice(1)),
              status: 'available',
              bookingId: null,
              bookedAt: null,
            },
          },
          upsert: true,
        },
      })),
    );
    seatCount += all.length;

    const preBooked = Array.isArray(e.preBooked) ? e.preBooked : pickSeats(all, e.preBooked);
    if (preBooked.length) await bookForHouse(event._id, e.slug, preBooked, house._id, now);
  }
  return { events: SEED_EVENTS.length, seats: seatCount };
}

/** House bookings keep the same invariant as real ones: seat + booking change in one transaction. */
async function bookForHouse(eventId: Types.ObjectId, slug: string, seatIdsToBook: string[], userId: Types.ObjectId, now: Date) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const seatId of seatIdsToBook) {
        const seat = await Seat.findOne({ eventId, seatId }, null, { session }).lean();
        if (!seat || seat.status === 'booked') continue; // already booked (by house or a real user)
        const booking = await Booking.findOneAndUpdate(
          { eventId, seatId },
          {
            $setOnInsert: {
              _id: new Types.ObjectId(),
              reference: seedReference(slug, seatId),
              userId,
              eventId,
              seatId,
              idempotencyKeyId: null,
              createdAt: now,
            },
          },
          { upsert: true, returnDocument: 'after', session },
        ).lean();
        if (!booking) continue;
        await Seat.updateOne(
          { _id: seat._id, status: 'available' },
          { $set: { status: 'booked', bookingId: booking._id, bookedAt: now } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

/** Demo-only: frees the demo event's seats and removes its bookings and their idempotency keys. */
export async function resetDemoEvent(slug = 'demo-last-seat'): Promise<{ bookingsRemoved: number }> {
  const event = await Event.findOne({ slug }).lean();
  if (!event) throw new Error(`Demo event ${slug} not found — run npm run seed first.`);
  const { IdempotencyKey } = await import('./models');
  const bookings = await Booking.find({ eventId: event._id }, { _id: 1, idempotencyKeyId: 1 }).lean();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await IdempotencyKey.deleteMany({ bookingId: { $in: bookings.map((b) => b._id) } }, { session });
      await Booking.deleteMany({ eventId: event._id }, { session });
      await Seat.updateMany({ eventId: event._id }, { $set: { status: 'available', bookingId: null, bookedAt: null } }, { session });
    });
  } finally {
    await session.endSession();
  }
  // Keys of demo attempts that ended in SEAT_TAKEN have no bookingId; they belong to demo users.
  const demoUsers = await User.find({ email: /^demo-user-\d+@seatly\.test$/ }, { _id: 1 }).lean();
  await IdempotencyKey.deleteMany({ userId: { $in: demoUsers.map((u) => u._id) } });
  return { bookingsRemoved: bookings.length };
}

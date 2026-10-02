import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

// Indexes are declared here and created explicitly with syncIndexes() at startup (autoIndex off),
// so a missing unique index fails startup instead of silently allowing duplicates.
const base = { autoIndex: false, versionKey: false } as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    createdAt: { type: Date, required: true },
  },
  base,
);
userSchema.index({ email: 1 }, { unique: true, name: 'email_unique' });

const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    // TTL clean-up only; expiry is enforced in code because the TTL monitor runs ~once a minute.
    expiresAt: { type: Date, required: true },
  },
  base,
);
sessionSchema.index({ tokenHash: 1 }, { unique: true, name: 'tokenHash_unique' });
sessionSchema.index({ userId: 1 }, { name: 'userId' });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' });

const eventSchema = new Schema(
  {
    slug: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    venue: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imageAlt: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: {
      type: Date,
      required: true,
      validate: {
        validator(this: { startsAt?: Date }, v: Date) {
          return !this.startsAt || v > this.startsAt;
        },
        message: 'endsAt must be after startsAt',
      },
    },
    timezone: { type: String, required: true },
    layout: {
      type: new Schema(
        {
          rows: { type: [String], required: true },
          seatsPerRow: { type: Number, required: true, min: 1, max: 99 },
        },
        { _id: false },
      ),
      required: true,
    },
    totalSeats: { type: Number, required: true, min: 1 },
  },
  base,
);
eventSchema.index({ slug: 1 }, { unique: true, name: 'slug_unique' });
eventSchema.index({ startsAt: 1 }, { name: 'startsAt' });

/** One document per seat: the unit of contention. */
const seatSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    seatId: { type: String, required: true, match: /^[A-Z](?:[1-9]|[1-9][0-9])$/ },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    status: { type: String, enum: ['available', 'booked'], required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    bookedAt: { type: Date, default: null },
  },
  base,
);
seatSchema.index({ eventId: 1, seatId: 1 }, { unique: true, name: 'event_seat_unique' });
seatSchema.index({ eventId: 1, status: 1 }, { name: 'event_status' });

const bookingSchema = new Schema(
  {
    reference: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    seatId: { type: String, required: true },
    // null for bookings created by the seed script (demo data), set for every API booking.
    idempotencyKeyId: { type: Schema.Types.ObjectId, ref: 'IdempotencyKey', default: null },
    createdAt: { type: Date, required: true },
  },
  base,
);
// The database-level guarantee: at most one booking per (event, seat), whatever the code does.
bookingSchema.index({ eventId: 1, seatId: 1 }, { unique: true, name: 'event_seat_unique' });
bookingSchema.index({ reference: 1 }, { unique: true, name: 'reference_unique' });
bookingSchema.index({ userId: 1, createdAt: -1 }, { name: 'user_createdAt' });

const idempotencyKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    operation: { type: String, enum: ['booking.create'], required: true },
    key: { type: String, required: true },
    fingerprint: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], required: true },
    attemptId: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
    response: {
      type: new Schema({ statusCode: Number, body: Schema.Types.Mixed }, { _id: false }),
      default: null,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    createdAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  base,
);
idempotencyKeySchema.index({ userId: 1, operation: 1, key: 1 }, { unique: true, name: 'user_op_key_unique' });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
export type EventDoc = InferSchemaType<typeof eventSchema> & { _id: Types.ObjectId };
export type SeatDoc = InferSchemaType<typeof seatSchema> & { _id: Types.ObjectId };
export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: Types.ObjectId };
export type IdempotencyKeyDoc = InferSchemaType<typeof idempotencyKeySchema> & { _id: Types.ObjectId };

export const User = mongoose.model('User', userSchema, 'users');
export const Session = mongoose.model('Session', sessionSchema, 'sessions');
export const Event = mongoose.model('Event', eventSchema, 'events');
export const Seat = mongoose.model('Seat', seatSchema, 'seats');
export const Booking = mongoose.model('Booking', bookingSchema, 'bookings');
export const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema, 'idempotencyKeys');

export const allModels = [User, Session, Event, Seat, Booking, IdempotencyKey];

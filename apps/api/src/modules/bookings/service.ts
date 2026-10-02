import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { OBJECT_ID_RE, type BookingDto, type CreateBookingInput, type ErrorCode } from '@seatly/shared';
import type { Config } from '../../config';
import { Booking, Event, Seat, User, type BookingDoc, type EventDoc } from '../../db/models';
import type { Clock } from '../../lib/clock';
import { bookingFingerprint, newBookingReference } from '../../lib/crypto';
import { AppError, errorBody, hasErrorLabel, isDuplicateKey } from '../../lib/errors';
import type { Faults } from '../../lib/faults';
import { toBookingDto } from './dto';
import { IdempotencyStore, LeaseLostError, type ClaimedKey, type StoredResponse } from './idempotency';

export const MAX_TRANSACTION_ATTEMPTS = 5;
const OP_TIMEOUT_MS = 2000;
const MAX_COMMIT_RETRIES = 3;

export interface BookingOutcome extends StoredResponse {
  replayed: boolean;
}

interface Logger {
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
}

/** Commit outcome unknown after retries: the key must NOT be released (the booking may exist). */
class CommitUnknownError extends Error {}
/** Booking reference collided with an existing one: retry the attempt with a new reference. */
class RetryAttempt extends Error {}
/** The unique (event, seat) index fired after a successful seat claim. Should be impossible. */
class InvariantViolation extends Error {}
/** All attempts used or the deadline passed; nothing was committed. */
class AttemptsExhausted extends Error {
  constructor(readonly lastError: unknown) {
    super('Booking transaction attempts exhausted');
  }
}

interface Ctx {
  userId: Types.ObjectId;
  key: string;
  input: CreateBookingInput;
  requestId: string;
  claimed: ClaimedKey;
  startedAt: number;
}

export class BookingService {
  private readonly keys: IdempotencyStore;

  constructor(
    private readonly config: Config,
    private readonly clock: Clock,
    private readonly faults: Faults,
    private readonly logger: Logger,
  ) {
    this.keys = new IdempotencyStore(config, clock);
  }

  /**
   * POST /api/bookings — phases 1–4 of the Stage 3 algorithm (phase 0, auth and validation,
   * happens in the route before this is called).
   */
  async create(args: { userId: Types.ObjectId; key: string; input: CreateBookingInput; requestId: string }): Promise<BookingOutcome> {
    const startedAt = performance.now();
    const fingerprint = bookingFingerprint(args.input);

    // Phase 1 — claim the key.
    const claim = await this.keys.claim(args.userId, args.key, fingerprint);
    if (claim.kind === 'replay') return { ...claim.response, replayed: true };
    if (claim.kind === 'reused') {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different booking request.');
    }
    if (claim.kind === 'inProgress') throw inProgressError();

    const ctx: Ctx = { ...args, claimed: claim, startedAt };
    try {
      await this.faults.hit('afterKeyClaimed', { attempt: 0, key: args.key });
      const outcome = await this.bookClaimed(ctx);
      this.logger.info(
        { requestId: args.requestId, statusCode: outcome.statusCode, ms: Math.round(performance.now() - startedAt) },
        'booking outcome',
      );
      return { ...outcome, replayed: false };
    } catch (err) {
      return this.handleFailure(ctx, err);
    }
  }

  // Phase 2 — reads and the fast path (no transaction).
  private async bookClaimed(ctx: Ctx): Promise<StoredResponse> {
    const eventId = new Types.ObjectId(ctx.input.eventId);
    const [event, user] = await Promise.all([
      Event.findById(eventId).lean<EventDoc>(),
      User.findById(ctx.userId).lean(),
    ]);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in to continue.');
    if (!event) return this.finalize(ctx, 404, 'EVENT_NOT_FOUND', 'We couldn’t find that event.');

    const seat = await Seat.findOne({ eventId, seatId: ctx.input.seatId }).lean();
    if (!seat) return this.finalize(ctx, 404, 'SEAT_NOT_FOUND', `Seat ${ctx.input.seatId} doesn’t exist for this event.`);
    // Safe without a transaction: in V1 a booked seat never becomes available again.
    if (seat.status === 'booked') return this.seatTaken(ctx);

    return this.transactionLoop(ctx, event, user);
  }

  // Phase 3 — the bounded transaction loop.
  private async transactionLoop(ctx: Ctx, event: EventDoc, user: { name: string; email: string }): Promise<StoredResponse> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
      if (attempt > 1 && performance.now() - ctx.startedAt > this.config.bookingDeadlineMs) break;
      const session = await mongoose.startSession();
      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
          maxCommitTimeMS: OP_TIMEOUT_MS,
        });
        const result = await this.runAttempt(session, ctx, event, user, attempt);
        await this.faults.hit('beforeCommit', { attempt, key: ctx.key });
        await this.commitWithRetry(session);
        await this.faults.hit('afterCommit', { attempt, key: ctx.key });
        return result;
      } catch (err) {
        if (session.inTransaction()) await session.abortTransaction().catch(() => undefined);
        if (err instanceof InvariantViolation) {
          this.logger.error({ requestId: ctx.requestId, input: ctx.input }, 'INVARIANT_ALERT: duplicate booking blocked by unique index');
          return this.seatTaken(ctx);
        }
        if (err instanceof RetryAttempt || hasErrorLabel(err, 'TransientTransactionError')) {
          lastError = err;
          await sleep((10 + Math.random() * 40) * attempt);
          continue;
        }
        throw err;
      } finally {
        await session.endSession();
      }
    }
    throw new AttemptsExhausted(lastError);
  }

  private async runAttempt(
    session: ClientSession,
    ctx: Ctx,
    event: EventDoc,
    user: { name: string; email: string },
    attempt: number,
  ): Promise<StoredResponse> {
    const now = this.clock.now();
    const bookingId = new Types.ObjectId();
    const reference = newBookingReference();

    // The atomic seat claim: matches only while the seat is still available.
    const claimedSeat = await Seat.findOneAndUpdate(
      { eventId: event._id, seatId: ctx.input.seatId, status: 'available' },
      { $set: { status: 'booked', bookingId, bookedAt: now } },
      { session, returnDocument: 'after', maxTimeMS: OP_TIMEOUT_MS },
    ).lean();

    if (!claimedSeat) {
      const response = { statusCode: 409, body: this.envelope(ctx, 'SEAT_TAKEN', seatTakenMessage(ctx)) };
      await this.keys.complete(ctx.claimed, response, null, session);
      return response;
    }
    await this.faults.hit('afterSeatClaimed', { attempt, key: ctx.key });

    const booking = {
      _id: bookingId,
      reference,
      userId: ctx.userId,
      eventId: event._id,
      seatId: ctx.input.seatId,
      idempotencyKeyId: ctx.claimed.keyId,
      createdAt: now,
    };
    try {
      await Booking.create([booking], { session });
    } catch (err) {
      if (isDuplicateKey(err, 'reference')) throw new RetryAttempt();
      if (isDuplicateKey(err, 'seatId')) throw new InvariantViolation();
      throw err;
    }

    const response = { statusCode: 201, body: { booking: toBookingDto(booking, event, user) } };
    await this.faults.hit('beforeKeyCompleted', { attempt, key: ctx.key });
    await this.keys.complete(ctx.claimed, response, bookingId, session);
    return response;
  }

  private async commitWithRetry(session: ClientSession): Promise<void> {
    for (let i = 0; ; i++) {
      try {
        await session.commitTransaction();
        return;
      } catch (err) {
        if (hasErrorLabel(err, 'UnknownTransactionCommitResult')) {
          if (i < MAX_COMMIT_RETRIES) continue;
          throw new CommitUnknownError();
        }
        throw err;
      }
    }
  }

  // Phase 4 — non-final failures.
  private async handleFailure(ctx: Ctx, err: unknown): Promise<never> {
    if (err instanceof LeaseLostError) throw inProgressError();
    if (err instanceof CommitUnknownError) {
      // Do not release: the commit may have landed. A same-key retry gets the replay,
      // or takes over once the lease expires.
      this.logger.warn({ requestId: ctx.requestId }, 'commit result unknown; key kept in progress');
      throw unavailableError();
    }
    await this.keys.release(ctx.claimed).catch((e: unknown) =>
      this.logger.warn({ requestId: ctx.requestId, err: e }, 'could not release idempotency key; lease will expire'),
    );
    if (err instanceof AppError) throw err;
    if (err instanceof AttemptsExhausted) {
      this.logger.warn({ requestId: ctx.requestId, err: err.lastError }, 'booking attempts exhausted');
      throw unavailableError();
    }
    if (isDatabaseUnavailable(err)) {
      this.logger.warn({ requestId: ctx.requestId, err }, 'database unavailable during booking');
      throw unavailableError();
    }
    throw err;
  }

  private async finalize(ctx: Ctx, statusCode: number, code: ErrorCode, message: string): Promise<StoredResponse> {
    const response = { statusCode, body: this.envelope(ctx, code, message) };
    await this.keys.complete(ctx.claimed, response, null);
    return response;
  }

  private seatTaken(ctx: Ctx): Promise<StoredResponse> {
    return this.finalize(ctx, 409, 'SEAT_TAKEN', seatTakenMessage(ctx));
  }

  private envelope(ctx: Ctx, code: ErrorCode, message: string) {
    return errorBody(code, message, ctx.requestId);
  }

  // ---- reads ----

  async getForUser(userId: Types.ObjectId, rawId: string): Promise<BookingDto> {
    // Missing, malformed and not-yours all look identical, so booking ids can't be probed.
    if (!OBJECT_ID_RE.test(rawId)) throw bookingNotFound();
    const booking = await Booking.findOne({ _id: new Types.ObjectId(rawId), userId }).lean<BookingDoc>();
    if (!booking) throw bookingNotFound();
    const [event, user] = await Promise.all([Event.findById(booking.eventId).lean<EventDoc>(), User.findById(userId).lean()]);
    if (!event || !user) throw bookingNotFound();
    return toBookingDto(booking, event, user);
  }

  async listForUser(userId: Types.ObjectId): Promise<BookingDto[]> {
    const [bookings, user] = await Promise.all([
      Booking.find({ userId }).sort({ createdAt: -1 }).lean<BookingDoc[]>(),
      User.findById(userId).lean(),
    ]);
    if (!user || bookings.length === 0) return [];
    const events = await Event.find({ _id: { $in: [...new Set(bookings.map((b) => b.eventId.toString()))] } }).lean<EventDoc[]>();
    const byId = new Map(events.map((e) => [e._id.toString(), e]));
    return bookings.flatMap((b) => {
      const e = byId.get(b.eventId.toString());
      return e ? [toBookingDto(b, e, user)] : [];
    });
  }
}

function seatTakenMessage(ctx: Ctx): string {
  return `Seat ${ctx.input.seatId} was just booked by someone else.`;
}

function inProgressError(): AppError {
  return new AppError(
    'IDEMPOTENCY_IN_PROGRESS',
    'This booking request is still being processed. Retry with the same Idempotency-Key.',
    null,
    { 'Retry-After': '1' },
  );
}

function unavailableError(): AppError {
  return new AppError(
    'BOOKING_UNAVAILABLE',
    'We couldn’t complete the booking right now. Retry with the same Idempotency-Key.',
    null,
    { 'Retry-After': '1' },
  );
}

function bookingNotFound(): AppError {
  return new AppError('BOOKING_NOT_FOUND', 'We couldn’t find that booking.');
}

function isDatabaseUnavailable(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return /MongoServerSelectionError|MongoNetworkError|MongoNetworkTimeoutError|MongoNotConnectedError|MongoPoolClearedError/.test(name);
}

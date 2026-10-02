import { randomUUID } from 'node:crypto';
import type { ClientSession, Types } from 'mongoose';
import type { Config } from '../../config';
import { IdempotencyKey } from '../../db/models';
import type { Clock } from '../../lib/clock';
import { isDuplicateKey } from '../../lib/errors';

export const OPERATION = 'booking.create';

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export type ClaimResult =
  | { kind: 'claimed'; keyId: Types.ObjectId; attemptId: string }
  | { kind: 'replay'; response: StoredResponse }
  | { kind: 'inProgress' }
  | { kind: 'reused' };

/** Thrown when a fenced write finds that another attempt now owns the key. */
export class LeaseLostError extends Error {
  constructor() {
    super('Idempotency key lease lost');
    this.name = 'LeaseLostError';
  }
}

export interface ClaimedKey {
  keyId: Types.ObjectId;
  attemptId: string;
}

/**
 * Idempotency key store. State machine per (userId, operation, key):
 *   not seen → in_progress (one owner, leased) → completed (final response, kept until TTL)
 *   in_progress → not seen (fenced delete) after a non-final failure, so a retry starts clean.
 * Every write after the claim is fenced on { attemptId, status: 'in_progress' }.
 */
export class IdempotencyStore {
  constructor(
    private readonly config: Config,
    private readonly clock: Clock,
  ) {}

  async claim(userId: Types.ObjectId, key: string, fingerprint: string): Promise<ClaimResult> {
    const now = this.clock.now();
    const attemptId = randomUUID();
    const lockedUntil = new Date(now.getTime() + this.config.idempotencyLeaseMs);
    try {
      const doc = await IdempotencyKey.create({
        userId,
        operation: OPERATION,
        key,
        fingerprint,
        status: 'in_progress',
        attemptId,
        lockedUntil,
        response: null,
        bookingId: null,
        createdAt: now,
        completedAt: null,
        expiresAt: new Date(now.getTime() + this.config.idempotencyTtlMs),
      });
      return { kind: 'claimed', keyId: doc._id, attemptId };
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }

    // Someone else holds (or held) this key. The unique index guarantees exactly one claim wins.
    const existing = await IdempotencyKey.findOne({ userId, operation: OPERATION, key }).lean();
    if (!existing) return { kind: 'inProgress' }; // released a moment ago; the client retries shortly
    if (existing.fingerprint !== fingerprint) return { kind: 'reused' };
    if (existing.status === 'completed' && existing.response) {
      return { kind: 'replay', response: { statusCode: existing.response.statusCode as number, body: existing.response.body } };
    }
    if (existing.lockedUntil > now) return { kind: 'inProgress' };

    // The previous owner's lease expired (it crashed): take over atomically.
    const taken = await IdempotencyKey.findOneAndUpdate(
      { _id: existing._id, status: 'in_progress', lockedUntil: { $lte: now } },
      { $set: { attemptId, lockedUntil } },
      { returnDocument: 'after' },
    ).lean();
    return taken ? { kind: 'claimed', keyId: taken._id, attemptId } : { kind: 'inProgress' };
  }

  /** Stores a final outcome. Inside a transaction when `session` is given. */
  async complete(
    claimed: ClaimedKey,
    response: StoredResponse,
    bookingId: Types.ObjectId | null,
    session?: ClientSession,
  ): Promise<void> {
    const res = await IdempotencyKey.updateOne(
      { _id: claimed.keyId, attemptId: claimed.attemptId, status: 'in_progress' },
      { $set: { status: 'completed', response, bookingId, completedAt: this.clock.now() } },
      session ? { session } : {},
    );
    if (res.matchedCount === 0) throw new LeaseLostError();
  }

  /** Non-final failure: forget the attempt so a same-key retry starts fresh. */
  async release(claimed: ClaimedKey): Promise<void> {
    await IdempotencyKey.deleteOne({ _id: claimed.keyId, attemptId: claimed.attemptId, status: 'in_progress' });
  }
}

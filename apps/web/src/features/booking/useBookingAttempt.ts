import type { BookingDto } from '@seatly/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { createBooking } from '../../api/endpoints';
import { MAX_IN_PROGRESS_POLLS, RETRY_DELAYS_MS, inProgressDelay, retryDelay } from '../../lib/retry';
import { clearPending, loadPending, savePending } from './pendingAttempt';

export type AttemptState =
  | { status: 'idle' }
  | { status: 'submitting'; seatId: string }
  | { status: 'retrying'; seatId: string }
  | { status: 'retryFailed'; seatId: string }
  | { status: 'conflict'; seatId: string }
  | { status: 'sessionExpired'; seatId: string }
  | { status: 'error'; seatId: string; message: string };

interface Callbacks {
  onSuccess(booking: BookingDto): void;
  /** Called after every server answer so the seat map refreshes (availability is advisory). */
  onSettled(): void;
  onUnauthenticated(): void;
  /** Conflict or another definitive failure: the selection should be cleared. */
  onAbandoned(): void;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

/**
 * The only code that creates or reuses an Idempotency-Key.
 * - New key: when the user presses Book.
 * - Same key: every automatic retry, every in-progress poll, "Try again", and a resume after reload.
 * - Key discarded: on any definitive answer (201, SEAT_TAKEN, 401, 4xx).
 */
export function useBookingAttempt(eventId: string, cb: Callbacks) {
  const [state, setState] = useState<AttemptState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (seatId: string, key: string, resumed: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      let retries = 0;
      let polls = 0;
      setState({ status: resumed ? 'retrying' : 'submitting', seatId });
      try {
        for (;;) {
          try {
            const { booking } = await createBooking({ eventId, seatId }, key, ac.signal);
            clearPending(eventId);
            setState({ status: 'idle' });
            cbRef.current.onSettled();
            cbRef.current.onSuccess(booking);
            return;
          } catch (err) {
            if (!(err instanceof ApiError) || err.kind === 'aborted') throw err;
            if (err.code === 'IDEMPOTENCY_IN_PROGRESS' && polls < MAX_IN_PROGRESS_POLLS) {
              polls++;
              setState({ status: 'retrying', seatId });
              await sleep(inProgressDelay(err.retryAfterMs), ac.signal);
              continue;
            }
            if (err.isUncertain || err.code === 'IDEMPOTENCY_IN_PROGRESS') {
              if (retries < RETRY_DELAYS_MS.length) {
                const delay = retryDelay(retries, err.retryAfterMs);
                retries++;
                polls = 0;
                setState({ status: 'retrying', seatId });
                await sleep(delay, ac.signal);
                continue;
              }
              // Outcome still unknown: keep the pending attempt so "Try again" reuses the key.
              setState({ status: 'retryFailed', seatId });
              cbRef.current.onSettled();
              return;
            }
            clearPending(eventId);
            cbRef.current.onSettled();
            if (err.code === 'SEAT_TAKEN') {
              setState({ status: 'conflict', seatId });
              cbRef.current.onAbandoned();
            } else if (err.status === 401) {
              setState({ status: 'sessionExpired', seatId });
              cbRef.current.onUnauthenticated();
            } else {
              setState({ status: 'error', seatId, message: err.message });
              cbRef.current.onAbandoned();
            }
            return;
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError' && !(err instanceof ApiError && err.kind === 'aborted')) throw err;
      }
    },
    [eventId],
  );

  /** User pressed Book: a brand-new attempt with a brand-new key. */
  const book = useCallback(
    (seatId: string) => {
      const key = crypto.randomUUID();
      savePending(eventId, { seatId, key, createdAt: Date.now() });
      void run(seatId, key, false);
    },
    [eventId, run],
  );

  /** "Try again" after retries were exhausted: same key. */
  const retry = useCallback(() => {
    const p = loadPending(eventId);
    if (p) void run(p.seatId, p.key, true);
  }, [eventId, run]);

  /** After a reload mid-attempt: resume with the stored key. Returns the seat being resumed. */
  const resume = useCallback((): string | null => {
    const p = loadPending(eventId);
    if (!p) return null;
    void run(p.seatId, p.key, true);
    return p.seatId;
  }, [eventId, run]);

  /** Abandon an uncertain attempt (user picks a different seat). */
  const discard = useCallback(() => {
    abortRef.current?.abort();
    clearPending(eventId);
    setState({ status: 'idle' });
  }, [eventId]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const busy = state.status === 'submitting' || state.status === 'retrying';
  return { state, busy, book, retry, resume, discard, reset };
}

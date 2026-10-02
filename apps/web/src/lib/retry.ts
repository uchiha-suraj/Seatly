/** Confirmed in Stage 3: 2 automatic retries at +1 s and +3 s (plus up to 250 ms jitter), same key. */
export const RETRY_DELAYS_MS = [1000, 3000] as const;
export const MAX_IN_PROGRESS_POLLS = 5;
export const MAX_JITTER_MS = 250;

export function retryDelay(retryIndex: number, retryAfterMs: number | null, random: () => number = Math.random): number {
  const base: number = RETRY_DELAYS_MS[retryIndex] ?? 3000;
  return Math.max(base + Math.floor(random() * MAX_JITTER_MS), retryAfterMs ?? 0);
}

export function inProgressDelay(retryAfterMs: number | null): number {
  return retryAfterMs ?? 1000;
}

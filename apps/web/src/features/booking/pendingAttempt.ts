/**
 * The in-flight booking attempt survives a reload (same tab only), so a reload can never
 * lead to a second idempotency key for the same attempt. Cleared on any definitive answer.
 */
export interface PendingAttempt {
  seatId: string;
  key: string;
  createdAt: number;
}

const MAX_AGE_MS = 24 * 3_600_000;
const storageKey = (eventId: string) => `seatly:pending:${eventId}`;

export function loadPending(eventId: string): PendingAttempt | null {
  try {
    const raw = sessionStorage.getItem(storageKey(eventId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAttempt;
    if (!p.key || !p.seatId || Date.now() - p.createdAt > MAX_AGE_MS) {
      sessionStorage.removeItem(storageKey(eventId));
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function savePending(eventId: string, p: PendingAttempt): void {
  try {
    sessionStorage.setItem(storageKey(eventId), JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode): the attempt still works, it just won't survive a reload.
  }
}

export function clearPending(eventId: string): void {
  try {
    sessionStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}

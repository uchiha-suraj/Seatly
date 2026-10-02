import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** Mutable so tests can shorten it; the product value is 10 s. */
export const seatPollConfig = { intervalMs: 10_000, focusMinAgeMs: 2_000 };

/**
 * Keeps the seat map fresh while someone is looking at it:
 * - every `intervalMs` while the tab is visible (hidden tabs never poll),
 * - when the window regains focus (two windows side by side never change visibility),
 * - never while a booking request is in flight, so the map cannot change mid-request.
 * Seat availability stays advisory: the server's conditional update decides every booking.
 */
export function useSeatPolling(eventId: string, paused: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (paused) return;
    const queryKey = ['seats', eventId];
    const refresh = (minAgeMs: number) => {
      if (document.visibilityState !== 'visible' || qc.isFetching({ queryKey }) > 0) return;
      const updatedAt = qc.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
      if (Date.now() - updatedAt < minAgeMs) return;
      void qc.refetchQueries({ queryKey, type: 'active' });
    };
    const id = window.setInterval(() => refresh(0), seatPollConfig.intervalMs);
    const onFocus = () => refresh(seatPollConfig.focusMinAgeMs);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [eventId, paused, qc]);
}

/** Current time, re-rendered every `stepMs` (for "updated 8 s ago"). */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

/** "updated just now" · "updated 8 s ago" · "updated 2 min ago" */
export function freshnessLabel(updatedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (s < 5) return 'updated just now';
  if (s < 60) return `updated ${s} s ago`;
  return `updated ${Math.floor(s / 60)} min ago`;
}

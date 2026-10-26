# Codebase walkthrough: one booking

> **Purpose:** orientation. Follow one click on **Book seat** through the code and back. The rules themselves are defined in [booking-correctness.md](../architecture/booking-correctness.md); this page tells you where to find them.
> **Status:** verified against the code on 26 Oct 2026.

## 1. Choosing a seat (browser)

- `apps/web/src/features/events/EventDetailsPage.tsx` loads the event (`['event', id]`) and seat snapshot (`['seats', id]`) through `api/endpoints.ts`.
- `SeatMap.tsx` renders a grid of buttons named like `Row C, seat 7, available`. Arrow keys move focus (roving tabindex); Enter or Space selects. The selection is mirrored to `?seat=C7`.
- `useSeatPolling.ts` refetches the snapshot every 10 s while the tab is visible and on window focus. If the selected seat turns booked, the panel shows *liveTaken* and the selection clears.
- If the event has started (`bookingOpen: false`), the panel shows *closed* and the seat map is locked.

## 2. Pressing Book seat

- `features/booking/BookingPanel.tsx` calls `book(seatId)` from `useBookingAttempt.ts`.
- `useBookingAttempt` creates **one** UUID idempotency key for this seat choice and saves `{ key, seatId }` in `sessionStorage` (`pendingAttempt.ts`), so a reload resumes the same attempt.
- `endpoints.createBooking` sends `POST /api/bookings` with the `Idempotency-Key` header and body `{ eventId, seatId }`, with a 10 s timeout.
- On a timeout, network error or 503 it retries at +1 s and +3 s with the **same key** (`lib/retry.ts`). On 409 `IDEMPOTENCY_IN_PROGRESS` it polls up to 5 times.

## 3. Through the API middleware

`apps/api/src/app.ts`: request ID → logging → helmet → JSON parser (16 KB) → cookies → `Origin` check (403) → JSON-only (415) → session lookup → `requireAuth` (401). Then `modules/bookings/routes.ts`:

- Validates the key header (400 `IDEMPOTENCY_KEY_MISSING` / `_INVALID`) and the body with `createBookingSchema` (400 `VALIDATION_ERROR`; `userId` in the body is rejected).
- Calls `BookingService.create({ userId: req.auth.userId, key, input })`. **The user comes from the session only.**

## 4. The booking service

`apps/api/src/modules/bookings/service.ts`:

| Phase | Method | What happens |
| --- | --- | --- |
| 1 | `create` → `IdempotencyStore.claim` (`idempotency.ts`) | Insert or find the key for (user, `booking.create`, key). Completed → replay the stored response. Different body → 422. Running → 409 `IN_PROGRESS`. Lease expired → take over with a new `attemptId`. |
| 2 | `bookClaimed` | Plain reads: event missing → 404; **event started → 409 `BOOKING_CLOSED`**; seat missing → 404; seat already booked → 409 `SEAT_TAKEN`. These are final and stored on the key. |
| 3 | `transactionLoop` → `runAttempt` → `commitWithRetry` | In one transaction: claim the seat with `findOneAndUpdate({ status: 'available' })`, insert the booking (unique on event + seat), complete the key fenced by `attemptId`. Up to 5 attempts within 4 s; commit retried if its result is unknown. |
| 4 | `handleFailure` | Transient failure after the deadline → release the key (fenced) and answer 503 `BOOKING_UNAVAILABLE`, retryable with the same key. Unknown commit → keep the key; the lease decides. |

Responses are built in `dto.ts`. The route adds `Cache-Control: no-store` and, for replays, `Idempotent-Replayed: true`.

## 5. In the database

`apps/api/src/db/models.ts`. After a success:

- `seats`: the seat is `booked` with `bookingId` and `bookedAt`.
- `bookings`: one document; the `event_seat_unique` index makes a second one impossible.
- `idempotencyKeys`: `completed`, with the 201 response stored for 24 h.

## 6. Back in the browser

- 201 → the pending attempt is cleared, `['events']` and `['myBookings']` are invalidated, and the app navigates to `/bookings/:id` (`BookingDetailsPage.tsx`), where focus moves to the "You're booked" heading.
- 409 `SEAT_TAKEN` → panel *conflict*, seat map refetches.
- 409 `BOOKING_CLOSED` → panel *closed*, event refetched.
- Still uncertain after retries → *retryFailed*: "We couldn't confirm your booking", with **Check my bookings** and **Try again** (same key).

## Where to look next

- Failure cases in detail: [booking-correctness.md](../architecture/booking-correctness.md#failure-cases-and-what-happens).
- The tests that prove each step: `apps/api/test/integration/idempotency.test.ts`, `transaction-failures.test.ts`, `concurrency.test.ts`, `event-lifecycle.test.ts`, and `apps/web/test/booking.test.tsx`.

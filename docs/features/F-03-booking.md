# F-03 Booking a seat

> **Status:** shipped in V1 (2 Oct 2026). Requirements AC-10 to AC-23, NFR-1 to NFR-3, NFR-5. The design is defined in [booking-correctness.md](../architecture/booking-correctness.md); this spec covers what the user experiences.

## Summary

A signed-in user books one specific seat with one click. However many people try at once, and however often the request is retried, a seat gets at most one booking and a request creates at most one.

## Scope

- **In:** one seat per request, immediate confirmation, conflict handling, automatic same-key retries, resume after reload, clear answers when the outcome is uncertain.
- **Out (V1):** payments, holds or timed reservations, multiple seats per booking, cancellation, waiting lists, per-user limits.

## Behaviour

1. Select a seat → panel *selected* ("Selecting a seat doesn't hold it").
2. Signed out → **Log in to book**; after login the seat is re-checked and kept only if still free (*backFree* / *backTaken*).
3. **Book seat** → *submitting*; the map locks.
4. Slow or dropped connection → *retrying* ("Still checking your booking…"), retries with the same key at +1 s and +3 s.
5. Outcomes: 201 → confirmation page with reference and focus on the heading · `SEAT_TAKEN` → *conflict*, map refreshes · `BOOKING_CLOSED` → *closed* · 401 → *sessionExpired* · uncertain after retries → *retryFailed* with **Check My bookings** and **Try again** (same key).
6. Reloading during an attempt resumes it with the same key (`sessionStorage`).

## Rules

Business rules BR-1 to BR-12 and invariants INV-1 to INV-5: [rules-and-flows.md](../product/rules-and-flows.md). The user is always the session user. Availability on screen is advisory; the server decides.

## API and data

`POST /api/bookings` with `Idempotency-Key` ([api.md](../architecture/api.md)). Collections `seats`, `bookings`, `idempotencyKeys`.

## Tests

API: `bookings.test.ts`, `idempotency.test.ts`, `transaction-failures.test.ts`, `concurrency.test.ts`, `event-lifecycle.test.ts`. Web: `booking.test.tsx`, `lifecycle.test.tsx`. Demos: concurrency (300 users in CI) and idempotency.

## Open items

AC-22 verified at 300 users (CI, 27 Oct 2026). V2 candidates: holds, cancellation, per-user limits.

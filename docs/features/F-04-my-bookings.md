# F-04 My bookings

> **Status:** shipped in V1 (2 Oct 2026). Requirements AC-6, AC-24, AC-25.

## Summary

Signed-in users see their own bookings, newest first, and can open any of them. Nobody can see anyone else's.

## Scope

- **In:** list, booking details (reference, event, date and time, venue, seat, booked-on time), confirmation view right after booking.
- **Out (V1):** cancel, transfer, tickets, email, calendar export.

## Behaviour

- `/bookings` lists bookings newest first; empty state links to events.
- `/bookings/:id` shows "You're booked" right after a booking (focus on the heading), and "Booking details" when revisited.
- Another user's booking ID, a malformed ID or an unknown ID all show the same not-found page (no hint that it exists).

## API and data

`GET /api/me/bookings`, `GET /api/bookings/:id` (both `no-store`). Queries filter by the session user; index `user_createdAt`.

## Tests

`apps/api/test/integration/bookings.test.ts` (ownership, ordering), `apps/web/test/booking.test.tsx`.

## Open items

None for V1. Past bookings are listed together with upcoming ones; splitting them is a V2 candidate.

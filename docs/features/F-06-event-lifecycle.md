# F-06 Booking closes when an event starts

> **Status:** built 26 Oct 2026 for V1.1 (decision [ADR-0012](../adr/0012-booking-closes-at-start.md); answers open question Q8). Requirement AC-28. Verified 27 Oct 2026: API 53/53 and web 48/48 in CI run #8; live since 27 Oct 2026.

## Summary

Once an event's start time has passed, it disappears from the list and nobody can book it. On the live demo, seeded events that have started move forward automatically so the catalogue never runs empty.

## Behaviour

- `GET /api/events` returns only events with `startsAt` in the future.
- `GET /api/events/:id` still works for a started event and returns `bookingOpen: false`; the page shows the *closed* panel ("Booking has closed. This event has already started, so seats can no longer be booked.") with **Browse upcoming events**, and the seat map is locked.
- `POST /api/bookings` for a started event returns **409 `BOOKING_CLOSED`**. It is a final answer: stored on the idempotency key and replayed, and no seat or booking changes. The web app switches to *closed* if this arrives while the page still thought booking was open.
- **Rolling demo dates** (`DEMO_ROLLING_DATES=true`, live demo only): at startup and every hour, each seeded event that has started moves forward by the smallest multiple of 49 days that puts it in the future. Duration, seats and bookings are kept. The update is conditional, so two processes cannot move an event twice. `npm run seed` also runs it.

## Rules

Boundary: booking is open while `startsAt > now` (server clock). Events in progress count as started. Existing bookings for a moved event keep pointing at it, so they show the new date.

## API and data

`EventSummary.bookingOpen` (new, additive). Error code `BOOKING_CLOSED` (409). `rollDemoDates` in `apps/api/src/db/seed.ts`; hourly timer in `server.ts`.

## Tests

`apps/api/test/integration/event-lifecycle.test.ts` (list filter, details, 409 and replay, future events unaffected, rolling by 49-day steps, concurrent rolls, idempotent second run) · `apps/web/test/lifecycle.test.tsx`.

## Open items

Checked 27 Oct 2026: the live list shows only upcoming events and three seeded events were rolled to December. Real event management (creating, ending, archiving events) is a V2 candidate.

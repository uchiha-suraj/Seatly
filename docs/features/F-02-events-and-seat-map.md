# F-02 Events and seat map

> **Status:** shipped in V1 (2 Oct 2026); list filter and seat names changed in V1.1 (26 Oct 2026). Requirements AC-7 to AC-9, AC-26, AC-28, NFR-7.

## Summary

Anyone can browse upcoming events, open one, and pick a seat on a numbered grid that works with mouse, touch and keyboard.

## Scope

- **In:** seeded catalogue (7 events, one with a single seat), event list, event details, seat grid up to rows A–Z × 1–99 (seed uses A–F × 1–10), seat counts.
- **Out (V1):** creating or editing events, search, filters, prices, seat types, venues with sections.

## Behaviour

- **List** (`/`): events that have **not started yet**, by start time, with available/total seats and a "Sold out" badge (V1.1: started events are hidden).
- **Details** (`/events/:id`): image, description, date and time in the event's time zone, venue, counts, seat map and booking panel. A started event still opens by direct link and shows *closed* ([F-06](F-06-event-lifecycle.md)).
- **Seat map:** one button per seat. Accessible names read "Row A, seat 5, available" / "…, selected" / "…, booked" (V1.1: matches the visible row and number labels, WCAG 2.5.3). Arrow keys, Home and End move focus; Enter or Space selects. Booked seats can be focused, not selected. Locked while a booking is in flight and when booking is closed.
- Selection is kept in `?seat=` so it survives reloads and login.

## States and errors

Loading skeleton · empty list ("No upcoming events") · 404 page for unknown or malformed IDs · sold-out panel. See [ui-spec.md](../design/ui-spec.md#screens-and-states).

## API and data

`GET /api/events`, `GET /api/events/:id`, `GET /api/events/:id/seats` ([api.md](../architecture/api.md#endpoints)). Collections `events`, `seats`; availability is counted from seats, never stored ([data-model.md](../architecture/data-model.md)).

## Tests

`apps/api/test/integration/events.test.ts`, `event-lifecycle.test.ts`; `apps/web/test/seatmap.test.tsx`; UI audit of 26 Oct 2026 ([testing.md](../development/testing.md#latest-results)).

## Open items

Screen-reader pass not done (NFR-7). Event management is a V2 candidate.

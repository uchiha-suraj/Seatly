# F-05 Live seat map

> **Status:** shipped in V1 (2 Oct 2026). Requirement AC-27; decision [ADR-0010](../adr/0010-seat-map-polling.md).

## Summary

While someone is looking at an event, the seat map keeps itself up to date so they rarely pick a seat that is already gone.

## Behaviour

- Refetch every 10 s while the tab is visible, on window focus, after every booking answer, and on **Refresh**.
- No polling in a hidden tab or while a booking request is in flight.
- A freshness label shows when the map was last updated.
- If a refresh shows the selected seat booked by someone else: selection cleared, panel *liveTaken* ("Seat A7 was just booked"), announced politely, **focus not moved**.

## Rules

Display only. The booking API is the authority; a stale map can never cause a double booking.

## API and data

`GET /api/events/:id/seats` (`no-store`, includes `asOf`). Code: `apps/web/src/features/events/useSeatPolling.ts`.

## Tests

`apps/web/test/polling.test.tsx`. Two-window check on the live site by Suraj, 2 Oct 2026.

## Open items

Server push (WebSockets or server-sent events) is a V2 option if many viewers or faster updates are needed. The *liveTaken* state has no Figma frame yet.

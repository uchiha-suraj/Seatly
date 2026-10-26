# ADR-0012: Close booking when an event starts; roll demo event dates forward

- **Status:** Accepted
- **Date:** 26 Oct 2026 (AC-28, V1.1)

## Context

Events stayed listed and bookable after they started. On the live demo, seeded events run from 16 Oct to 16 Nov 2026, so the catalogue was going stale.

## Options considered

1. Close booking at the start time; list only upcoming events; move started seeded events forward on the live demo
2. Close booking only, and re-seed by hand
3. Seed dates relative to "now" on every read

## Decision

The API rejects bookings once `startsAt` has passed (409 `BOOKING_CLOSED`, a final outcome) and lists only events that have not started; started events stay reachable by URL with `bookingOpen: false`. On the live demo (`DEMO_ROLLING_DATES=true`) the server moves seeded events that have started forward by whole 7-week steps, at startup and hourly; `npm run seed` does the same. Moves are conditional updates, so concurrent processes move an event once.

## Consequences

The demo stays credible with no operator work. Costs: existing bookings move with their event's date (acceptable for demo data, documented); seats booked on the demo are never freed, so availability falls over time until a reset.

## Revisit when

Real events or organizer tools arrive (V2): remove date rolling, and decide what happens to bookings for past events.

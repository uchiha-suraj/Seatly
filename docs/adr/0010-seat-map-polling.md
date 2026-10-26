# ADR-0010: Refresh the seat map by polling every 10 seconds

- **Status:** Accepted
- **Date:** 2 Oct 2026 (AC-27, after the live two-window test)

## Context

With two windows side by side, one user's booking did not appear in the other window until a manual refresh.

## Options considered

1. Poll every 10 s while visible, plus on window focus
2. Server-sent events from MongoDB change streams
3. WebSockets

## Decision

Poll `GET /seats` every 10 s while the tab is visible and on window focus; pause while a booking request is in flight; clear a selection that became booked, with a polite notice.

## Consequences

Simple, stateless, works on Render's free plan; about one small request every 10 s per open page. Up to 10 s of staleness, which is acceptable because the server decides every booking. Push channels would need long-lived connections, which Render's free plan drops.

## Revisit when

Many concurrent viewers make polling costly, or instant updates become a product requirement.

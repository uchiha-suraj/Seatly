# ADR-0002: Claim a seat with one conditional update, backed by a unique index

- **Status:** Accepted
- **Date:** Stage 1–3, 2 Oct 2026

## Context

Hundreds of requests may race for one seat across several processes. Check-then-write in two statements double-books under concurrency.

## Options considered

1. Conditional `findOneAndUpdate` on `status: 'available'` plus a unique index on bookings (event, seat)
2. Application or in-process locks
3. Distributed lock (Redis)
4. Optimistic version numbers on the seat

## Decision

The seat flips with one conditional update; the database lets exactly one request match. A unique index on `bookings(eventId, seatId)` makes a second booking impossible even if code is wrong.

## Consequences

Correct with any number of processes and no extra infrastructure. The loser gets a clean 409, not an error. In-process locks fail with two processes; Redis adds a service and a second source of truth.

## Revisit when

Seats can return to available (cancellation, V2): still valid, but see ADR-0003 about the fast-path read.

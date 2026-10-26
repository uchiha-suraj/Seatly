# ADR-0003: Write seat claim, booking and idempotency result in one transaction

- **Status:** Accepted
- **Date:** Stage 3, 2 Oct 2026

## Context

If the booking or the stored result were written separately from the seat claim, a crash in between could leave a booked seat with no booking, or a booking whose retry gives a different answer.

## Options considered

1. One transaction for all three writes
2. Seat claim first, then booking with a compensating rollback on failure
3. Write the booking, derive seat status from bookings

## Decision

One transaction (snapshot read concern, majority write concern, primary reads, 2 s per-operation limit), retried up to 5 times within a 4 s deadline on transient errors. The key's completion is fenced on its `attemptId` inside the same transaction.

## Consequences

Invariants INV-2 and INV-4 hold after any crash (tested with fault points and MongoDB fail points). Costs: transactions need a replica set and add latency. The phase 2 "already booked" read happens outside the transaction; that is only safe because seats never return to available in V1.

## Revisit when

Cancellation is added: move the availability check inside the transaction or drop the shortcut.

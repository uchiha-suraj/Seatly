# ADR-0004: Idempotency keys with a fingerprint, a lease and a fencing token

- **Status:** Accepted
- **Date:** Stage 3, 2 Oct 2026 (AC-19 revised, AC-19b added)

## Context

Users retry after timeouts and dropped connections. A retry must never create a second booking, and two copies of the same request in flight must not both run.

## Options considered

1. Client-generated UUID per booking attempt, stored per user with a payload fingerprint, a 15 s lease and an `attemptId` fencing token
2. Rely on the seat's uniqueness only (a retry for the same seat just gets 409)
3. Server-generated request tokens issued before booking

## Decision

Keys are scoped to (user, `booking.create`, key), kept 24 h. Same key + different body → 422; completed → replay; in progress with a valid lease → 409 `IDEMPOTENCY_IN_PROGRESS` + `Retry-After: 1`; expired lease → takeover with a new `attemptId`. Final outcomes are stored; retryable ones are not. An unknown commit result keeps the key.

## Consequences

Retries return the original answer, including a 201 the client never saw; concurrency on one key is explicit. Relying on seat uniqueness alone would turn a user's own successful retry into a confusing "seat taken". Costs: one more collection and careful fencing logic.

## Revisit when

Bookings become multi-step (holds, payments): the key would need to cover the whole flow.

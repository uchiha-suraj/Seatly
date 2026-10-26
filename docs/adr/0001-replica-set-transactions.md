# ADR-0001: Use a MongoDB replica set so bookings can use transactions

- **Status:** Accepted
- **Date:** Stage 3, 2 Oct 2026

## Context

A booking writes three documents (seat, booking, idempotency key) that must change together. The brief fixed MongoDB as the database. MongoDB only runs multi-document transactions on a replica set or sharded cluster.

## Options considered

1. Replica set everywhere (single node locally and in CI; Atlas in production)
2. Standalone MongoDB with no transactions, relying on ordering and compensating writes
3. Embed the booking inside the seat document so one atomic update suffices

## Decision

Run a replica set in every environment. Locally and in CI it is one node (`rs0`, Docker Compose healthcheck initiates it); production uses Atlas, whose clusters are replica sets. The server refuses to start without one (`assertReplicaSet`).

## Consequences

Real all-or-nothing writes; tests run against the same semantics as production. Costs: a slightly more involved local setup (Docker), and single-node sets cannot test failover. Embedding was rejected because bookings and idempotency results still live elsewhere.

## Revisit when

MongoDB is replaced, or bookings become a single-document write.

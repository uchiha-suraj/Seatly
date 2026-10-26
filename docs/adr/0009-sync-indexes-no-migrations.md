# ADR-0009: Create indexes at startup instead of migration files

- **Status:** Accepted
- **Date:** Stage 3, 2 Oct 2026

## Context

Correctness depends on unique indexes existing. V1's schema is small and seeded.

## Options considered

1. Mongoose `syncIndexes` at startup, with `autoIndex` off
2. A migration tool (e.g. migrate-mongo)

## Decision

The server syncs declared indexes on start and fails if a unique index cannot be built. Seed scripts are idempotent.

## Consequences

Indexes can never be silently missing. Costs: no history of data changes; renames or backfills need one-off scripts.

## Revisit when

The first change that rewrites existing documents: introduce a migration tool then.

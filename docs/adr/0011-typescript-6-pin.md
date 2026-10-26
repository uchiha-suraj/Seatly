# ADR-0011: Pin TypeScript to 6.0

- **Status:** Accepted
- **Date:** Stage 4, 2 Oct 2026

## Context

TypeScript 7 was available, but typescript-eslint supported versions below 6.1 only.

## Options considered

1. Pin `~6.0.3`
2. Use TypeScript 7 without type-aware linting

## Decision

Pin TypeScript `~6.0.3` in the root `package.json`.

## Consequences

Full type-aware linting. Costs: miss TypeScript 7's speed-ups for now.

## Revisit when

typescript-eslint supports TypeScript 7.

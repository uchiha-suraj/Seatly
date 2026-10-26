# ADR-0008: One repository with npm workspaces and shared Zod schemas

- **Status:** Accepted
- **Date:** Stage 3, 2 Oct 2026

## Context

Validation rules and error codes must be identical in the browser and the API.

## Options considered

1. npm workspaces: `apps/api`, `apps/web`, `packages/shared`
2. Two repositories with a published shared package
3. Duplicate the rules in each app

## Decision

npm workspaces; `packages/shared` holds Zod schemas, error codes and DTO types, imported as TypeScript source by both apps.

## Consequences

One change updates both sides, and TypeScript shows every caller. Costs: the API build has to alias the shared source (esbuild).

## Revisit when

A second client (mobile) or separate deploy cadences.

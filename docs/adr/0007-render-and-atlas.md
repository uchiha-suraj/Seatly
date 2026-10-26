# ADR-0007: Host on Render's free plan with a MongoDB Atlas free cluster

- **Status:** Accepted
- **Date:** Stage 6, 2 Oct 2026

## Context

A portfolio demo needs a public URL at no cost, a Node runtime and a replica set.

## Options considered

1. Render web service + Atlas free cluster
2. Railway or Fly.io + Atlas
3. A VPS with self-run MongoDB

## Decision

Render Blueprint (`render.yaml`, Singapore, free) and an Atlas free cluster; secrets set in Render's dashboard. Atlas network access is `0.0.0.0/0` because Render's free plan has no fixed outbound IP.

## Consequences

Free and reproducible from the repo. Costs: about 50 s cold starts after inactivity, no shell, shared resources, no backups confirmed, database open to any IP (protected by the password).

## Revisit when

Real users arrive, cold starts become unacceptable, or backups are required (see V2 candidates).

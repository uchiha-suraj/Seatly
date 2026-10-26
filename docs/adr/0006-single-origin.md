# ADR-0006: Serve the API and the web app from one origin

- **Status:** Accepted
- **Date:** Stage 1 (Q2), Stage 6, 2 Oct 2026

## Context

Cookies across sites need `SameSite=None` and suffer third-party cookie blocking; separate origins also need CORS.

## Options considered

1. Express serves `/api` and the built React app on one origin
2. Static host (Vercel/Netlify) plus API host with a rewrite
3. Separate origins with CORS

## Decision

One Express process serves both (`SERVE_WEB_DIST=true`); hashed assets get a one-year cache, `index.html` is not cached. Local development uses Vite's proxy for the same effect.

## Consequences

First-party cookies, no CORS, one deployable. Costs: the API process also serves static files (negligible at this scale); no CDN in front.

## Revisit when

Traffic grows enough to want a CDN, or the frontend needs its own release cycle.

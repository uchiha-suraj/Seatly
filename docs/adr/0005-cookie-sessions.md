# ADR-0005: Opaque session tokens in an HttpOnly cookie, stored hashed

- **Status:** Accepted
- **Date:** Stage 1 (Q1) and Stage 3, 2 Oct 2026

## Context

The app needs login with real logout, an expired-session flow (AC-15), and no tokens readable by page scripts.

## Options considered

1. Opaque random token in an HttpOnly cookie, SHA-256 hash in a `sessions` collection
2. JWT in a cookie
3. JWT in local storage

## Decision

32-byte random token in cookie `seatly_sid` (HttpOnly, `SameSite=Lax`, `Secure` in production, 7-day max age). Only its hash is stored. 120-minute sliding idle timeout (touched at most every 5 min), 7-day absolute limit, rotated on login, removed by TTL.

## Consequences

Logout and expiry are real and testable; a database leak does not reveal usable tokens; scripts cannot read the token. Costs: one database read per authenticated request; a JWT would avoid that but makes logout and revocation weaker.

## Revisit when

Many API processes make the per-request session read a bottleneck, or a mobile client needs bearer tokens.

# F-01 Accounts and sessions

> **Status:** shipped in V1 (2 Oct 2026). Requirements AC-1 to AC-6, AC-15, NFR-4, NFR-6, NFR-8 verified as recorded in [requirements.md](../product/requirements.md#auth).

## Summary

People register with a name, email and password, log in and log out. A server-side session in a cookie keeps them signed in. Browsing needs no account; booking and My bookings do.

## Users and goal

A visitor who wants to book a seat, and later see their bookings, without a long sign-up.

## Scope

- **In:** register, log in, log out, "who am I", protected routes with `returnTo`, session expiry, rate limit on auth.
- **Out (V1):** password reset, email verification, social login, profile editing, account deletion (manual only, see [personal-data.md](../security/personal-data.md)), "log out everywhere".

## Behaviour

- Register and login set the `seatly_sid` cookie and return the user. Login in a browser that already has a session replaces it.
- Signed-in visitors who open `/login` or `/register` are sent to a safe `returnTo` if there is one, otherwise home (fixed 26 Oct 2026: previously the guard could send them home before the login page's own redirect ran).
- Protected pages (`/bookings`, `/bookings/:id`) send signed-out visitors to `/login?returnTo=…`.
- A 401 anywhere marks the user signed out in the UI; at Book it shows *sessionExpired*.

## Rules

Passwords: 8–128 characters, stored only as argon2id hashes. Emails are stored lower-case and unique. One generic message for a wrong email or password. Session: 120 min idle, 7 days absolute; only the token's SHA-256 hash is stored. `returnTo` accepts local paths only. Details: [threat-model.md](../security/threat-model.md) T4, T5, T9.

## States and errors

400 `VALIDATION_ERROR` (inline per field) · 409 `EMAIL_TAKEN` ("Email already registered") · 401 `INVALID_CREDENTIALS` · 429 `RATE_LIMITED` · 403 `ORIGIN_NOT_ALLOWED`. Form copy: [ui-spec.md](../design/ui-spec.md#forms-and-validation).

## API and data

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` ([api.md](../architecture/api.md#endpoints)). Collections `users`, `sessions` ([data-model.md](../architecture/data-model.md)).

## Tests

`apps/api/test/integration/auth.test.ts`, `apps/api/test/unit/crypto.test.ts`, `packages/shared/test/schemas.test.ts`, `apps/web/test/booking.test.tsx` (login intent, `GuestOnly` redirects).

## Open items

V2 candidates: password reset, email verification, per-account login throttling, self-service deletion.

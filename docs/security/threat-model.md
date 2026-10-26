# Threat model

> **Authority:** what Seatly protects, against whom, and how. Personal data is covered in [personal-data.md](personal-data.md).
> **Status:** reviewed against the code on 26 Oct 2026. Not externally audited.

## What is worth protecting

| Asset | Why it matters |
| --- | --- |
| Booking integrity | The product's whole claim: never two bookings for one seat, never a booking for the wrong user |
| Accounts and sessions | Taking over a session lets an attacker book in someone's name and see their bookings |
| Personal data | Names and email addresses of people who register on the public demo |
| Database credentials | Full read and write access to all of the above |
| Availability | The demo should stay reachable; it runs on free tiers with no capacity headroom |

**Attackers considered:** an anonymous visitor or script on the internet, a signed-in user trying to reach other users' data, a malicious website the user visits (CSRF), and accidental leaks (logs, screenshots, commits).

**Out of scope for V1:** a compromised Render or Atlas platform, targeted denial of service, and the operator's own laptop.

## Threats and defences

| # | Threat | Defence | Evidence | Residual risk |
| --- | --- | --- | --- | --- |
| T1 | Double booking through races or retries | Conditional claim, unique index, one transaction, idempotency keys | [booking-correctness.md](../architecture/booking-correctness.md); concurrency and fault tests | Untested primary failover |
| T2 | Booking as another user | User taken only from the session; strict schema rejects `userId` (AC-13) | `bookings.test.ts`, `schemas.test.ts` | — |
| T3 | Reading other users' bookings (IDOR) | Booking queries filter by session user; foreign IDs return the same 404 as unknown ones (AC-25) | `bookings.test.ts` | Booking references are visible to their owner; they grant no access |
| T4 | Password guessing | argon2id hashing; one generic error; similar timing for unknown emails; 10 login/register attempts per minute per IP | `auth.test.ts`; `auth/routes.ts` | Per-IP limit only: no per-account lockout; distributed guessing is possible |
| T5 | Stolen session cookie | HttpOnly (no script access), `Secure` in production, `SameSite=Lax`; only a hash stored; idle and absolute expiry; rotated on login | `auth.test.ts` | A cookie stolen from the device works until it expires; no "log out everywhere" |
| T6 | Cross-site request forgery | `SameSite=Lax` cookie, `Origin` check on writes (403), JSON-only bodies (a cross-site form cannot send JSON without a preflight) | `auth.test.ts` (request hygiene) | — |
| T7 | Cross-site scripting | React escapes output; no `dangerouslySetInnerHTML`; CSP `default-src 'self'` via helmet | `app.ts` | `style-src 'unsafe-inline'` is allowed (needed by the UI) |
| T8 | Injection into database queries | All input parsed by strict Zod schemas before use; IDs validated as 24-hex ObjectIds; no raw query objects from clients | `packages/shared/src/schemas.ts` | — |
| T9 | Open redirect through `returnTo` | Only local paths accepted; `//`, schemes and backslashes rejected | `lib/returnTo.ts`; `lib.test.ts`, `booking.test.ts` | — |
| T10 | Secrets leaked | `.env` git-ignored; production secrets only in Render; logs redact cookies and passwords; production refuses to start without `APP_ORIGIN` or secure cookies | `.gitignore`, `logger.ts`, `config.ts` | The Atlas password was exposed in a screenshot on 2 Oct 2026 and has been rotated |
| T11 | Database reachable from anywhere | Atlas network access is `0.0.0.0/0` (Render free has no fixed IP); protected by a long generated password and TLS | [ADR-0007](../adr/0007-render-and-atlas.md) | Password strength is the only barrier |
| T12 | Abuse of the public demo (mass sign-ups, booking every seat) | Auth rate limit; one seat per request | — | **Not mitigated:** a script can register many accounts and book all seats; recovery is re-seeding |
| T13 | Demo scripts run against production data | The demo scripts (which reset the demo event) refuse to run unless `DEMO_MODE=true` in the environment *they* run in; the Atlas connection string is kept out of `.env` | `scripts/*-demo.ts`, `demo-reset.ts`; [troubleshooting](../development/troubleshooting.md) | Running a demo script with `DEMO_MODE=true` and the Atlas URI on the command line would reset the live demo event |
| T14 | Fault injection reaching production | `createApp` throws if faults are injected outside the test environment | `app.ts` | — |
| T15 | Vulnerable dependencies | Lockfile committed; `npm ci` in CI | — | No automated dependency alerts are configured |

## Security headers

helmet's defaults (HSTS, `X-Content-Type-Options`, frame denial and others) plus a CSP of `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`. `X-Powered-By` is disabled.

## Recommended for V2

Per-account login throttling; "log out everywhere"; email verification (raises the cost of mass sign-ups); a booking limit per user per event; GitHub Dependabot alerts; restricting Atlas network access if the host offers static outbound IPs.

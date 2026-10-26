# API contract

> **Authority for shapes:** request schemas in [`packages/shared/src/schemas.ts`](../../packages/shared/src/schemas.ts), response types in [`types.ts`](../../packages/shared/src/types.ts), error codes in [`errors.ts`](../../packages/shared/src/errors.ts). The API and the web app import the same files. This document is the readable map.
> **Status:** verified 26 Oct 2026.

## Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api`, same origin as the web app. Not versioned: the API and its only client are built and deployed together. A breaking change for outside clients would need `/api/v2`. |
| Format | JSON only. A `POST` with a body that is not `application/json` gets 415 `UNSUPPORTED_MEDIA_TYPE`. Body limit 16 KB. |
| Authentication | Session cookie `seatly_sid` (HttpOnly, `SameSite=Lax`, `Secure` in production). Set by register and login. |
| Cross-site protection | A `POST` whose `Origin` header is present and different from `APP_ORIGIN` gets 403 `ORIGIN_NOT_ALLOWED`. |
| Validation | Strict schemas: unknown fields are rejected, not ignored. 400 `VALIDATION_ERROR` with per-field messages. |
| Request ID | Every response has `X-Request-Id`; error bodies repeat it. A safe incoming `X-Request-Id` is reused. |
| Caching | Seat snapshots, bookings and `/auth/me` send `Cache-Control: no-store`. |
| Pagination | None: event lists and a user's bookings are small in V1. Add cursor pagination before either can grow large. |
| Time | ISO 8601 UTC strings; each event carries its IANA `timezone` for display. |

## Error envelope

```json
{ "error": { "code": "SEAT_TAKEN", "message": "Seat A7 was just booked by someone else.", "details": null, "requestId": "…" } }
```

`details` is `{ "fieldErrors": { "<field>": ["message"] } }` for validation errors, otherwise `null`. Clients branch on `code`, never on `message`.

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad input, malformed JSON or body too large |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_INVALID` | 400 | Booking without a UUID `Idempotency-Key` |
| `UNAUTHENTICATED` | 401 | No valid session |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (one message for both) |
| `ORIGIN_NOT_ALLOWED` | 403 | Cross-site write |
| `NOT_FOUND` | 404 | Unknown API route |
| `EVENT_NOT_FOUND` / `SEAT_NOT_FOUND` / `BOOKING_NOT_FOUND` | 404 | Unknown, malformed, or (for bookings) not yours |
| `EMAIL_TAKEN` | 409 | Registration with an existing email |
| `SEAT_TAKEN` | 409 | Someone else holds the seat (final) |
| `BOOKING_CLOSED` | 409 | The event has started (final) |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Same key still being processed; `Retry-After: 1` |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Body not JSON |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key, different request body |
| `RATE_LIMITED` | 429 | More than 10 login/register attempts a minute from one IP |
| `INTERNAL_ERROR` | 500 | Unexpected; logged with the request ID |
| `BOOKING_UNAVAILABLE` | 503 | Transient failure; retry with the same key (`Retry-After: 1`) |
| `SERVICE_UNAVAILABLE` | 503 | Declared but not returned in V1 (the health check uses its own body) |

## Endpoints

| Method and path | Auth | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/health` | — | — | 200 `{ status: 'ok', db: 'ok', replicaSet }` | 503 `{ status: 'degraded', db: 'unavailable' }` |
| `POST /api/auth/register` | — | `{ name, email, password }` | 201 `{ user }` + cookie | 400, 409 `EMAIL_TAKEN`, 429 |
| `POST /api/auth/login` | — | `{ email, password }` | 200 `{ user }` + cookie | 400, 401 `INVALID_CREDENTIALS`, 429 |
| `POST /api/auth/logout` | optional | — | 204, cookie cleared | — |
| `GET /api/auth/me` | ✓ | — | 200 `{ user }` | 401 |
| `GET /api/events` | — | — | 200 `{ events: EventSummary[] }`: events not yet started, by start time | — |
| `GET /api/events/:eventId` | — | — | 200 `{ event: EventDetail }` (includes started events, with `bookingOpen: false`) | 404 |
| `GET /api/events/:eventId/seats` | — | — | 200 `{ eventId, asOf, availableSeats, totalSeats, layout, seats[] }` | 404 |
| `POST /api/bookings` | ✓ | Header `Idempotency-Key: <uuid>`; body `{ eventId, seatId }` | 201 `{ booking }`; replay adds `Idempotent-Replayed: true` | 400, 401, 404, 409 (`SEAT_TAKEN`, `BOOKING_CLOSED`, `IDEMPOTENCY_IN_PROGRESS`), 422, 503 |
| `GET /api/bookings/:bookingId` | ✓ | — | 200 `{ booking }` | 404 (also for other users' bookings) |
| `GET /api/me/bookings` | ✓ | — | 200 `{ bookings }`, newest first | 401 |

`EventSummary` = `id, slug, title, imageUrl, imageAlt, startsAt, endsAt, timezone, venue, totalSeats, availableSeats, bookingOpen`. `EventDetail` adds `description, layout`. `Booking` = `id, reference, bookedAt, seat { seatId, row, number }, event { id, title, startsAt, timezone, venue }, bookedBy { name, email }`. Seat snapshots never reveal who booked a seat.

Booking semantics, retries and stored outcomes: [booking-correctness.md](booking-correctness.md).

## Changing the API

1. Change the schema or type in `packages/shared` first; TypeScript then shows every caller on both sides.
2. Add new response fields as additive; the web app ignores unknown fields.
3. A new error code goes in `ERROR_CODES` with its status, and in `DEFINITIVE_BOOKING_CODES` if a booking attempt should stop on it.
4. Update this table and add a test in `apps/api/test/integration/`.

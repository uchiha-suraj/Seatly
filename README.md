# Seatly

**Find your event. Secure your seat.**

Seatly is a portfolio event-booking app built around one problem: *one available seat, hundreds of competing users, exactly one successful booking.*

| Layer | Stack |
| --- | --- |
| Web | React 19, Vite, TypeScript, Tailwind 4, React Router, TanStack Query |
| API | Node 24, Express 5, TypeScript, Zod |
| Data | MongoDB 8 replica set (transactions), Mongoose |
| Tests | Vitest, React Testing Library, MSW, supertest against a real MongoDB |

Design source of truth: [Figma — Seatly V1](https://www.figma.com/design/idjCTBnahtTeUNDxIVyHKa).

## Quick start

Prerequisites: Node `24` (see `.nvmrc`; 22.22.2+ also works) and Docker (for MongoDB).

```bash
cp .env.example .env          # local defaults; never commit .env
npm ci
npm run db:up                 # single-node replica set rs0 on :27017, waits for a primary
npm run db:check              # confirms a replica set with a writable primary
npm run seed                  # 7 events (incl. the 1-seat "demo-last-seat")
npm run dev                   # API on :4000, web on :5173 (proxied /api)
```

Open http://localhost:5173.

> **Why a replica set?** MongoDB multi-document transactions only run on a replica set or a sharded cluster. `docker-compose.yml` starts a one-node set and its healthcheck runs `docker/mongo-init.js` (an idempotent `rs.initiate`), so `db:up` returns only when the node is writable.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) + web (Vite) |
| `npm run build` | Web `dist/` + bundled API `apps/api/dist/server.js` |
| `npm start` | Built API; serves the web build too when `SERVE_WEB_DIST=true` |
| `npm run start:two` | Two API processes on :4001 and :4002 (multi-process demo) |
| `npm run lint` / `typecheck` | ESLint (flat config) / `tsc` in every workspace |
| `npm test` | Unit → API integration → web |
| `npm run test:unit` | Shared schemas + API pure units (no DB) |
| `npm run test:api` | API integration tests — **needs the replica set** |
| `npm run test:web` | Component/flow tests with an MSW fake API |
| `npm run db:up` / `db:down` / `db:reset` | Start / stop / wipe MongoDB |
| `npm run demo:concurrency` | Many users race for one seat (see below) |
| `npm run demo:idempotency` | Same key replay / conflict / in-progress demo |

## Repository layout

```
apps/
  api/        Express API, Mongoose models, booking service, scripts, tests
  web/        React SPA (features/: auth, events, booking, bookings)
packages/
  shared/     Zod schemas, error codes, DTO types used by both apps
docker/       mongo-init.js (replica-set bootstrap)
.github/      CI: lint, typecheck, all tests, build, concurrency smoke demo
render.yaml   Single-service deployment blueprint (not deployed yet)
```

## How a booking stays correct

`POST /api/events/:eventId/bookings` with body `{ "seatId": "C7" }` and an `Idempotency-Key: <uuid>` header. The user comes from the session cookie only; a `userId` in the body is rejected by the strict schema.

**Database guarantees (the real defence)**

1. **Atomic conditional claim** — `Seat.findOneAndUpdate({ event, seatId, status: 'available' }, { status: 'booked', … })`. Of N concurrent claims, MongoDB lets exactly one match.
2. **Unique index** on `bookings (event, seatId)` — a second booking for a seat cannot be written even if code were wrong.
3. **One transaction** (snapshot read concern, majority write concern) wraps the seat claim, the booking insert and the idempotency-key completion. Either all three commit or none do.

**Request flow** (`apps/api/src/modules/bookings/service.ts`)

| Phase | Work | Outcome |
| --- | --- | --- |
| 0 | Auth, origin check, JSON, Zod validation | 401 / 403 / 415 / 422 |
| 1 | Insert the idempotency key `(user, key)` with a fingerprint, a 15 s lease and an `attemptId` fencing token | See idempotency table |
| 2 | Fast reads: event missing / seat missing / seat already booked | Final 404 / 409 `SEAT_TAKEN`, stored on the key |
| 3 | Transaction loop: ≤5 attempts within a 4 s deadline, jittered backoff, commit retried on `UnknownTransactionCommitResult` | 201 booking, or 409 `SEAT_TAKEN` |
| 4 | Non-final failure: fenced release of the key | 503 `BOOKING_UNAVAILABLE` (retryable with the same key) |

If a commit outcome is unknown the key is **not** released, so a retry cannot double-book; the lease expiry decides.

**Idempotency rules** (keys are scoped per user, kept 24 h)

| Same key arrives and… | Response |
| --- | --- |
| payload fingerprint differs | 422 `IDEMPOTENCY_KEY_REUSED` |
| first request completed | Stored response replayed, header `Idempotent-Replayed: true` |
| first request still running (lease valid) | 409 `IDEMPOTENCY_IN_PROGRESS`, `Retry-After: 1` |
| lease expired (crashed worker) | Takeover with a new `attemptId`; the old worker's writes are fenced out |

**Client behaviour** — 10 s timeout; on timeout / network error / 503 it retries automatically at +1 s and +3 s (+0–250 ms jitter) **with the same key**; `IN_PROGRESS` is polled up to 5 times on a separate budget. The key lives in `sessionStorage` until the outcome is known, so a refresh resumes the same attempt. A new key is created only for a new seat choice. Seat availability on screen is advisory; the server decides.

## Tests

- `packages/shared/test` — schema edge cases (seat IDs, strict bodies, UUID keys).
- `apps/api/test/unit` — crypto helpers, error mapping, config parsing.
- `apps/api/test/integration` — against a real replica set, one database per worker:
  `auth`, `events`, `bookings` (ownership: other users get 404), `idempotency`, `transaction-failures` (MongoDB `failCommand` fail points + injected fault points: transient errors, unknown commit result, lease takeover, crash after claim), `concurrency` (50 users, one seat → exactly one 201, one booking row).
- `apps/web/test` — seat-map keyboard navigation, booking states, same-key retry, login-intent restore.

The integration suite refuses to run without a replica set and says why.

## Concurrency demonstration

```bash
# terminal 1 (DEMO_MODE=true in .env)
npm run build && npm run start:two
# terminal 2
npm run demo:concurrency -- --users 100 --targets http://localhost:4001,http://localhost:4002
npm run demo:idempotency -- --targets http://localhost:4001
```

The demo resets the 1-seat event, logs in N users (not timed), releases all requests at once, then queries MongoDB directly. It writes `demo-results/*.json` and exits non-zero unless there is exactly one success, one persisted booking and zero unexpected responses. This is a correctness demonstration on one machine, **not** a capacity or load benchmark. There is no load-test button in the UI.

## Security notes

- Opaque 256-bit session token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production); only its SHA-256 hash is stored. Idle timeout 120 min, absolute 7 days, rotated on login.
- Passwords hashed with argon2id; login timing equalised for unknown emails.
- Mutating requests need an allowed `Origin`; JSON only; helmet CSP; auth rate limit.
- Secrets live in `.env` (git-ignored). `.env.example` holds safe local defaults only.

## Deployment

`render.yaml` describes one web service (API serving the built SPA) that needs a `MONGODB_URI` pointing at a replica set such as MongoDB Atlas. **It has not been deployed.**

## Credits

See [CREDITS.md](CREDITS.md).

# Application structure

> **Authority:** how the code is organised by layer, who owns which state, and the rules for adding code. Folder-level conventions are in [repository-guide.md](../development/repository-guide.md).
> **Status:** verified 26 Oct 2026.

## Backend (`apps/api/src`)

```
server.ts          start-up: config → database → indexes → app → listen (+ demo date roller)
app.ts             createApp(): middleware order, routers, static web build, error handler
config.ts          environment → typed Config (fails fast on bad or unsafe values)
db/                models, connection (+ replica-set check, syncIndexes), seed
middleware/        request ID, Origin check, JSON-only, session, requireAuth, errors
modules/auth/      register, login (argon2id), sessions; routes
modules/events/    list, details, seat snapshot; booking-open rule
modules/bookings/  idempotency store, booking service (phases 1–4), routes, DTO mapping
lib/               clock, errors, crypto, fault points, validation helper
```

**Request pipeline** (`app.ts`): request ID → HTTP logging → helmet (CSP) → `/api` router: JSON parser (16 KB) → cookies → Origin check → JSON-only → session → routes → 404 → error handler. Outside `/api`, the server serves the built React app and falls back to `index.html` for client routes when `SERVE_WEB_DIST=true`.

**Module rules**

- Routes stay thin: parse with a shared schema, call a service, send its result. Business rules live in services.
- Services take their dependencies in the constructor (`config`, `clock`, `faults`, `logger`), so tests can control time and inject failures.
- Every error a client can see is an `AppError` with a code from `ERROR_CODES`. Anything else becomes a logged 500.
- Database access goes through the Mongoose models in `db/models.ts`. Writes that must be atomic go in one transaction or one conditional update; never "read, then write" across two statements.
- **Fault points** (`afterKeyClaimed`, `afterSeatClaimed`, `beforeKeyCompleted`, `beforeCommit`, `afterCommit`) are no-ops in production; `createApp` refuses fault injection outside tests.

**Jobs:** none, apart from the optional hourly demo-date roller in `server.ts` (`DEMO_ROLLING_DATES`). Expiry of sessions and idempotency keys is handled by MongoDB TTL indexes.

## Frontend (`apps/web/src`)

```
main.tsx           router + TanStack Query provider
app/               routes, layout (header, skip link, footer), query client defaults
api/               fetch wrapper (ApiError), typed endpoint functions
features/auth/     log in / register page, guards, useMe
features/events/   event list and card, event details, seat map, seat-map polling
features/booking/  booking panel (15 states), booking attempt hook, pending-attempt storage
features/bookings/ my bookings, booking details
components/        header, not-found page, ui/ primitives (Button, TextInput, Alert, Badge, Skeleton, Icon)
lib/               date formatting, safe returnTo, retry schedule
```

### Who owns which state

| State | Owner | Notes |
| --- | --- | --- |
| Server data (me, events, event, seats, bookings) | TanStack Query cache | Keys: `['me']`, `['events']`, `['event', id]`, `['seats', id]`, `['myBookings']`, `['booking', id]`. Seats: `staleTime 0`, polled every 10 s while visible. Event: 5 min. Events list: 30 s. A 401 anywhere sets `['me']` to `null`. |
| Selected seat | `EventDetailsPage` state, mirrored to `?seat=` | The URL keeps it across reloads and login |
| Booking attempt | `useBookingAttempt` | The **only** code that creates or reuses an idempotency key |
| Pending attempt (key + seat) | `sessionStorage` (`seatly:pending:<eventId>`) | Survives reload in the same tab; cleared on a definitive answer |
| Form fields and errors | `AuthPage` local state | Validated with the shared schemas |

### Rules

- Fetch through `api/endpoints.ts` only; every failure becomes an `ApiError` with `kind`, `status`, `code` and `isUncertain`.
- GET requests retry twice on network errors and 5xx, never on 4xx. Bookings never use the query library's retries; `useBookingAttempt` handles them with the same key.
- Seat availability on screen is advisory: after every booking answer the seat map refetches, and the server's answer always wins.
- Copy, states and layout follow Figma and [ui-spec.md](../design/ui-spec.md). A new UI state needs a Figma frame or an entry under "Design deviations" there.

## Shared package (`packages/shared/src`)

`schemas.ts` (Zod input schemas, regexes), `errors.ts` (codes → status, error body type, header names), `types.ts` (response DTOs). Both apps import TypeScript source directly; the API bundle inlines it at build time (esbuild alias in `apps/api/scripts/build.mjs`).

Dependency direction: `web → shared`, `api → shared`; `shared` imports only Zod. `web` and `api` never import each other.

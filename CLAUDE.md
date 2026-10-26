# CLAUDE.md

Guidance for AI-assisted work on Seatly. Humans: start at [README.md](README.md) and [docs/index.md](docs/index.md).

## What this is

An event-booking app whose point is one guarantee: **exactly one booking per seat under any concurrency, and at most one booking per request under any retry.** npm workspaces: `apps/api` (Express 5 + Mongoose 9), `apps/web` (React 19 + Vite), `packages/shared` (Zod schemas, error codes, types). MongoDB **replica set** required.

## Commands

```bash
npm ci
npm run db:up            # Docker MongoDB replica set rs0
npm run seed
npm run dev              # API :4000, web :5173
npm run lint && npm run typecheck && npm test && npm run build   # all must pass
npm run test:unit | test:api | test:web
```

`test:api` needs the replica set. If you cannot run it, say so; do not report it as passing.

## Read before changing

| Changing | Read first |
| --- | --- |
| Anything in booking, idempotency, seats | [docs/architecture/booking-correctness.md](docs/architecture/booking-correctness.md) |
| API shapes or error codes | [docs/architecture/api.md](docs/architecture/api.md) — change `packages/shared` first |
| Models or indexes | [docs/architecture/data-model.md](docs/architecture/data-model.md) |
| UI | [docs/design/ui-spec.md](docs/design/ui-spec.md) and Figma |
| Where code goes, definition of done | [docs/development/repository-guide.md](docs/development/repository-guide.md) |
| Environment variables | [docs/development/configuration.md](docs/development/configuration.md) |

## Hard rules

- The booking user comes **only** from the session. Never accept a user ID from the client.
- Never weaken the conditional seat claim, the `event_seat_unique` index, or the single transaction. Never "read then write" seat state.
- A booking retry must reuse the same idempotency key. Only `useBookingAttempt` creates keys.
- Additive schema changes only, unless a migration script and a CHANGELOG entry come with it.
- Keep `expectInvariantHolds` running after every integration test.
- No secrets, connection strings, real personal data or `.env` in commits, docs, logs or chat.
- Demo scripts (`npm run demo:*`) are local only. Never point them, or `DEMO_MODE=true`, at the live database.
- No public load-test button. Do not present the concurrency demo as capacity.
- Do not create accounts on, or run scripts against, the live site unless the owner asks.

## Verification and reporting

- Never claim a check passed unless it ran in this session; name where it ran. List unverified steps explicitly.
- Never call a deploy successful until `/api/health` and the affected flow were checked on the live site.
- Use the doc labels: **Verified** (with date), **Approved**, **Proposed**, **Assumption**, **Open**.
- Update the affected docs, `CHANGELOG.md` and [docs/handoff.md](docs/handoff.md) in the same change.

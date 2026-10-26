# Configuration

> **Authority:** [`apps/api/src/config.ts`](../../apps/api/src/config.ts) defines and validates every variable. This page explains them. Local defaults are in [`.env.example`](../../.env.example); production values in [`render.yaml`](../../render.yaml) and the Render dashboard.
> **Status:** verified 26 Oct 2026.

The API reads its environment once at startup and **refuses to start** on an invalid value. The web app has no runtime configuration: in development Vite proxies `/api` to `localhost:4000`; in production it is served from the same origin.

## Variables

| Variable | Default | Production (live demo) | Meaning |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | `development`, `test` or `production` |
| `PORT` | `4000` | set by Render | HTTP port |
| `MONGODB_URI` | — (required) | **Secret**, set in Render | Connection string including the database name (`/seatly`). Must reach a replica set |
| `APP_ORIGIN` | `http://localhost:5173` | **Required**, set in Render: `https://seatly-02yb.onrender.com` | The only origin allowed to send writes. Wrong value → every login and booking gets 403 |
| `COOKIE_SECURE` | `false` | `true` (required) | Adds `Secure` to the session cookie |
| `TRUST_PROXY` | `0` | `1` | Number of proxies in front (Render has one); needed for correct client IPs in the rate limit |
| `SESSION_IDLE_MINUTES` | `120` | default | Session ends after this much inactivity |
| `SESSION_ABSOLUTE_DAYS` | `7` | default | Session ends this long after login regardless |
| `BOOKING_DEADLINE_MS` | `4000` | default | Total time budget for the booking transaction loop |
| `IDEMPOTENCY_LEASE_MS` | `15000` | default | How long a worker owns an in-progress key before another may take over |
| `IDEMPOTENCY_TTL_HOURS` | `24` | default | How long booking request outcomes are kept |
| `AUTH_RATE_LIMIT_PER_MIN` | `10` | default | Login and register attempts per IP per minute |
| `ARGON2_MEMORY_KIB` | `65536` | `19456` | argon2id memory cost (min 8192). Lowered on Render's 512 MB instance |
| `DEMO_MODE` | `false` | `false` | `true` only locally: lets `npm run demo:*` reset the demo event and turns off the auth rate limit |
| `DEMO_ROLLING_DATES` | `false` | `true` | Moves seeded events that have started forward by 49 days, at startup and hourly ([ADR-0012](../adr/0012-booking-closes-at-start.md)) |
| `SERVE_WEB_DIST` | `false` | `true` | Serve the built React app from `apps/web/dist` |
| `LOG_LEVEL` | `info` | `info` | pino level |
| `MONGODB_URI_TEST` | — | not used | Tests only: replica-set server for integration tests (each worker uses its own `seatly_test_<n>` database) |

## Production safety rules

Enforced by `loadConfig`:

- `NODE_ENV=production` without an explicit `APP_ORIGIN` → startup error.
- `NODE_ENV=production` with `COOKIE_SECURE` not `true` → startup error.
- Fault injection outside `NODE_ENV=test` → `createApp` throws.

Not enforced, so follow them yourself:

- Never set `DEMO_MODE=true` anywhere that can reach the Atlas database.
- Keep the Atlas connection string **out of `.env`**. Pass it on the command line for the one-off commands that need it (`db:check`, `seed`), so a later `npm run demo:*` cannot touch live data ([troubleshooting](troubleshooting.md#atlas-from-your-machine)).
- `.env` is git-ignored. Never commit it, paste it into an issue, or show it in a screenshot.

## Changing configuration

Add the variable to the schema and `Config` type in `config.ts`, to `.env.example` with a comment, to `render.yaml` if production needs a non-default value, to this table, and a unit test in `apps/api/test/unit/errors-config.test.ts` if it has a safety rule. On Render, a value added to `render.yaml` arrives with the next Blueprint sync ([deployment.md](../operations/deployment.md)).

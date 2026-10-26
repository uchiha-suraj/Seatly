# Observability and recovery

> **Authority:** what is logged and monitored, what is not, and how to recover. Accepted V1 position: free tiers, no alerting, recovery by re-seeding (decisions Q4–Q5, 25 Oct 2026).
> **Status:** describes the configuration as of 26 Oct 2026.

## What exists

| Signal | Where | Notes |
| --- | --- | --- |
| Health check | `GET /api/health` → `ok` or `degraded` (database ping and replica-set name) | Render uses it for deploys and restarts |
| Request logs | Render → Logs; pino JSON (method, path, status, duration, request ID, client IP) | Cookie headers and password fields are redacted. Retention is Render's; not configured |
| Request IDs | `X-Request-Id` on every response, repeated in error bodies | Match a user's error to a log line |
| Booking logs | Warnings: attempts exhausted, database unavailable, commit result unknown, key release failed | Search by request ID |
| Invariant alarm | Error log `INVARIANT_ALERT: duplicate booking blocked by unique index` | Should never appear; if it does, run [the invariant check](runbooks.md#check-the-booking-invariant) |
| Demo-date roller | "demo events moved forward" with a count | Only when something moved |
| CI demo reports | GitHub Actions artifact `demo-results` | One per CI run |

## What does not exist (accepted for V1)

- No uptime monitor, alerting, error tracker or metrics dashboard. Problems are found by visiting the site.
- No log retention or search beyond Render's built-in view.
- No database backups confirmed for the Atlas free cluster.
- No recovery time or recovery point objectives.

## Recovery

| Failure | Recovery | Data lost |
| --- | --- | --- |
| Bad deploy | Roll back in Render ([deployment.md](deployment.md#rollback)) | None |
| Service crash | Render restarts it automatically | None (state is in MongoDB) |
| Atlas password leaked | [Rotate](runbooks.md#leaked-credentials) | None |
| Demo data exhausted or damaged | [Re-seed](runbooks.md#re-seed-the-live-demo) | With a full reset: all users and bookings |
| Atlas cluster lost | New cluster, update `MONGODB_URI`, seed | Everything; acceptable for a demo |

## V2 candidates

Free uptime monitor on `/api/health` with email alerts; an error tracker; confirming or adding Atlas backups; a log drain with defined retention.

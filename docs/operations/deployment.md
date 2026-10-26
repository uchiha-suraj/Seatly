# Deployment

> **Authority:** environments, how a change reaches the live demo, how to check it and how to roll back. Variables are defined in [configuration.md](../development/configuration.md).
> **Status:** process verified on 2 Oct 2026 (first deploy). The V1.1 deploy has **not** happened yet.

## Environments

| Environment | Where | Database | Purpose |
| --- | --- | --- | --- |
| Local | Developer machine | Docker one-node replica set `rs0` | Development, tests, demos (`DEMO_MODE=true` allowed) |
| CI | GitHub Actions, `ubuntu-latest` | Docker one-node replica set, thrown away | Lint, typecheck, tests, build, 300-user demo |
| Live demo | Render web service `seatly`, free plan, Singapore — https://seatly-02yb.onrender.com | MongoDB Atlas free cluster, database `seatly` | Public portfolio demo |

There is no staging environment. CI is the gate.

## How a change ships

1. Push to `main` on GitHub (`uchiha-suraj/Seatly`).
2. CI runs ([testing.md](../development/testing.md#ci)). **Do not rely on a deploy whose commit has a red CI.** Render does not wait for CI.
3. Render auto-deploys `main`: `npm ci --include=dev && npm run build`, then `npm run start`. Render switches traffic only after `/api/health` returns 200.
4. Smoke check (below). Record the result in [handoff.md](../handoff.md).

**Blueprint changes:** the service is managed by `render.yaml`. A changed value in `render.yaml` (for example the new `DEMO_ROLLING_DATES`) is applied by a Blueprint sync: Render dashboard → Blueprints → seatly → **Manual sync** if it does not sync on its own. Secrets (`MONGODB_URI`, `APP_ORIGIN`) are `sync: false` and only ever set in the dashboard.

## Smoke check after a deploy

1. `https://seatly-02yb.onrender.com/api/health` → `{"status":"ok","db":"ok","replicaSet":"…"}` (the first request may take about 50 s on a sleeping instance).
2. Home page lists events, and none of them has started.
3. Register or log in with a test account **you** create, book a free seat, open My bookings.
4. In a second browser, try the same seat → "Seat … was just taken".
5. Render → Logs: no errors at startup; with rolling dates on, a "demo events moved forward" line appears only when something moved.

Never run `npm run demo:*` against the live site.

## Rollback

- **Code:** Render dashboard → seatly → Events → pick the last good deploy → **Rollback**. Or `git revert` the bad commit and push.
- **Data:** there are no backups in V1 (decision Q5). Schema changes are additive only, so an older build can read newer data. If live data is damaged, re-seed ([runbooks.md](runbooks.md#re-seed-the-live-demo)).

## Seeding the live database

Render's free plan has no shell, so seeding runs from a developer machine with the Atlas URI passed on the command line only ([troubleshooting](../development/troubleshooting.md#keep-the-atlas-uri-out-of-env)):

```bash
MONGODB_URI='…' npm run db:check
MONGODB_URI='…' npm run seed
```

The seed is idempotent and also moves started events forward.

## First-time setup

The one-time Atlas and Render steps (cluster, database user, network access, Blueprint) are in the [README](../../README.md#deployment).

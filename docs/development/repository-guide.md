# Repository guide

> **Authority:** where code goes, conventions, and when a change is done. Layer-by-layer structure is in [application.md](../architecture/application.md).
> **Status:** verified against the repository on 26 Oct 2026.

## Layout

```
apps/api/            Express API (TypeScript, bundled with esbuild)
  src/               server, app, config, db, middleware, modules/{auth,events,bookings}, lib
  scripts/           build, seed, db-check, demo-reset, concurrency and idempotency demos
  test/unit/         pure units, no database
  test/integration/  supertest against a real replica set, one database per worker
apps/web/            React app (Vite)
  src/               app, api, features/{auth,events,booking,bookings}, components, lib
  test/              Testing Library + MSW fake API
packages/shared/     Zod schemas, error codes, response types used by both apps
docker/              mongo-init.js (initiates the one-node replica set)
docs/                this documentation; start at docs/index.md
.github/workflows/   CI
render.yaml          Render Blueprint for the live demo
```

## Dependency boundaries

- `web → shared` and `api → shared` only. The apps never import each other.
- `shared` depends only on Zod. Anything with Node, Express, Mongoose or React in it does not belong there.
- Inside the API, routes call services; services call models. Routes never touch models directly.
- Inside the web app, components call hooks; hooks call `api/endpoints.ts`. Components never call `fetch`.

## Where new code goes

| You are adding | Put it in |
| --- | --- |
| A request field, response field or error code | `packages/shared` first, then both apps ([api.md](../architecture/api.md#changing-the-api)) |
| A business rule | The module's `service.ts` in `apps/api/src/modules/<area>/` |
| An HTTP endpoint | The module's `routes.ts`, mounted in `app.ts` |
| A collection or index | `apps/api/src/db/models.ts` (indexes are named; see [data-model.md](../architecture/data-model.md)) |
| An environment variable | `apps/api/src/config.ts`, `.env.example`, `render.yaml` if production needs it, and [configuration.md](configuration.md) |
| A screen or UI state | `apps/web/src/features/<area>/`; matching Figma frame or a "Design deviations" entry in [ui-spec.md](../design/ui-spec.md) |
| A reusable UI primitive | `apps/web/src/components/ui/` |
| A significant decision | A new ADR in `docs/adr/` ([README](../adr/README.md)) |

## Conventions

- **TypeScript strict** everywhere; no `any` in application code. ESLint flat config at the root.
- **Files:** React components `PascalCase.tsx`; hooks `useThing.ts`; everything else `camelCase.ts`. Tests mirror the area: `*.test.ts(x)`.
- **Errors:** throw `AppError(code, message)` with a code from `ERROR_CODES`. Clients branch on `code`, never on `message`.
- **Time:** inject `Clock` in services; never call `new Date()` inside business logic you want to test.
- **Database writes** that must be atomic go in one conditional update or one transaction. Never read-then-write across two statements.
- **Copy** is plain English, sentence case, and matches Figma.
- **Commits:** Conventional Commits style (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one logical change each.

## Definition of done

A change is done when all of these hold:

1. `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass locally, and CI is green.
2. New behaviour has a test at the lowest layer that can prove it; booking changes also keep the invariant check passing ([testing.md](testing.md)).
3. Requirements, feature specs, API or data-model docs that the change affects are updated in the same commit, with status labels and dates.
4. `CHANGELOG.md` has an entry if users or operators would notice the change.
5. No secrets, real personal data or production connection strings are committed.
6. If it is deployed: the live health check and the affected flow were checked, and the result is recorded. A deploy is not called successful until that check has run.

## Contribution workflow

1. Branch from `main` (or work on `main` for a solo change).
2. Make the change with its tests and docs.
3. Run the four checks above.
4. Push; wait for CI; Render redeploys `main` automatically ([deployment.md](../operations/deployment.md)).
5. Update [`docs/handoff.md`](../handoff.md) at the end of a working session.

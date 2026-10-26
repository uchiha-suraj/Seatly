# Handoff

> Updated at the end of every working session. Newest session first; keep at most the last three.

## Session: 25–26 Oct 2026 — documentation and V1 close-out

**Goal:** document V1 (Stages A–D of the documentation brief) and close the remaining small V1 gaps so V2 can start.

### Done

- **Code (V1.1):** booking closes when an event starts (`BOOKING_CLOSED`, `bookingOpen`, list hides started events, *closed* panel); rolling demo dates (`DEMO_ROLLING_DATES`, on in `render.yaml`); seat names "Row A, seat 5, …"; `GuestOnly` `returnTo` race fixed; CI demo at 300 users; flaky polling test fixed.
- **Docs:** `docs/index.md`; product (overview, requirements, rules and flows); UI spec; architecture (overview, booking correctness, data model, API, application); ADR-0001 to 0012; threat model; personal data; development guides; feature specs F-01 to F-06; operations (deployment, runbooks, observability, limits); `CHANGELOG.md`; `known-issues.md`; `status.md`; `CLAUDE.md`; `LICENSE` (MIT).

### Checks run (cloud workspace, 26 Oct 2026)

Lint, typecheck, unit 31/31, web 48/48 (×10), build, Playwright + axe audit (7 screens × 2 widths), internal doc link check.

### Not verified

- API integration tests, including the new `event-lifecycle.test.ts` (no MongoDB in the workspace).
- Concurrency demo at 300 users (now in CI).
- Deployment of V1.1, Blueprint sync of `DEMO_ROLLING_DATES`, live list showing only upcoming events.
- The invariant-check queries in the runbook on Atlas.

### Next steps (Suraj)

1. Pull the synced files, run `npm run test:api` locally (Docker up), then commit and push.
2. Confirm CI is green; download the `demo-results` artifact and record the 300-user result in requirements (AC-22).
3. Confirm Render redeployed; Blueprint → Manual sync if `DEMO_ROLLING_DATES` is missing; run the [smoke check](operations/deployment.md#smoke-check-after-a-deploy).
4. Delete the old manually created Render service and the local `_to_delete` folder.
5. Choose the first V2 theme (Q7).

### Decisions this session

Q1 repo docs are the source of truth · Q2 re-run demo at 300 · Q3 V1 finished, plan V2 · Q4 document privacy as is · Q5 re-seed instead of backups · Q6 MIT · Q8 fix past events now (V1.1).

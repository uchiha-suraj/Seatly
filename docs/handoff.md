# Handoff

> Updated at the end of every working session. Newest session first; keep at most the last three.

## Session: 25–27 Oct 2026 — documentation and V1 close-out

**Goal:** document V1 (Stages A–D of the documentation brief) and close the remaining small V1 gaps so V2 can start.

### Done

- **Code (V1.1):** booking closes when an event starts (`BOOKING_CLOSED`, `bookingOpen`, list hides started events, *closed* panel); rolling demo dates (`DEMO_ROLLING_DATES`, on in `render.yaml`); seat names "Row A, seat 5, …"; `GuestOnly` `returnTo` race fixed; CI demo at 300 users; flaky polling test fixed.
- **Docs:** `docs/index.md`; product (overview, requirements, rules and flows); UI spec; architecture (overview, booking correctness, data model, API, application); ADR-0001 to 0012; threat model; personal data; development guides; feature specs F-01 to F-06; operations (deployment, runbooks, observability, limits); `CHANGELOG.md`; `known-issues.md`; `status.md`; `CLAUDE.md`; `LICENSE` (MIT).

### Checks run (cloud workspace, 26 Oct 2026)

Lint, typecheck, unit 31/31, web 48/48 (×10), build, Playwright + axe audit (7 screens × 2 widths), internal doc link check.

### Not verified

- A booking on the live site after the V1.1 deploy.
- The invariant-check queries in the runbook on Atlas.

### Deploy, 27 Oct 2026

The first V1.1 deploy crashed at startup: Atlas refused connections (`tlsv1 alert internal error`) because the `0.0.0.0/0` access-list entry had expired. Suraj re-added it as permanent and redeployed (`4f4d817`, 01:59 IST). Checked on the live site the same day: `/api/health` ok; the event list has 7 upcoming events, all `bookingOpen: true`; three seeded events were moved to December, so `DEMO_ROLLING_DATES` is active.

### CI, 27 Oct 2026

Run #8 on `4f4d817` green: lint, typecheck, unit 31/31, API integration 53/53 (lifecycle tests included), web 48/48, build, 300-user concurrency demo (1 × 201, 299 × 409, 0 unexpected, 1 booking) and idempotency demo. **V1 is complete.**

### Next steps (Suraj)

1. Commit and push the final doc update.
2. Delete the old manually created Render service and the local `_to_delete` folder.
3. Choose the first V2 theme (Q7).

### Decisions this session

Q1 repo docs are the source of truth · Q2 re-run demo at 300 · Q3 V1 finished, plan V2 · Q4 document privacy as is · Q5 re-seed instead of backups · Q6 MIT · Q8 fix past events now (V1.1).

### Not done

- CI uses GitHub actions that target the deprecated Node 20 runtime (warning only); see [known issues](known-issues.md).

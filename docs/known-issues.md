# Known issues, risks and technical debt

> **Authority:** what is wrong, fragile or deliberately left out, in one list. Each item links to where it is discussed. Review at the start of each version.
> **Status:** 26 Oct 2026, at V1 close-out.

## Open issues

| # | Issue | Impact | Plan |
| --- | --- | --- | --- |
| KI-1 | Anyone can script sign-ups and book every seat on the live demo (threat T12) | Demo looks sold out | Re-seed ([runbook](operations/runbooks.md#re-seed-the-live-demo)); V2: email verification, per-user limits |
| KI-2 | No privacy page or self-service account deletion; personal data kept indefinitely | Fine for a demo; not for real users | V2 ([personal-data.md](security/personal-data.md#known-gaps-v2)) |
| KI-3 | No monitoring, alerting or confirmed backups | Outages noticed only by visiting; data loss possible | Accepted for V1 (Q5); V2 ([observability](operations/observability-and-recovery.md)) |
| KI-4 | Cold start of about 50 s on the free Render plan | Poor first impression | Accepted (NFR-10); paid instance if it matters |
| KI-5 | Screen-reader pass never done; automated checks (axe, keyboard) pass | Unknown issues for screen-reader users | V2: one pass with NVDA or VoiceOver |
| KI-6 | The *liveTaken* and *closed* panel states have no Figma frames | Design file incomplete | V2 design task |
| KI-7 | Per-IP login limit only; no per-account lockout; no "log out everywhere" | Slow distributed guessing possible | V2 ([threat model](security/threat-model.md#recommended-for-v2)) |
| KI-8 | No automated dependency alerts | Vulnerable packages could go unnoticed | Turn on Dependabot (V2, small) |
| KI-9 | Primary failover during a booking only tested with a one-node replica set (step-down), not a real multi-node election | Untested path, though designed for ([booking-correctness](architecture/booking-correctness.md#limits)) | Accepted |

## Pending verification (V1.1)

| Item | How it gets verified |
| --- | --- |
| `event-lifecycle.test.ts` has never run | CI on the next push, and `npm run test:api` locally |
| AC-22 at 300 users | CI step on the next push |
| `DEMO_ROLLING_DATES` applied on Render; live list shows only upcoming events | After deploy ([deployment](operations/deployment.md#smoke-check-after-a-deploy)) |
| Invariant check queries in the runbook | First use on Atlas |

## Technical debt

- TypeScript pinned to 6.0 until typescript-eslint supports 7 ([ADR-0011](adr/0011-typescript-6-pin.md)).
- `SERVICE_UNAVAILABLE` error code is declared but never returned.
- No pagination on event lists or My bookings (fine at V1 sizes).
- Integration tests need Docker; there is no in-memory replica-set option for quick local runs.
- An old, manually created Render service from the first deploy attempt still exists and should be deleted (Suraj, in the Render dashboard).

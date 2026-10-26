# Seatly documentation

Seatly is a web app for booking one specific seat at an event. Its point is a guarantee: **when many people try to book the last seat at the same moment, exactly one booking succeeds, and retrying a request never creates a second booking.** V1 is built, tested and live; V1.1 (26 Oct 2026) closes its remaining gaps. It is a portfolio project with no business model, so the documentation is written for two readers: the owner (Suraj), and a developer or reviewer who joins later and needs to understand the system quickly.

> **Status of this index:** updated 26 Oct 2026 after Stage D. Every document listed below exists.
>
> **Source of truth:** these repository docs (decision Q1, 25 Oct 2026). The Stage 1–6 Claude Docs are kept only as history.

## How to read this

Labels used throughout the docs:

| Label | Meaning |
| --- | --- |
| **Verified** | Checked against the code, a test run or the live system; the date says when |
| **Approved** | A requirement or decision Suraj accepted |
| **Proposed** | Recommended, not yet accepted |
| **Assumption** | Taken as true without proof; listed so it can be checked |
| **Open** | A question waiting for an answer |

**Reading order for a new developer:** [README](../README.md) → [Product overview](product/overview.md) → [Requirements](product/requirements.md) → [Architecture overview](architecture/overview.md) → [Booking correctness](architecture/booking-correctness.md) → [Repository guide](development/repository-guide.md) → [Codebase walkthrough](development/codebase-walkthrough.md) → [Testing](development/testing.md) → [Deployment](operations/deployment.md).

**Where things stand right now:** [status.md](status.md) · latest session: [handoff.md](handoff.md) · what is wrong or fragile: [known-issues.md](known-issues.md).

## Document map

"Authority" is the one place that subject is defined. Other documents link to it instead of repeating it.

### Product and design

| Document | Authority for |
| --- | --- |
| [product/overview.md](product/overview.md) | Why Seatly exists, users, success measures |
| [product/requirements.md](product/requirements.md) | Requirements AC-1 to AC-28, NFR-1 to NFR-10, scope, roadmap |
| [product/rules-and-flows.md](product/rules-and-flows.md) | Roles, business rules, invariants, state diagrams, journeys J1 to J13 |
| [Figma: Seatly V1](https://www.figma.com/design/idjCTBnahtTeUNDxIVyHKa) | Visual design |
| [design/ui-spec.md](design/ui-spec.md) | UI behaviour: routes, states, forms, responsive rules, accessibility |
| [features/](features/README.md) | Feature specs F-01 to F-06 |

### Architecture and decisions

| Document | Authority for |
| --- | --- |
| [architecture/overview.md](architecture/overview.md) | Components, data flows, deployment topology |
| [architecture/booking-correctness.md](architecture/booking-correctness.md) | The double-booking guarantee |
| [architecture/data-model.md](architecture/data-model.md) | Collections, indexes, lifecycle |
| [architecture/api.md](architecture/api.md) | The HTTP contract and error codes |
| [architecture/application.md](architecture/application.md) | Code structure by layer, state ownership |
| [adr/](adr/README.md) | Why each significant choice was made (ADR-0001 to 0012) |

### Security

| Document | Authority for |
| --- | --- |
| [security/threat-model.md](security/threat-model.md) | Threats T1 to T15 and defences |
| [security/personal-data.md](security/personal-data.md) | Personal data held, access, deletion (current state, decision Q4) |

### Development

| Document | Authority for |
| --- | --- |
| [README](../README.md) | First impression, quick start, scripts |
| [development/repository-guide.md](development/repository-guide.md) | Where code goes, conventions, definition of done |
| [development/configuration.md](development/configuration.md) | Environment variables |
| [development/testing.md](development/testing.md) | Test layers, CI, latest results |
| [development/codebase-walkthrough.md](development/codebase-walkthrough.md) | One booking traced through the code |
| [development/troubleshooting.md](development/troubleshooting.md) | Local setup problems |
| [CLAUDE.md](../CLAUDE.md) | Rules for AI-assisted work |

### Operations

| Document | Authority for |
| --- | --- |
| [operations/deployment.md](operations/deployment.md) | Environments, shipping, smoke checks, rollback |
| [operations/runbooks.md](operations/runbooks.md) | Responding to failures, invariant check, re-seeding |
| [operations/observability-and-recovery.md](operations/observability-and-recovery.md) | Logs, what is not monitored, recovery |
| [operations/limits-and-costs.md](operations/limits-and-costs.md) | Free-tier limits and capacity |
| [CHANGELOG.md](../CHANGELOG.md) | Release history |

### Not applicable to V1

Payments (V2 candidate), AI features, mobile app releases, offline sync, real-time push (the seat map polls instead), multi-tenancy, background job queues (only database TTL expiry and the hourly demo-date roller), a public third-party API, content moderation, localization (English only; event times use the event's time zone). Assets are original or open-licensed; see [CREDITS.md](../CREDITS.md). The code is released under the [MIT licence](../LICENSE).

## Decisions from the documentation stages

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Source of truth | Repo docs; Stage 1–6 Claude Docs are history (25 Oct 2026) |
| Q2 | AC-22 | Run the demo with 300 users; now a CI step (25–26 Oct 2026) |
| Q3 | Roadmap | V1 is finished; plan a V2 (25 Oct 2026) |
| Q4 | Privacy | Document the current state now; improve in V2 (25 Oct 2026) |
| Q5 | Backups | Re-seed for now; revisit later (25 Oct 2026) |
| Q6 | Licence | MIT (25 Oct 2026) |
| Q8 | Past events still bookable | Fix now as V1.1: booking closes at start, rolling demo dates (26 Oct 2026; AC-28, ADR-0012) |

## Gaps found during documentation

| # | Finding | Outcome |
| --- | --- | --- |
| G1 | README said invalid input returns 422; the code returns 400 `VALIDATION_ERROR` | Fixed 26 Oct 2026 |
| G2 | AC-22 run used 100 users, requirement says ≥ 200 | 300 users in CI from V1.1; **first result pending** |
| G3 | Stage 1 said the seat map refreshes only on load and focus; V1 polls | Recorded as AC-27 and ADR-0010 |
| G4 | Stage 1–6 docs outside the repo | Resolved by Q1 |
| G5 | No licence | MIT added (Q6) |
| G6 | No monitoring, backups unconfirmed | Accepted for V1 (Q5); documented in operations; V2 candidate |
| G7 | Started events stayed listed and bookable | Fixed in V1.1 (AC-28); API tests pending first run |
| G8 | AC-26 only partly verified | Verified 26 Oct 2026 by automated audit; screen-reader pass left for V2 |

## Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q7 | Which V2 theme comes first? Candidates in [requirements.md](product/requirements.md#roadmap) | V2 requirements and feature specs |

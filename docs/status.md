# Implementation status

> **Authority:** where each feature and requirement stands right now. Requirement wording is in [requirements.md](product/requirements.md); this page only tracks state.
> **Status:** 27 Oct 2026. **V1 is complete**; V1.1 is live and CI is green.

## Version

| Version | State |
| --- | --- |
| V1.0 | Live since 2 Oct 2026 at https://seatly-02yb.onrender.com |
| V1.1 | Pushed and **live since 27 Oct 2026** (commit `4f4d817`). Verified on the live site: health ok, all 7 listed events upcoming with `bookingOpen: true`, three seeded events moved forward to December by the date roller. CI run #8 green: unit 31/31, API 53/53, web 48/48, 300-user demo passed |
| V2 | Not started. Theme to be chosen (open question Q7) |

## Features

| Feature | State | Notes |
| --- | --- | --- |
| [F-01](features/F-01-auth.md) Accounts and sessions | Done | `returnTo` race fixed in V1.1 |
| [F-02](features/F-02-events-and-seat-map.md) Events and seat map | Done | V1.1: started events hidden; seat names per WCAG 2.5.3 |
| [F-03](features/F-03-booking.md) Booking | Done | 300-user demo passes in CI |
| [F-04](features/F-04-my-bookings.md) My bookings | Done | — |
| [F-05](features/F-05-live-seat-map.md) Live seat map | Done | No Figma frame for *liveTaken* |
| [F-06](features/F-06-event-lifecycle.md) Booking closes at start | Done | Live 27 Oct 2026; tests pass in CI |

## Requirements

| Requirements | State |
| --- | --- |
| AC-1 to AC-21, AC-23 to AC-25, AC-27 | Verified (2 Oct 2026; see requirements for evidence) |
| AC-22 | Verified at 300 users, 27 Oct 2026 (CI run #8) |
| AC-26 | Verified 26 Oct 2026 by automated audit (all 7 screens, 390 and 1440 px, keyboard-only booking) |
| AC-28 | Verified 27 Oct 2026 (CI run #8 and live list) |
| NFR-1 to NFR-6, NFR-8 to NFR-10 | As recorded in requirements |
| NFR-7 | Partly verified: 0 axe violations on 26 Oct 2026; no screen-reader pass |

## Checks run on 26 Oct 2026 (cloud workspace)

Lint clean · typecheck clean · unit 31/31 · web 48/48 (10 consecutive runs) · build OK · UI audit (Playwright + axe) clean. **Not run:** API integration tests (no MongoDB available), concurrency demo.

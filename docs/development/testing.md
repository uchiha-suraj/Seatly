# Testing

> **Authority:** test layers, commands, what each suite proves, and CI. Requirement-to-test mapping lives in [requirements.md](../product/requirements.md).
> **Status:** verified 26 Oct 2026 (unit and web suites run in the cloud workspace; the API integration suite needs MongoDB and was last run on 2 Oct 2026, see below).

## Layers

| Layer | Command | Needs | Proves |
| --- | --- | --- | --- |
| Shared schemas | `npm run test:unit` | nothing | Seat ID, email, password and UUID rules; strict bodies reject unknown fields such as `userId` |
| API units | `npm run test:unit` | nothing | Token hashing, error mapping, config parsing including the production safety rules |
| API integration | `npm run test:api` | MongoDB **replica set** (`npm run db:up`) | Every endpoint through real HTTP and a real database: auth, events, bookings and ownership, idempotency, injected MongoDB faults, a 50-user race, event lifecycle |
| Web | `npm run test:web` | nothing (MSW fake API, jsdom) | Seat-map keyboard navigation and names, all booking-panel states, same-key retries, login intent and `returnTo`, live polling, closed events |
| Concurrency demo | `npm run demo:concurrency` | built app, two processes, `DEMO_MODE=true` | AC-22 and AC-23 at 300 users ([README](../../README.md#concurrency-demonstration)) |
| Idempotency demo | `npm run demo:idempotency` | same | Replay, payload conflict, 20 simultaneous same-key requests |
| UI audit (manual script) | not in the repo | built web app, Playwright, axe-core | AC-26 and NFR-7 at 390 and 1440 px (run 26 Oct 2026, results below) |

`npm test` runs unit, API integration and web in that order.

## Rules that keep the integration suite honest

- It **refuses to run** without a replica set and says why; transactions would otherwise be untested.
- Each Vitest worker gets its own database (`seatly_test_<worker>`), so files run in parallel without sharing data.
- After every test, `expectInvariantHolds()` (`apps/api/test/helpers/app.ts`) scans the database: a seat is booked **if and only if** exactly one booking points to it. Any test that breaks the guarantee fails, even if it was testing something else.
- Faults are injected two ways: MongoDB `failCommand` fail points (transient errors, unknown commit result, primary step-down) and the service's fault points (`afterKeyClaimed`, `afterSeatClaimed`, `beforeKeyCompleted`, `beforeCommit`, `afterCommit`). Fault points are refused outside `NODE_ENV=test`.
- Seeded data pre-books some seats, so queries about a test's seat **must filter by event** as well as seat ID. (Five CI failures on 2 Oct came from forgetting this.)
- The unknown-commit test uses error code 50 (`MaxTimeMSExpired`); code 91 makes the driver rediscover the primary, which can exceed the 4 s deadline on slow CI runners. A separate test covers code 91 on its own seat.

## Latest results

| Suite | Result | Where and when |
| --- | --- | --- |
| Unit (shared + API) | 31/31 pass | Cloud workspace, 26 Oct 2026 |
| Web | 48/48 pass, 10 consecutive runs | Cloud workspace, 26 Oct 2026 |
| Lint, typecheck, build | Clean | Cloud workspace, 26 Oct 2026 |
| API integration | 46/46 pass | Suraj's machine, 2 Oct 2026, and CI runs #6–#7. **The V1.1 file `event-lifecycle.test.ts` has not run yet**: no MongoDB in the cloud workspace. It runs in CI on the next push. |
| Concurrency demo, 100 users | 1 × 201, 99 × 409, 1 booking stored | Suraj's machine, 2 Oct 2026 |
| Concurrency demo, 300 users | **Pending**: now a CI step; first result on the next push | — |
| UI audit | 7 screens × 2 widths: no horizontal overflow, 0 axe violations (WCAG 2.2 A/AA rules), seats 44 px mobile / 40 px desktop, keyboard-only booking completed | Cloud workspace against a mock API, 26 Oct 2026 |

Not tested automatically: a real screen reader, a real multi-node failover, the live site under load.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. Start MongoDB 8 as a one-node replica set (`docker compose up -d --wait mongo`).
2. `npm ci`, lint, typecheck.
3. `npm test` (all three layers).
4. `npm run build`.
5. Seed, start two API processes in production mode, run the concurrency demo with **300 users** across both, then the idempotency demo. The step fails unless there is exactly one success and one stored booking.
6. Upload `demo-results/` as a build artifact.

A red CI means the change is not done. Do not merge or deploy around it.

## Writing a new test

- Booking or idempotency behaviour → integration test; use `newUser`, `postBooking` and `eventId` from the helpers, and let the invariant check run.
- A pure function → unit test next to its layer.
- A UI state → web test with MSW; add a handler or a `db` flag in `apps/web/test/msw.ts` rather than mocking hooks.
- Prefer accessible queries (`getByRole`, names such as `Row A, seat 5, available`) over test IDs.

# Requirements and scope

> **Authority:** what Seatly must do (acceptance criteria), what is in and out of scope, and the roadmap. This replaces the Stage 1 Claude Doc, which is now historical (decision, 25 Oct 2026).
> **Status:** V1 approved and shipped. Requirement text carried over unchanged from Stage 1 unless an *Amended* note says otherwise. Verification status as of 26 Oct 2026.

## How to read this

- **IDs are stable.** `AC-n` are functional acceptance criteria from Stage 1; new ones continue the sequence (AC-27 onwards). `NFR-n` are non-functional requirements. An ID is never reused; a dropped requirement is marked *Withdrawn*.
- **Method:** **T** = automated test, **D** = demo script, **M** = manual check at 390 px and 1440 px.
- **Status:** **Verified** (with date and evidence), **Partly verified** (what is missing is stated), **Not verified**.
- Test paths are relative to the repo root. Search a test file for the ID (for example `AC-17`) to find the exact case.

## V1 scope

| Area | In V1 | Out of V1 |
| --- | --- | --- |
| Auth | Register (name, email, password), log in, log out, protected pages, argon2id password hashing, session in an HttpOnly cookie | Social login, password reset, email verification, roles or admin, "remember me", two-factor auth, account deletion |
| Events | Seeded events (7, including a one-seat demo event); list page (upcoming events only, since V1.1); details page with image, description, date and time, venue, seat counts; numbered seat grid (up to rows A–F × 1–10) | Event creation or editing UI, organizer dashboard, search, filters, categories, pricing tiers, maps |
| Booking | One seat per booking; selected-seat display; immediate confirmation; conflict message with availability refresh; idempotent submit with same-key retries; live seat map refresh while viewing | Payments, seat holds, multi-seat booking, cancellation, waitlists, QR tickets, email or SMS |
| My bookings | Own bookings, newest first; booking details; owner-only access | Edit, transfer, refund, export, add to calendar |
| Demo and operations | Idempotent seed; concurrency demo; idempotency demo; replica-set Docker Compose; CI; one Render service with MongoDB Atlas | Public load-test button, Redis, queues, microservices, admin analytics, monitoring and alerting |

**Seat model:** every seat in an event has one price and one type. Seat IDs are a row letter and number (`A7`), unique within an event.

**Availability on screen is advisory.** The booking API decides; the seat map only shows a recent snapshot ([AC-27](#booking)).

## Functional requirements

### Auth

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-1 | Register with valid name, email, password creates a user; password is stored only as a hash. | T | Verified 2 Oct 2026 | `apps/api/test/integration/auth.test.ts` |
| AC-2 | Registering an existing email returns 409 and the form shows "Email already registered". | T | Verified 2 Oct 2026 | `auth.test.ts` |
| AC-3 | Invalid input (empty name, bad email, password < 8 chars) returns 400 with per-field errors, shown inline. | T | Verified 2 Oct 2026 | `auth.test.ts`, `packages/shared/test/schemas.test.ts` |
| AC-4 | Wrong email or password returns 401 with one generic message (no hint which field was wrong). | T | Verified 2 Oct 2026 | `auth.test.ts` |
| AC-5 | Logout clears the session; a following call to a protected endpoint returns 401. | T | Verified 2 Oct 2026 | `auth.test.ts` |
| AC-6 | Visiting `/bookings` while logged out redirects to `/login?returnTo=/bookings` and returns there after login. | T | Verified 2 Oct 2026 | `apps/web/test/booking.test.tsx` |

### Events

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-7 | Running the seed script twice yields the same events and seats, with no duplicates. | T | Verified 2 Oct 2026 | `apps/api/test/integration/events.test.ts` |
| AC-8 | Event list and detail pages load without login and show title, image, description, date/time, venue and available/total seats. | M (+T for the API) | Verified 2 Oct 2026 (API by test; pages checked manually and on the live site) | `events.test.ts` |
| AC-9 | An invalid or unknown event ID returns 404; the UI shows the not-found page. | T | Verified 2 Oct 2026 | `events.test.ts` |

### Booking

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-10 | A logged-in user booking an available seat gets 201 with booking reference, event, seat and booked-at time. | T | Verified 2 Oct 2026 | `apps/api/test/integration/bookings.test.ts`, `booking.test.tsx` |
| AC-11 | Booking an already-booked seat returns 409 `SEAT_TAKEN`; the UI shows the conflict alert, refetches availability and clears the selection. | T | Verified 2 Oct 2026 | `bookings.test.ts`, `booking.test.tsx` |
| AC-12 | A seat ID that does not exist on that event returns 400/404; no seat or booking changes. | T | Verified 2 Oct 2026 (malformed ID → 400, unknown seat → 404) | `bookings.test.ts` |
| AC-13 | The booking request never accepts a user ID; the booking is always attributed to the session user. | T | Verified 2 Oct 2026 | `bookings.test.ts`, `schemas.test.ts` |
| AC-14 | A logged-out user pressing Confirm is sent to login and returns to the event; availability is refetched and the seat is re-selected only if it is still available (otherwise an info message explains it was taken). The seat is never held. | T | Verified 2 Oct 2026 | `booking.test.tsx` |
| AC-15 | A 401 during booking (expired session) shows the session-expired message, routes to login, and returns to the event with the same refetch-then-restore-if-available behaviour as AC-14. | T | Verified 2 Oct 2026 | `booking.test.tsx` |
| AC-16 | Two different seats in one event can be booked by different users independently. | T | Verified 2 Oct 2026 | `bookings.test.ts` |
| AC-28 | **New, approved 26 Oct 2026 (Q8).** Booking closes when an event starts: the event list shows only events that have not started; a started event's page shows "Booking has closed" with the seat map locked; `POST /api/bookings` returns 409 `BOOKING_CLOSED`, stored and replayed like other final outcomes, with no seat or booking change. | T | **Verified 27 Oct 2026**: API integration 53/53 and web 48/48 in CI run #8, commit `4f4d817`, 27 Oct 2026; live list checked the same day | `apps/api/test/integration/event-lifecycle.test.ts`, `apps/web/test/lifecycle.test.tsx` |
| AC-27 | **New, approved 2 Oct 2026.** While the event page is visible, the seat map refreshes at least every 10 s and when the window regains focus; it does not poll in a hidden tab or while a booking request is in flight. If a refresh shows the selected seat was booked by someone else, the selection is cleared and a notice says so without moving keyboard focus. | T, M | Verified 2 Oct 2026 (tests; two-window check on the live site by Suraj) | `apps/web/test/polling.test.tsx` |

*Amended 2 Oct 2026:* Stage 1 said the seat map refreshes only on load, on window focus and after a booking attempt. AC-27 adds timed refresh; the rule that availability on screen is advisory is unchanged. Decision record: [ADR-0010](../adr/0010-seat-map-polling.md).

### Idempotency

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-17 | Repeating a successful request with the same key and payload returns the original booking (same ID) and one booking exists. | T | Verified 2 Oct 2026 | `apps/api/test/integration/idempotency.test.ts` |
| AC-18 | Reusing a key with a different seat returns 422 `IDEMPOTENCY_KEY_REUSED`. | T | Verified 2 Oct 2026 | `idempotency.test.ts` |
| AC-19 | 20 concurrent requests with the same user, key and payload produce exactly one booking. Every response is either 201 for booking B (original or `Idempotent-Replayed`) or 409 `IDEMPOTENCY_IN_PROGRESS` with `Retry-After`; none is 409 `SEAT_TAKEN`, 422 or 5xx. After all settle, one more same-key request returns 201 for B with `Idempotent-Replayed: true`, and exactly one completed key record exists. | T, D | Verified 2 Oct 2026 | `idempotency.test.ts`; idempotency demo |
| AC-19b | While a same-key request is held in progress, a second request gets 409 `IDEMPOTENCY_IN_PROGRESS` + `Retry-After: 1`; after release, its retry gets the replay. | T | Verified 2 Oct 2026 | `idempotency.test.ts`, `booking.test.tsx` |
| AC-20 | On a simulated client timeout, the frontend retries with the same key. | T | Verified 2 Oct 2026 | `booking.test.tsx` |

### Consistency

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-21 | If the transaction is forced to fail after the seat claim, the seat stays available and no booking or idempotency success is stored. | T | Verified 2 Oct 2026 | `apps/api/test/integration/transaction-failures.test.ts` |
| AC-22 | Concurrency demo: N (≥ 200) distinct users, distinct keys, one fresh seat → exactly 1 success, N−1 `SEAT_TAKEN`, 0 unexpected failures, and a DB query shows exactly 1 booking for that seat. Exact counts are reported, not estimated. | D (+T at 50 users) | **Verified 27 Oct 2026 at 300 users** (CI run #8, commit `4f4d817`, 27 Oct 2026): 1 × 201, 299 × 409 `SEAT_TAKEN`, 0 × 503, 0 unexpected, 1 booking stored, seat `booked`; two API processes; p50 817 ms, p95 901 ms, wall 938 ms (CI runner, not capacity). Earlier: 100 users on 2 Oct 2026. Re-checked on every push. | `concurrency.test.ts`; CI artifact `demo-results`; `demo-results/concurrency-2026-10-02T14-01-40-738Z.json` |
| AC-23 | The demo works with 2 API processes behind the same database. | D | Verified 2 Oct 2026 (50/50 split across two processes) | Same demo report |

### My bookings and access

| ID | Requirement | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC-24 | My bookings lists only the session user's bookings, newest first. | T | Verified 2 Oct 2026 | `bookings.test.ts` |
| AC-25 | Requesting another user's booking ID returns 404. | T | Verified 2 Oct 2026 | `bookings.test.ts` |
| AC-26 | All seven screens work at 390 px and 1440 px with no horizontal page scroll; seat targets ≥ 44 px on mobile; keyboard-only booking is possible. | M (+ automated audit) | **Verified 26 Oct 2026** by a Playwright audit against the built app with a mock API: all 7 screens at both widths had no horizontal overflow; seats measured 44 px (mobile) and 40 px (desktop); a keyboard-only booking completed (Tab to the grid, arrows, Enter, Book) with focus landing on "You're booked". Main screens were also compared with Figma on 2 Oct 2026. | [testing.md](../development/testing.md#latest-results); `docs/screenshots/` |

## Non-functional requirements

"Configured" means the value is set in code or configuration and enforced by it; it is not a measured performance result.

| ID | Requirement | Status | Source |
| --- | --- | --- | --- |
| NFR-1 | Correctness holds with any number of API processes against one database (no in-memory locks). | Verified 2 Oct 2026 with 2 processes (AC-23) | Booking service design |
| NFR-2 | A booking request finishes server-side within a 4 s deadline: success, a final answer, or a retryable 503. | Configured (`BOOKING_DEADLINE_MS=4000`) | `apps/api/src/config.ts` |
| NFR-3 | The client waits up to 10 s per booking request, retries twice (+1 s, +3 s, plus 0–250 ms jitter) with the same key, and polls `IN_PROGRESS` up to 5 times. | Configured; behaviour tested (AC-19b, AC-20) | `apps/web/src/api/endpoints.ts`, `apps/web/src/lib/retry.ts` |
| NFR-4 | Sessions end after 120 min idle or 7 days, whichever comes first. | Configured; idle expiry tested | `config.ts`, `auth.test.ts` |
| NFR-5 | Idempotency keys are kept for 24 h; an in-progress lease lasts 15 s. | Configured | `config.ts` |
| NFR-6 | Login and register are limited to 10 requests per minute per client IP in production. | Configured | `apps/api/src/modules/auth/routes.ts` |
| NFR-7 | Text and controls meet WCAG 2.2 AA contrast; seat state is shown by colour, icon and accessible name. | Partly verified: axe-core found 0 WCAG 2.2 A/AA violations on all 7 screens at both widths, 26 Oct 2026 (after renaming seats to "Row A, seat 5, …" for WCAG 2.5.3). No screen-reader pass | Figma Stage 2 review; [testing.md](../development/testing.md#latest-results) |
| NFR-8 | The production server refuses to start without `APP_ORIGIN` or with insecure cookies. | Verified by unit test | `apps/api/test/unit/errors-config.test.ts` |
| NFR-9 | Seat snapshots, bookings and the current-user response are never cached by browsers or proxies (`Cache-Control: no-store`). The event list (which shows seat counts) has no such header. | Partly verified: seat snapshot by test; booking and `/api/auth/me` routes set the header in code | `events.test.ts`; `apps/api/src/modules/*/routes.ts` |
| NFR-10 | First response after the free Render instance sleeps can take about 50 s. | **Accepted limitation**, observed 2 and 25 Oct 2026 | Render free plan |

**Not set as requirements in V1:** throughput, latency targets under load, uptime, recovery time and recovery point. V1 runs on free tiers with no monitoring. These belong in V2 if the product needs them.

## Known gaps against these requirements

| ID | Gap | Planned action |
| --- | --- | --- |
| NFR-7 | No screen-reader pass | V2 ([known issues](../known-issues.md) KI-5) |
| — | No account deletion or privacy notice; registered emails and names are stored | Documented as current state (decision 25 Oct 2026); revisit in V2 |
| — | No database backups confirmed; recovery is re-seeding | Accepted for V1 (decision 25 Oct 2026); revisit in V2 |

Closed on 26–27 Oct 2026: AC-22 at 300 users, AC-26 (automated audit), and the past-events gap (AC-28, decision Q8).

## Roadmap

### V1: done

Shipped 2 Oct 2026: everything in [V1 scope](#v1-scope), plus the live seat map (AC-27). V1.1 (26 Oct 2026, [CHANGELOG](../../CHANGELOG.md)) closes the remaining V1 gaps: booking closes at start with rolling demo dates (AC-28), accessible seat names, the login `returnTo` fix, the 300-user demo in CI, and these docs. **V1 is complete** (27 Oct 2026): V1.1 passed CI and is live ([status](../status.md)).

### V2: to be defined

Suraj confirmed that V2 is wanted (25 Oct 2026); its scope is **not yet decided**. The candidates below come from V1's exclusions and gaps. None is approved, and none has an ID yet; IDs are assigned once a candidate is accepted.

| Candidate | Why | Size (rough) | Depends on |
| --- | --- | --- | --- |
| **Account deletion and privacy page** | Real people can register; no way to delete today | Small | Decide what happens to bookings of a deleted user |
| **Backups and monitoring:** scheduled export or paid backups, uptime alerts, error tracking | No backups, no alerts in V1 | Small–medium | Hosting budget |
| **Password reset and email verification** | Standard expectation for real accounts | Medium | An email provider |
| **Booking cancellation** | Natural next step; tests the invariant in reverse (booked → available) | Medium | — |
| **Multi-seat booking** (book several seats in one request, all or nothing) | Common real need; a stronger concurrency showcase | Medium–large | — |
| **Organizer tools:** create and edit events and seat layouts | Removes the seed-only limitation | Large | Roles and permissions |
| **Seat holds:** reserve a seat for a few minutes while checking out | Needed before payments | Large | Expiry jobs |
| **Payments** | Turns the demo into a real product | Large | Holds, a payment provider, a business model |
| **Push updates** (server-sent events instead of polling) | Instant seat changes | Medium | Hosting that keeps connections open |

The next step is choosing a V2 theme (open question Q7 in the [documentation index](../index.md#open-questions)).

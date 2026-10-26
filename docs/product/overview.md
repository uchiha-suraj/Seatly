# Product overview

> **Authority:** why Seatly exists, who it serves and how success is judged. Requirements live in [requirements.md](requirements.md); rules and flows in [rules-and-flows.md](rules-and-flows.md).
> **Status:** V1 approved and shipped (2 Oct 2026); V1.1 close-out built 26 Oct 2026. This document: draft, 26 Oct 2026.

## The problem

Seat booking looks simple: check whether a seat is free, then mark it booked. Done as two separate steps, it breaks the moment two people try at once. Both see "free", both write "booked", and the venue has sold one seat twice.

A slow or dropped network connection causes a second failure. The person presses **Book**, sees no answer, and presses again. Unless the server can recognise the repeat, it books twice, or books a second seat.

Seatly exists to show both problems solved properly, in a small product that is easy to read end to end.

## The claim V1 proves

1. **The database decides who gets a seat**, not the browser and not an in-memory lock, so it stays correct with any number of server processes.
2. **A seat claim, its booking record and the request's stored result are saved together or not at all.** A seat is never left booked without a booking.
3. **Repeating a request returns the original result** instead of creating a new booking.
4. **The interface tells the truth:** who won the seat, that a request is still being checked, that a session expired, or that the seat was taken while you were choosing.

## Users

| User | What they want | Where they are served |
| --- | --- | --- |
| **Attendee** (primary) | A specific seat at a specific event, with a clear yes or no. May be on a phone, may lose signal mid-booking, may lose the race for a seat. | The web app |
| **Technical reviewer** (secondary): a hiring manager, interviewer or developer reading the code | Evidence that the guarantees are real: tests, a repeatable concurrency demo, readable code and docs | README, `docs/`, demo scripts, CI |
| **Owner/operator** (Suraj) | To run, change and explain the system with confidence | `docs/`, runbooks, `CLAUDE.md` |

There are no organizer, admin or staff roles in V1. Events are created by a seed script.

## Value

- **For attendees:** booking that never double-sells and never charges you for a seat twice by accident (V1 has no payments, but the guarantee is the same).
- **For reviewers:** a compact, honest demonstration of concurrency control, transactions and idempotency, with measured results rather than claims.

## Business model

None. Seatly is a non-commercial portfolio project released under the [MIT licence](../../LICENSE). It has no payments, ads or paid tiers, and runs on free hosting tiers (Render and MongoDB Atlas). Any future business model would be a V2+ decision.

## How success is judged

V1 has no product analytics, by decision: there is no tracking script, cookie banner or analytics database. Success is judged by checks that can be repeated:

| Measure | Target | Latest result |
| --- | --- | --- |
| Concurrency demo: N users race for one seat | Exactly 1 success, N−1 `SEAT_TAKEN`, 0 unexpected, 1 booking stored (AC-22, N ≥ 200) | 300 users, 27 Oct 2026 (CI): 1 success, 299 `SEAT_TAKEN`, 0 unexpected, 1 booking stored. Met. |
| Same-key retries | Never more than one booking per key (AC-17 to AC-20) | Idempotency demo 7/7 checks, 2 Oct 2026 |
| Automated tests | All pass in CI on every push to `main` | Green since CI run #6 (2 Oct 2026) |
| Design fidelity | Screens match the Figma file at 390 and 1440 px (AC-26) | Main screens compared with Figma 2 Oct 2026; all 7 screens passed the automated layout, accessibility and keyboard audit 26 Oct 2026 |
| Reviewer can run it | Clone, start the database, seed, run the demo, using the README only | Done by Suraj on Windows, 2 Oct 2026 |

If V2 adds real users, it should define product metrics and decide whether analytics are worth the privacy cost. See the V2 roadmap in [requirements.md](requirements.md#roadmap).

## Related documents

- [Requirements and scope](requirements.md)
- [Rules, roles and flows](rules-and-flows.md)
- [UI specification](../design/ui-spec.md)
- [Figma: Seatly V1](https://www.figma.com/design/idjCTBnahtTeUNDxIVyHKa)

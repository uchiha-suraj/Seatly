# Changelog

All notable changes to Seatly. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are product versions, not npm versions.

## [1.1.0] — 27 Oct 2026 (V1 close-out)

### Added
- Booking closes when an event starts: started events are hidden from the list, their page shows "Booking has closed", and `POST /api/bookings` returns 409 `BOOKING_CLOSED` (final, replayed on retry). New field `bookingOpen` on event summaries (AC-28, [ADR-0012](docs/adr/0012-booking-closes-at-start.md)).
- Rolling demo dates (`DEMO_ROLLING_DATES`, live demo only): seeded events that have started move forward in 49-day steps at startup and hourly; `npm run seed` does the same.
- CI runs the concurrency demo with 300 users across two API processes (AC-22).
- Documentation set under `docs/` (product, design, architecture, 12 ADRs, security, development, features, operations), `CLAUDE.md`, MIT `LICENSE`.

### Changed
- Seat accessible names now read "Row A, seat 5, available" so they contain the visible labels (WCAG 2.5.3).

### Fixed
- Logging in from a link with `returnTo` could land on the home page instead: the guest-only guard redirected before the login page did.
- Flaky web test for hidden-tab polling.
- README: invalid input returns 400 `VALIDATION_ERROR`, not 422.

### Operations
- Live deploy needed the Atlas `0.0.0.0/0` access-list entry re-added as permanent (it had expired).

### Data
- No schema migration. `bookingOpen` is computed, not stored. Moving event dates changes `startsAt`/`endsAt` of seeded events only.

## [1.0.0] — 2 Oct 2026

First public release, live at https://seatly-02yb.onrender.com.

### Added
- Register, log in, log out with server-side cookie sessions (argon2id, hashed tokens, idle and absolute expiry, auth rate limit).
- Event list and details; keyboard-accessible seat map.
- Booking with an atomic conditional seat claim, a unique index and one transaction; per-user idempotency keys with fingerprint, lease and fencing; client retries with the same key; resume after reload.
- My bookings and booking details, owner-only.
- Live seat map: refresh every 10 s while visible and on focus; "seat just booked" notice (AC-27).
- Concurrency and idempotency demos; CI with a MongoDB replica set; Render Blueprint with MongoDB Atlas.

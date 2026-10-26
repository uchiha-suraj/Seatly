# Personal data

> **Authority:** what personal data Seatly holds, where, for how long, and how it can be accessed or deleted.
> **Status:** documents the **current V1 state** as decided on 25 Oct 2026 ("document the current situation now; improve in V2"). It describes practice; it is not a legal privacy notice.

## Summary

Anyone can register on the public demo. Seatly then stores their name, email address, a password hash and their bookings, indefinitely. There is no privacy page, no in-app way to export or delete an account, and no analytics or tracking. Deleting someone's data is a manual database task.

## Inventory

| Data | Collection | Source | Purpose | Kept for |
| --- | --- | --- | --- | --- |
| Name | `users.name` | Registration form | Shown in the header and on bookings | Indefinitely |
| Email address | `users.email` | Registration form | Login identifier; shown on bookings | Indefinitely |
| Password | `users.passwordHash` (argon2id hash only) | Registration form | Login | Indefinitely |
| Session token | `sessions.tokenHash` (SHA-256 only); cookie in the browser | Login | Keep the user signed in | Up to 7 days; removed automatically |
| Bookings | `bookings` (user ID, event, seat, time, reference) | Booking | The product | Indefinitely |
| Booking request records | `idempotencyKeys` (user ID, key, stored response, which includes the name and email) | Booking | Safe retries | 24 hours; removed automatically |
| Request logs | Render's log stream (pino JSON: method, path, status, request ID, IP address) | Every request | Debugging | Per Render's log retention (not configured by Seatly) |
| Browser storage | `sessionStorage`: pending booking attempt (event, seat, key) | Booking | Resume after reload | Until the tab closes or the attempt ends |

Not collected: phone numbers, addresses, payment details, analytics or tracking identifiers, cookies other than the session cookie.

## Where it is processed

| Processor | What it receives | Region |
| --- | --- | --- |
| MongoDB Atlas | All stored data above | Cluster region chosen at creation (Suraj's free cluster) |
| Render | Requests and logs passing through the web service | Singapore |
| GitHub | No user data (code and CI only; CI uses throwaway test data) | — |

## Access

- **Users** see their own name, email and bookings in the app.
- **The operator** (Suraj) can read everything through the Atlas console and Render logs.
- Nobody else has access. There are no admin screens.

## Requests from users

| Request | V1 procedure |
| --- | --- |
| "Show me my data" | Operator queries `users`, `bookings` and `sessions` by email in Atlas and sends the result |
| "Delete my account" | Operator, in Atlas: delete the user's `sessions` and `idempotencyKeys`; delete their `bookings` and set each seat back to `available` with `bookingId: null, bookedAt: null` **in one transaction or in that order with care**; then delete the user. Record it in the operations log. |

Deleting bookings by hand frees seats, which the product otherwise never does. Do it carefully, then run the invariant check described in [runbooks.md](../operations/runbooks.md#check-the-booking-invariant).

## Known gaps (V2)

Privacy page, self-service account deletion, defined retention for inactive accounts and old bookings, log retention settings, and confirming the Atlas cluster's region in this document. Tracked in [requirements](../product/requirements.md#known-gaps-against-these-requirements).

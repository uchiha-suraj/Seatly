# UI specification

> **Authority:** how the interface behaves: routes, navigation, screen states, forms, responsive layout and accessibility. **Visual design** (colours, type, spacing, layouts) is defined in [Figma: Seatly V1](https://www.figma.com/design/idjCTBnahtTeUNDxIVyHKa); the code mirrors its variables in [`apps/web/src/styles.css`](../../apps/web/src/styles.css).
> **Status:** describes **verified V1 behaviour** as of 26 Oct 2026 (code, web tests, and the Figma comparison of 2 Oct 2026). Rules and journeys: [rules-and-flows.md](../product/rules-and-flows.md).

## Routes and access

| Route | Screen | Access | Notes |
| --- | --- | --- | --- |
| `/` | Event list | Public | Shows "You're logged out" once after logout |
| `/events/:eventId` | Event details and seat selection | Public; booking needs login | `?seat=A7` carries the selected seat (survives reload and login) |
| `/login?returnTo=&reason=` | Log in | Guests only (signed-in users go to a safe `returnTo`, otherwise `/`) | `reason=expired` shows the session-expired banner; `returnTo` must be a local path, otherwise ignored |
| `/register?returnTo=` | Create account | Guests only | Same `returnTo` handling |
| `/bookings` | My bookings | Signed in; guests go to `/login?returnTo=/bookings` | |
| `/bookings/:bookingId` | Booking details or confirmation | Signed in; other users' bookings show not-found | "You're booked" heading only straight after booking |
| `*` | Not found | Public | Link home |

Source: [`apps/web/src/app/routes.tsx`](../../apps/web/src/app/routes.tsx), guards in `features/auth/guards.tsx`, `returnTo` checks in `lib/returnTo.ts`.

## Navigation

| Width | Signed out | Signed in |
| --- | --- | --- |
| ≥ 640 px | Logo, **Events** · **Log in**, **Create account** | Logo, **Events**, **My bookings** · user name, **Log out** |
| < 640 px | Logo · **Log in** | Logo · **Bookings**, **Log out** |

The current page's link carries `aria-current="page"` and has no visual underline (matches Figma; changed 2 Oct 2026). A "Skip to content" link is the first focusable element. The header sticks to the top.

## Screens and states

Every data screen has loading, empty (where a list can be empty), error-with-retry and success states.

| Screen | States | Messages |
| --- | --- | --- |
| Event list | Loading skeleton cards · empty · error + **Try again** · list · logged-out notice | Only events that have not started (V1.1). Empty: "No upcoming events". Error: "We couldn't load events". Cards show date, title, venue and a seat badge: "42 of 60 seats left", warning colour at ≤ 5, "Sold out" at 0 (singular "1 of 1 seat left") |
| Event details | Loading · error + **Try again** · not-found for a bad ID · content (details, seat map, booking panel) | Error: "We couldn't load this event". Seat count line: "42 of 60 seats available · updated 8 s ago" ("refreshing…" only for a manual refresh) |
| Log in / Create account | Form · field errors · submitting · top-level error · session-expired banner · context line | Context: "Log in to book seat A7 at …" or "Log in to see your bookings." Errors: "Email or password is incorrect", "An account with this email already exists" (with a log-in link), "Too many attempts", generic server failure |
| Booking details | Loading · just booked ("You're booked") · revisited · not-found · error | Reference with **Copy** ("Reference copied" announced). Error: "We couldn't load this booking." |
| My bookings | Loading skeleton rows · empty · error + **Try again** · list | Empty: "No bookings yet". Error: "We couldn't load your bookings" |
| Not found | Static | "We couldn't find that page" |

### Booking panel

The panel on the event page is a sticky card on the right at ≥ 1024 px and a bottom sheet below that. It has 15 states: Figma's 12 variants plus *loading*, *liveTaken* (AC-27) and *closed* (AC-28, V1.1). Source: [`features/booking/BookingPanel.tsx`](../../apps/web/src/features/booking/BookingPanel.tsx).

| State | When | Shows | Actions | Focus |
| --- | --- | --- | --- | --- |
| loading | Event, seats or session loading | Skeleton | — | — |
| noSeat | Nothing selected | "No seat selected" | Disabled **Select a seat to continue** | — |
| selected | Seat chosen, signed in | Seat, "Selecting a seat doesn't hold it…" | **Book seat A7**, **Clear selection** | — |
| loggedOut | Seat chosen, signed out | Same note | **Log in to book A7**, **New here? Create an account** | — |
| submitting | Request sent | Spinner on the button; seat map locked | — | Announced: "Booking seat A7…" |
| retrying | Timeout, network error, 5xx or in progress | "Still checking your booking…" (same request, cannot double-book) | — | Announced |
| retryFailed | Retries used up | "We couldn't confirm your booking" | **Check My bookings**, **Try again** | Moves to alert |
| conflict | 409 `SEAT_TAKEN` | "Seat A7 was just taken"; map refreshed | Pick another seat | Moves to alert |
| sessionExpired | 401 at Book | "Your session expired" | **Log in again** | Moves to alert |
| backFree | Returned from login, seat still free | "Seat A7 is still available" | **Book seat A7**, **Clear selection** | — |
| backTaken | Returned from login, seat taken | "Seat A7 is no longer available" | Pick another seat | Moves to alert |
| liveTaken | A background refresh found the selected seat booked | "Seat A7 was just booked" | Pick another seat | **Not moved** (polite status) |
| soldOut | No seats left | "Sold out" | Disabled **Sold out**, **Browse other events** | — |
| closed | Event has started (`bookingOpen: false`) or a booking answer was 409 `BOOKING_CLOSED` | "Booking has closed" / "This event has already started, so seats can no longer be booked."; seat map locked; no seat summary | **Browse upcoming events** | Moves to alert when it replaces another state |
| error | Other 4xx | "That booking didn't go through" + server message | Pick a seat again | Moves to alert |

### Seat map

- Grid of rows (A–F in the seed) × seats (up to 10), with an aisle after the middle seat and a "STAGE" bar on top. Row letters appear on both sides. On phones, the left labels stay pinned while the grid scrolls sideways, and the selected seat is scrolled into view without scrolling the page.
- Seat states use colour, an icon and an accessible name together: available (outlined), your selection (filled brand colour, tick), booked (grey, cross). Names read "Row A, seat 7, available", "…, selected" or "…, booked", so they contain the visible row and seat labels (WCAG 2.5.3; changed 26 Oct 2026 from "Seat A7, …").
- Booked seats can be focused but not selected. The whole map is locked while a booking request is in flight and when booking has closed.
- Refreshes every 10 s while visible, on window focus, after every booking answer, and on **Refresh** (AC-27). Source: `features/events/SeatMap.tsx`, `useSeatPolling.ts`.

## Forms and validation

Rules come from the shared schemas ([`packages/shared/src/schemas.ts`](../../packages/shared/src/schemas.ts)), so the browser and the API reject exactly the same input with the same messages.

| Field | Rule | Message |
| --- | --- | --- |
| Name | 1–80 characters after trimming | "Enter your name." / "Use 80 characters or fewer." |
| Email | Valid address; trimmed, lower-cased | "Enter a valid email address, like name@example.com." |
| Password (register) | 8–72 characters | "Use at least 8 characters." / "Use 72 characters or fewer." |
| Password (log in) | Not empty | "Enter your password." |

Errors show under each field after submit; focus moves to the first invalid field. Server field errors (400 `VALIDATION_ERROR`) display the same way. The password field has a show/hide toggle.

## Responsive layout

| Width | Layout |
| --- | --- |
| 390 px (design target for phones) | Single column; booking panel as a bottom sheet; seat map scrolls sideways; short date format ("Sat, 14 Nov 2026 · 7:30 – 10:00 PM") |
| ≥ 640 px | Full header navigation; wider spacing |
| ≥ 1024 px (design target 1440 px) | Two columns: event content left, sticky booking panel right; full date format |

AC-26 requires no horizontal page scroll at 390 px and 1440 px. The 2 Oct check found and fixed a 416 px overflow on phones; see [requirements](../product/requirements.md) for the screens not yet re-checked.

## Design system

- **Tokens:** colours, radii and shadows are CSS variables in `apps/web/src/styles.css`, named after the Figma collection "Seatly tokens". Fonts: Inter (text) and JetBrains Mono (references), bundled through Fontsource.
- **Components:** `Button` (primary, secondary, ghost; loading state), `TextInput`, `Alert` (info, success, warning, error), `Badge`, `Skeleton`, `Icon` in `apps/web/src/components/ui/`. Lucide icon paths; credits in [`CREDITS.md`](../../CREDITS.md).
- **Images:** generated event artwork in `apps/web/public/images/events/` (WebP, 2:1).
- **Screenshots** of the built UI: [`docs/screenshots/`](../screenshots/).

## Accessibility

Target: WCAG 2.2 AA (NFR-7).

- Visible focus ring on every interactive element (2 px brand outline).
- Keyboard seat map: one tab stop for the grid; arrow keys move between seats, Home/End jump to the row ends, Enter/Space selects.
- Seat targets are 44 × 44 px below 640 px and 40 × 40 px from 640 px up.
- Errors needing attention use `role="alert"` and receive focus; progress and background updates use polite live regions and keep focus where it is.
- Contrast: the booked-seat text colour was darkened to 5.27:1 during the Figma review.
- **Automated audit, 26 Oct 2026:** axe-core found 0 WCAG 2.2 A/AA violations on all 7 screens at 390 and 1440 px; keyboard-only booking completed ([testing.md](../development/testing.md#latest-results)).
- **Not verified:** a screen-reader pass (V2; see [requirements gaps](../product/requirements.md#known-gaps-against-these-requirements)).

## Localization

English only. Dates use day-month order ("14 November 2026") with 12-hour times. Event times show in the event's time zone; "Booked on" shows the viewer's local time with its zone name (for example "IST"). Source: `apps/web/src/lib/format.ts`.

## Design deviations

None open. Resolved on 2 Oct 2026: the header underline was removed, the mobile header overflow and pinned seat labels were fixed, and the booked-seat strikethrough was removed. Two additions were approved: the *liveTaken* panel state (AC-27) and the *closed* state (AC-28, 26 Oct 2026). Neither has a Figma frame yet; adding them is a small V2 design task.

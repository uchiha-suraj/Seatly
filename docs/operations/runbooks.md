# Runbooks

> **Authority:** what to do when something goes wrong on the live demo. Local problems are in [troubleshooting.md](../development/troubleshooting.md).
> **Status:** written 26 Oct 2026 from incidents met during deployment (2 Oct 2026). Procedures marked *untested* have not been run end to end.

Every runbook ends the same way: note what happened and what you did in [handoff.md](../handoff.md).

## Site does not load

1. Wait 60 s and reload. The free instance sleeps after about 15 min without traffic; the first request wakes it (NFR-10).
2. Open `/api/health`.
   - `ok` → the API is fine; check the browser console for a front-end error.
   - `degraded` → see [Database unreachable](#database-unreachable).
   - No answer after 2 min → Render dashboard → seatly → Logs and Events. A failed deploy keeps the previous version running; a crash loop shows the start-up error.
3. A start-up error naming a variable (`APP_ORIGIN`, `COOKIE_SECURE`, `MONGODB_URI`) means configuration: fix it in the dashboard and redeploy.
4. Render's free plan has a monthly hour allowance; if it is used up the service stays down until the next month ([limits-and-costs.md](limits-and-costs.md)).

## Database unreachable

Health shows `db: unavailable`, or logs show `MongoServerSelectionError` / authentication errors.

1. Atlas → the cluster: is it paused or in maintenance? Free clusters pause after long inactivity; resume it.
2. Atlas → Network Access must include `0.0.0.0/0` (Render has no fixed IP), saved as **permanent**. A temporary entry expires silently: running instances keep their open connections, but the next deploy or restart cannot connect. The log then shows `tlsv1 alert internal error` (SSL alert number 80) and `commonWireVersion: 0`, and the process exits before listening. Seen on 27 Oct 2026; fixed by re-adding the entry and redeploying.
3. Atlas → Database Access: does the user exist with the password that is in Render's `MONGODB_URI`? If the password was rotated, update `MONGODB_URI` in Render and redeploy.
4. The URI must contain `/seatly` and point at the replica set; `+srv` is fine on Render.

## Every login or booking fails with 403

`ORIGIN_NOT_ALLOWED` means `APP_ORIGIN` in Render is not exactly `https://seatly-02yb.onrender.com` (no trailing slash, `https`). Fix it and redeploy. Seen on 2 Oct 2026.

## Leaked credentials

Applies to the Atlas password, the full connection string, or a session cookie seen in a screenshot, log or commit.

1. Atlas → Database Access → edit the user → **generate a new password**. The old one stops working at once.
2. Update `MONGODB_URI` in Render → save → the service redeploys. Check `/api/health`.
3. Update your local copy wherever you keep it (not in `.env`).
4. If it was committed, removing the commit is not enough: the rotation above is what fixes it.
5. Leaked session cookie: the user logs out (deletes that session); otherwise it expires within 7 days. There is no "log out everywhere" in V1.

Done once on 2 Oct 2026, after the password appeared in a screenshot.

## Bookings look wrong

### Check the booking invariant

The rule: a seat is `booked` **if and only if** exactly one booking points to it. In Atlas → Browse Collections → `seats` → Aggregation (or `mongosh`), run against database `seatly`:

```js
// 1. Seats booked more than once (must return nothing; the unique index should make this impossible)
db.bookings.aggregate([{ $group: { _id: { e: "$eventId", s: "$seatId" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])

// 2. Bookings whose seat is not marked booked by them (must return nothing)
db.bookings.aggregate([
  { $lookup: { from: "seats", let: { e: "$eventId", s: "$seatId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$eventId", "$$e"] }, { $eq: ["$seatId", "$$s"] }] } } }], as: "seat" } },
  { $match: { $expr: { $or: [{ $ne: [{ $arrayElemAt: ["$seat.status", 0] }, "booked"] }, { $ne: [{ $arrayElemAt: ["$seat.bookingId", 0] }, "$_id"] }] } } },
  { $count: "broken" }
])

// 3. Booked seats with no booking (must return nothing)
db.seats.aggregate([
  { $match: { status: "booked" } },
  { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "b" } },
  { $match: { b: { $size: 0 } } }, { $count: "orphans" }
])
```

*Untested on Atlas* (the same rule is checked after every integration test by `expectInvariantHolds`). Any result is a serious bug: stop changing data, keep the documents, and open an issue with the IDs.

## Re-seed the live demo

Use when the demo data is exhausted (all seats booked by someone scripting sign-ups) or damaged.

- **Top up / repair:** `MONGODB_URI='…' npm run seed` from your machine. It is idempotent: it adds missing events and seats and moves started events forward, and never deletes.
- **Full reset (deletes all users and bookings):** in Atlas, drop the database `seatly`, then run the seed command above, then restart the Render service so it rebuilds indexes. *Untested on Atlas.* Everyone registered loses their account; acceptable for a demo (decision Q5).

## Delete a user's account on request

Follow [personal-data.md](../security/personal-data.md#requests-from-users), then run [the invariant check](#check-the-booking-invariant). *Untested.*

## Render deploy fails

Read the build log. Known causes: devDependencies skipped (the build command must keep `--include=dev`); a TypeScript error that CI would also show (fix and push); Node version (pinned to 24 by `NODE_VERSION`).

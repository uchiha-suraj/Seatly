# Limits and costs

> **Authority:** what the hosting costs, its limits, and what V1's numbers do and do not show.
> **Status:** free-tier limits are as understood when the services were set up (Oct 2026), not re-checked against the providers' current terms. *Assumption* where marked.

## Cost

$0 per month: Render free web service, MongoDB Atlas free cluster, GitHub Actions on a public repository. No paid assets or services.

## Limits that matter

| Limit | Effect on Seatly |
| --- | --- |
| Render free: the instance sleeps after about 15 min idle | First request takes about 50 s (NFR-10, observed) |
| Render free: one small instance, about 512 MB RAM | argon2 memory lowered to 19 MB (`ARGON2_MEMORY_KIB=19456`); one process only |
| Render free: monthly instance-hour allowance (*assumption*: about 750 h) | One always-sleeping service fits; a second service on the same account shares it |
| Render free: no shell, no fixed outbound IP | Seed from a developer machine; Atlas open to `0.0.0.0/0` |
| Atlas free: 512 MB storage, shared CPU, connection cap (*assumption*: about 500) | Thousands of bookings fit easily; heavy load would be throttled |
| Atlas free: backups (*assumption*: not included) | Recovery is re-seeding |

## What the tests do and do not show

The 300-user concurrency demo shows **correctness under contention**: exactly one of 300 simultaneous requests for one seat wins, across two processes. It runs on a CI machine with a local database. It is **not** a measure of how many users the live demo can serve, and no throughput or latency target is set for V1.

## When to move off the free tier

Any of these: people use it for real events; cold starts are unacceptable; data must survive (backups); traffic hits the Atlas or Render limits. The smallest step is Render's cheapest paid instance (no sleep) and an Atlas tier with backups. The code needs no change to run several API processes (NFR-1).

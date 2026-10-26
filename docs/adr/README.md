# Architecture decision records

Each record explains one significant decision: the context, the options, the choice, its costs, and when to revisit it. Records are never deleted; a reversed decision is marked *Superseded by ADR-NNNN* and a new record is added.

**Adding one:** copy the structure of an existing record, take the next number, set *Status: Proposed*, and change it to *Accepted* once Suraj agrees. Link it from the documents it affects.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-replica-set-transactions.md) | Use a MongoDB replica set so bookings can use transactions | Accepted |
| [0002](0002-conditional-claim-unique-index.md) | Claim a seat with one conditional update, backed by a unique index | Accepted |
| [0003](0003-one-transaction.md) | Write seat claim, booking and idempotency result in one transaction | Accepted |
| [0004](0004-idempotency-keys.md) | Idempotency keys with a fingerprint, a lease and a fencing token | Accepted |
| [0005](0005-cookie-sessions.md) | Opaque session tokens in an HttpOnly cookie, stored hashed | Accepted |
| [0006](0006-single-origin.md) | Serve the API and the web app from one origin | Accepted |
| [0007](0007-render-and-atlas.md) | Host on Render's free plan with a MongoDB Atlas free cluster | Accepted |
| [0008](0008-workspaces-shared-schemas.md) | One repository with npm workspaces and shared Zod schemas | Accepted |
| [0009](0009-sync-indexes-no-migrations.md) | Create indexes at startup instead of migration files | Accepted |
| [0010](0010-seat-map-polling.md) | Refresh the seat map by polling every 10 seconds | Accepted |
| [0011](0011-typescript-6-pin.md) | Pin TypeScript to 6.0 | Accepted |
| [0012](0012-booking-closes-at-start.md) | Close booking when an event starts; roll demo event dates forward | Accepted |

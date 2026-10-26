# Troubleshooting (local development)

> **Authority:** known local setup problems and their fixes. Production incidents are in [runbooks.md](../operations/runbooks.md).
> **Status:** each entry was hit and fixed during Stages 4–6 (Sept–Oct 2026) unless marked otherwise.

## MongoDB

### "Transaction numbers are only allowed on a replica set member"

You are connected to a standalone `mongod`. Use `npm run db:up` (Docker, one-node replica set `rs0`) and keep `?replicaSet=rs0` in `MONGODB_URI`. `npm run db:check` confirms a writable primary.

### The integration suite refuses to start

It needs `MONGODB_URI_TEST` pointing at a replica set (default in `.env.example`). Start Docker, run `npm run db:up`, then `npm run test:api`.

### `db:up` hangs or fails

Docker Desktop is not running, or port 27017 is taken by another MongoDB (a Windows service, for example). Stop the other one or change the port in `docker-compose.yml` and both URIs in `.env`. `npm run db:reset` wipes the volume if the replica-set config is broken.

## Atlas from your machine

### `querySrv ECONNREFUSED` on Windows

Node's built-in DNS resolver fails the SRV lookup for `mongodb+srv://` strings on some Windows networks, even when `nslookup` works. Use Atlas's **standard** connection string instead (Connect → Drivers → toggle off SRV, or build it):

```
mongodb://<user>:<password>@host1:27017,host2:27017,host3:27017/seatly?tls=true&replicaSet=<atlas-replica-set>&authSource=admin&retryWrites=true&w=majority
```

Render resolves SRV fine and keeps the `+srv` string.

### Keep the Atlas URI out of `.env`

Pass it only on the command line for one-off commands:

```bash
MONGODB_URI='…' npm run db:check
MONGODB_URI='…' npm run seed
```

(PowerShell: `$env:MONGODB_URI='…'; npm run seed; Remove-Item Env:MONGODB_URI`.)

If the Atlas URI sits in `.env` and `DEMO_MODE=true` is set, `npm run demo:*` would reset the live demo event. Never paste the URI into screenshots, issues or chat; if it leaks, follow [leaked credentials](../operations/runbooks.md#leaked-credentials).

### Authentication failed / IP not allowed

Check the database user's password (rotate it if unsure) and that Atlas Network Access includes your IP or `0.0.0.0/0`.

## Running the app

### Port 4000, 4001, 4002 or 5173 already in use

Another dev server is still running. Stop it, or on Windows find it with `netstat -ano | findstr :4000` and end that process.

### Every login or booking returns 403 `ORIGIN_NOT_ALLOWED`

`APP_ORIGIN` does not match the address in the browser. Locally it must be `http://localhost:5173` for `npm run dev`, or `http://localhost:4000` when the API serves the built app. No trailing slash.

### Logged in, but the session disappears immediately

`COOKIE_SECURE=true` on plain `http://localhost`: the browser drops `Secure` cookies over HTTP. Use `false` locally.

### `npm run start:two` fails on Windows

Use the script as is: it uses `cross-env` to set `PORT`. Run `npm run build` first; it starts the built server.

### The demo says a target is down

The demo checks `/api/health` on each target before starting. Start both processes (`npm run start:two`) and wait for "listening" in both logs. The demo also needs `DEMO_MODE=true` in the environment it runs in.

## Tests

### A web test passes alone but fails in the full run

Usually timing. The suite uses a 3 s `asyncUtilTimeout` (`apps/web/test/setup.ts`). Prefer `findBy…` and `waitFor` over fixed sleeps, and reset MSW state through `db` in `apps/web/test/msw.ts`.

### An integration test sees bookings it did not make

The seed pre-books some seats. Filter by `eventId` as well as `seatId`.

## Git on a synced folder

If a git command reports `index.lock: File exists` and no other git process is running, delete `.git/index.lock` and retry.

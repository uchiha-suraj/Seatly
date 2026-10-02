import { parseArgs } from 'node:util';

export interface DemoUser {
  email: string;
  cookie: string;
}

export const DEMO_PASSWORD = 'demo-password-123';

export function args() {
  return parseArgs({
    options: {
      users: { type: 'string', default: '300' },
      event: { type: 'string', default: 'demo-last-seat' },
      seat: { type: 'string', default: 'A1' },
      targets: { type: 'string', default: process.env.DEMO_TARGETS ?? 'http://localhost:4000' },
      parallel: { type: 'string', default: '20' },
    },
  }).values;
}

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('seatly_sid='));
  if (!raw) throw new Error(`no session cookie in response (${res.status})`);
  return raw.split(';')[0]!;
}

/** Registers demo-user-NNN, or logs in if it already exists. Setup only — not part of the race. */
export async function ensureUser(base: string, i: number): Promise<DemoUser> {
  const email = `demo-user-${String(i).padStart(3, '0')}@seatly.test`;
  const headers = { 'content-type': 'application/json' };
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Demo User ${i}`, email, password: DEMO_PASSWORD }),
  });
  if (res.status === 409) {
    res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email, password: DEMO_PASSWORD }) });
  }
  if (!res.ok) throw new Error(`could not create or log in ${email}: HTTP ${res.status} ${await res.text()}`);
  return { email, cookie: cookieFrom(res) };
}

export async function ensureUsers(base: string, count: number, parallel: number): Promise<DemoUser[]> {
  const users: DemoUser[] = new Array(count);
  let next = 1;
  async function worker() {
    while (next <= count) {
      const i = next++;
      users[i - 1] = await ensureUser(base, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, count) }, worker));
  return users;
}

export async function eventIdBySlug(base: string, slug: string): Promise<string> {
  const res = await fetch(`${base}/api/events`);
  const body = (await res.json()) as { events: { id: string; slug: string }[] };
  const ev = body.events.find((e) => e.slug === slug);
  if (!ev) throw new Error(`event ${slug} not found — run npm run seed`);
  return ev.id;
}

export interface Shot {
  status: number;
  code: string | null;
  bookingId: string | null;
  replayed: boolean;
  ms: number;
  target: string;
  error?: string;
}

export async function book(target: string, cookie: string, key: string, eventId: string, seatId: string): Promise<Shot> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${target}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'idempotency-key': key },
      body: JSON.stringify({ eventId, seatId }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => ({}))) as { booking?: { id: string }; error?: { code: string } };
    return {
      status: res.status,
      code: body.error?.code ?? null,
      bookingId: body.booking?.id ?? null,
      replayed: res.headers.get('idempotent-replayed') === 'true',
      ms: performance.now() - t0,
      target,
    };
  } catch (err) {
    return { status: 0, code: null, bookingId: null, replayed: false, ms: performance.now() - t0, target, error: (err as Error).message };
  }
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

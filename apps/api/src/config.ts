import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: bool.default(false),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SESSION_IDLE_MINUTES: z.coerce.number().positive().default(120),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().positive().default(7),
  BOOKING_DEADLINE_MS: z.coerce.number().int().positive().default(4000),
  IDEMPOTENCY_LEASE_MS: z.coerce.number().int().positive().default(15000),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().positive().default(24),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(65536),
  DEMO_MODE: bool.default(false),
  SERVE_WEB_DIST: bool.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  appOrigin: string;
  cookieSecure: boolean;
  trustProxy: number;
  sessionIdleMs: number;
  sessionAbsoluteMs: number;
  bookingDeadlineMs: number;
  idempotencyLeaseMs: number;
  idempotencyTtlMs: number;
  authRateLimitPerMin: number;
  argon2MemoryKiB: number;
  demoMode: boolean;
  serveWebDist: boolean;
  logLevel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    // Fail at startup rather than rejecting every login and booking as cross-origin later.
    if (!env.APP_ORIGIN) throw new Error('Invalid environment configuration:\n  APP_ORIGIN is required in production (the public https URL).');
    if (!e.COOKIE_SECURE) throw new Error('Invalid environment configuration:\n  COOKIE_SECURE must be true in production.');
  }
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    mongodbUri: e.MONGODB_URI,
    appOrigin: new URL(e.APP_ORIGIN).origin,
    cookieSecure: e.COOKIE_SECURE,
    trustProxy: e.TRUST_PROXY,
    sessionIdleMs: e.SESSION_IDLE_MINUTES * 60_000,
    sessionAbsoluteMs: e.SESSION_ABSOLUTE_DAYS * 86_400_000,
    bookingDeadlineMs: e.BOOKING_DEADLINE_MS,
    idempotencyLeaseMs: e.IDEMPOTENCY_LEASE_MS,
    idempotencyTtlMs: e.IDEMPOTENCY_TTL_HOURS * 3_600_000,
    authRateLimitPerMin: e.AUTH_RATE_LIMIT_PER_MIN,
    argon2MemoryKiB: e.ARGON2_MEMORY_KIB,
    demoMode: e.DEMO_MODE,
    serveWebDist: e.SERVE_WEB_DIST,
    logLevel: e.LOG_LEVEL,
  };
}

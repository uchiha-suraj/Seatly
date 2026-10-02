import { pino } from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    redact: { paths: ['req.headers.cookie', 'res.headers["set-cookie"]', 'password', '*.password'], censor: '[redacted]' },
  });
}
export type AppLogger = ReturnType<typeof createLogger>;

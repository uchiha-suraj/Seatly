import type { NextFunction, Request, Response } from 'express';
import type { Config } from '../config';
import { Session } from '../db/models';
import type { Clock } from '../lib/clock';
import { sha256Hex } from '../lib/crypto';
import { AppError } from '../lib/errors';

export const SESSION_COOKIE = 'seatly_sid';
const TOUCH_INTERVAL_MS = 5 * 60_000;

export function cookieOptions(config: Config) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: config.sessionAbsoluteMs,
  };
}

export function clearSessionCookie(res: Response, config: Config): void {
  const { maxAge: _ignored, ...rest } = cookieOptions(config);
  res.clearCookie(SESSION_COOKIE, rest);
}

/** Resolves the cookie to a live session. Unknown or expired tokens are simply anonymous. */
export function sessionMiddleware(config: Config, clock: Clock) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return next();
    const now = clock.now();
    const session = await Session.findOne({
      tokenHash: sha256Hex(token),
      idleExpiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    }).lean();
    if (!session) return next();

    // Sliding idle timeout, written at most once per 5 minutes per session.
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      const idleExpiresAt = new Date(now.getTime() + config.sessionIdleMs);
      const expiresAt = idleExpiresAt < session.absoluteExpiresAt ? idleExpiresAt : session.absoluteExpiresAt;
      await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: now, idleExpiresAt, expiresAt } });
    }
    req.auth = { userId: session.userId, sessionId: session._id };
    next();
  };
}

export function requireAuth(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth) return next();
    if (req.cookies?.[SESSION_COOKIE]) clearSessionCookie(res, config);
    next(new AppError('UNAUTHENTICATED', 'Please log in to continue.'));
  };
}

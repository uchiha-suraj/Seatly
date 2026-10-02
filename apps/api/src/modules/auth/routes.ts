import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginSchema, registerSchema } from '@seatly/shared';
import type { Config } from '../../config';
import { errorBody } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validate';
import { AppError } from '../../lib/errors';
import { SESSION_COOKIE, clearSessionCookie, cookieOptions, requireAuth } from '../../middleware/session';
import type { AuthService } from './service';

export function authRoutes(config: Config, auth: AuthService): Router {
  const router = Router();

  const limiter =
    config.nodeEnv === 'test' || config.demoMode
      ? (_req: Request, _res: Response, next: () => void) => next()
      : rateLimit({
          windowMs: 60_000,
          limit: config.authRateLimitPerMin,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          handler: (req, res) => {
            res.status(429).json(errorBody('RATE_LIMITED', 'Too many attempts. Wait a minute and try again.', req.requestId));
          },
        });

  router.post('/register', limiter, async (req, res) => {
    const input = parseOrThrow(registerSchema, req.body);
    const user = await auth.register(input);
    const token = await auth.createSession(user.id, req.auth?.sessionId);
    res.cookie(SESSION_COOKIE, token, cookieOptions(config));
    res.status(201).json({ user });
  });

  router.post('/login', limiter, async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body);
    const user = await auth.verifyCredentials(input);
    const token = await auth.createSession(user.id, req.auth?.sessionId);
    res.cookie(SESSION_COOKIE, token, cookieOptions(config));
    res.status(200).json({ user });
  });

  // Idempotent: logging out without a session is still a success.
  router.post('/logout', async (req, res) => {
    if (req.auth) await auth.deleteSession(req.auth.sessionId);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', requireAuth(config), async (req, res) => {
    const user = await auth.getUser(req.auth!.userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in to continue.');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user });
  });

  return router;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import type { Config } from './config';
import { assertReplicaSet } from './db/connection';
import { systemClock, type Clock } from './lib/clock';
import { noFaults, type Faults } from './lib/faults';
import { createLogger, type AppLogger } from './logger';
import { apiNotFound, errorHandler, originCheck, requestId, requireJson } from './middleware/http';
import { requireAuth, sessionMiddleware } from './middleware/session';
import { authRoutes } from './modules/auth/routes';
import { AuthService } from './modules/auth/service';
import { bookingRoutes, myBookingRoutes } from './modules/bookings/routes';
import { BookingService } from './modules/bookings/service';
import { eventRoutes } from './modules/events/routes';
import { EventsService } from './modules/events/service';

export interface AppDeps {
  config: Config;
  clock?: Clock;
  faults?: Faults;
  logger?: AppLogger;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ config, clock = systemClock, faults = noFaults, logger = createLogger(config.logLevel) }: AppDeps): Express {
  if (faults !== noFaults && config.nodeEnv !== 'test') throw new Error('Fault injection is only allowed in tests');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as express.Request).requestId, autoLogging: config.nodeEnv !== 'test' }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'style-src': ["'self'", "'unsafe-inline'"] },
      },
    }),
  );

  const auth = new AuthService(config, clock);
  const events = new EventsService(clock);
  const bookings = new BookingService(config, clock, faults, logger);
  const authed = requireAuth(config);

  const api = express.Router();
  api.use(express.json({ limit: '16kb' }));
  api.use(cookieParser());
  api.use(originCheck(config.appOrigin));
  api.use(requireJson);
  api.use(sessionMiddleware(config, clock));

  api.get('/health', async (_req, res) => {
    try {
      await mongoose.connection.db?.admin().ping();
      const replicaSet = await assertReplicaSet();
      res.json({ status: 'ok', db: 'ok', replicaSet });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'unavailable' });
    }
  });
  api.use('/auth', authRoutes(config, auth));
  api.use('/events', eventRoutes(events));
  api.use('/bookings', authed, bookingRoutes(bookings));
  api.use('/me', authed, myBookingRoutes(bookings));
  api.use(apiNotFound);

  app.use('/api', api);

  if (config.serveWebDist) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
    app.use(
      express.static(dist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    // SPA fallback: any non-API GET serves index.html; the client router handles the path.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler(logger));
  return app;
}

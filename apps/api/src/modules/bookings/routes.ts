import { Router } from 'express';
import { IDEMPOTENCY_HEADER, REPLAY_HEADER, createBookingSchema, idempotencyKeySchema } from '@seatly/shared';
import { AppError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validate';
import type { BookingService } from './service';

export function bookingRoutes(bookings: BookingService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const rawKey = req.get(IDEMPOTENCY_HEADER);
    if (!rawKey) throw new AppError('IDEMPOTENCY_KEY_MISSING', `Send an ${IDEMPOTENCY_HEADER} header (a UUID).`);
    if (!idempotencyKeySchema.safeParse(rawKey).success) {
      throw new AppError('IDEMPOTENCY_KEY_INVALID', `${IDEMPOTENCY_HEADER} must be a UUID.`);
    }
    const input = parseOrThrow(createBookingSchema, req.body);
    // The user always comes from the session, never from the request.
    const outcome = await bookings.create({ userId: req.auth!.userId, key: rawKey.toLowerCase(), input, requestId: req.requestId });
    res.setHeader('Cache-Control', 'no-store');
    if (outcome.replayed) res.setHeader(REPLAY_HEADER, 'true');
    res.status(outcome.statusCode).json(outcome.body);
  });

  router.get('/:bookingId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ booking: await bookings.getForUser(req.auth!.userId, req.params.bookingId) });
  });

  return router;
}

export function myBookingRoutes(bookings: BookingService): Router {
  const router = Router();
  router.get('/bookings', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ bookings: await bookings.listForUser(req.auth!.userId) });
  });
  return router;
}

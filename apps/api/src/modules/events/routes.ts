import { Router } from 'express';
import type { EventsService } from './service';

export function eventRoutes(events: EventsService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ events: await events.list() });
  });

  router.get('/:eventId', async (req, res) => {
    res.json({ event: await events.get(req.params.eventId) });
  });

  router.get('/:eventId/seats', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await events.seats(req.params.eventId));
  });

  return router;
}

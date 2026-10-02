import { Types } from 'mongoose';
import { OBJECT_ID_RE, type EventDetailDto, type EventSummaryDto, type SeatsResponse } from '@seatly/shared';
import { Event, Seat, type EventDoc } from '../../db/models';
import type { Clock } from '../../lib/clock';
import { AppError } from '../../lib/errors';

function toSummary(e: EventDoc, availableSeats: number): EventSummaryDto {
  return {
    id: e._id.toString(),
    slug: e.slug,
    title: e.title,
    imageUrl: e.imageUrl,
    imageAlt: e.imageAlt,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    timezone: e.timezone,
    venue: e.venue,
    totalSeats: e.totalSeats,
    availableSeats,
  };
}

/** Unknown and malformed ids get the same 404, so the UI shows one Not-found page for both. */
export function parseEventId(raw: string): Types.ObjectId {
  if (!OBJECT_ID_RE.test(raw)) throw new AppError('EVENT_NOT_FOUND', 'We couldn’t find that event.');
  return new Types.ObjectId(raw);
}

/** Availability is counted from the seat documents (never a stored counter that could drift). */
async function availableCounts(eventIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await Seat.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { eventId: { $in: eventIds }, status: 'available' } },
    { $group: { _id: '$eventId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.n]));
}

export class EventsService {
  constructor(private readonly clock: Clock) {}

  async list(): Promise<EventSummaryDto[]> {
    const events = await Event.find().sort({ startsAt: 1 }).lean<EventDoc[]>();
    const counts = await availableCounts(events.map((e) => e._id));
    return events.map((e) => toSummary(e, counts.get(e._id.toString()) ?? 0));
  }

  async get(rawId: string): Promise<EventDetailDto> {
    const id = parseEventId(rawId);
    const e = await Event.findById(id).lean<EventDoc>();
    if (!e) throw new AppError('EVENT_NOT_FOUND', 'We couldn’t find that event.');
    const counts = await availableCounts([e._id]);
    return {
      ...toSummary(e, counts.get(e._id.toString()) ?? 0),
      description: e.description,
      layout: { rows: [...e.layout.rows], seatsPerRow: e.layout.seatsPerRow },
    };
  }

  async seats(rawId: string): Promise<SeatsResponse> {
    const id = parseEventId(rawId);
    const e = await Event.findById(id).lean<EventDoc>();
    if (!e) throw new AppError('EVENT_NOT_FOUND', 'We couldn’t find that event.');
    const seats = await Seat.find({ eventId: id }, { seatId: 1, row: 1, number: 1, status: 1, _id: 0 })
      .sort({ row: 1, number: 1 })
      .lean();
    return {
      eventId: e._id.toString(),
      asOf: this.clock.now().toISOString(),
      availableSeats: seats.filter((s) => s.status === 'available').length,
      totalSeats: e.totalSeats,
      layout: { rows: [...e.layout.rows], seatsPerRow: e.layout.seatsPerRow },
      // Never reveals who booked a seat.
      seats: seats.map((s) => ({ seatId: s.seatId, row: s.row, number: s.number, status: s.status as 'available' | 'booked' })),
    };
  }
}

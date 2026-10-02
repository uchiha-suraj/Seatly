import type { Types } from 'mongoose';
import type { BookingDto } from '@seatly/shared';

export function seatParts(seatId: string): { row: string; number: number } {
  return { row: seatId.slice(0, 1), number: Number.parseInt(seatId.slice(1), 10) };
}

export function toBookingDto(
  booking: { _id: Types.ObjectId; reference: string; seatId: string; createdAt: Date },
  event: { _id: Types.ObjectId; title: string; startsAt: Date; timezone: string; venue: string },
  user: { name: string; email: string },
): BookingDto {
  return {
    id: booking._id.toString(),
    reference: booking.reference,
    bookedAt: booking.createdAt.toISOString(),
    seat: { seatId: booking.seatId, ...seatParts(booking.seatId) },
    event: {
      id: event._id.toString(),
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      timezone: event.timezone,
      venue: event.venue,
    },
    bookedBy: { name: user.name, email: user.email },
  };
}

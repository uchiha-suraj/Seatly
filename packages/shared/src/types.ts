export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface EventSummaryDto {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venue: string;
  totalSeats: number;
  availableSeats: number;
}

export interface SeatLayout {
  rows: string[];
  seatsPerRow: number;
}

export interface EventDetailDto extends EventSummaryDto {
  description: string;
  layout: SeatLayout;
}

export type SeatStatus = 'available' | 'booked';

export interface SeatDto {
  seatId: string;
  row: string;
  number: number;
  status: SeatStatus;
}

export interface SeatsResponse {
  eventId: string;
  asOf: string;
  availableSeats: number;
  totalSeats: number;
  layout: SeatLayout;
  seats: SeatDto[];
}

export interface BookingDto {
  id: string;
  reference: string;
  bookedAt: string;
  seat: { seatId: string; row: string; number: number };
  event: { id: string; title: string; startsAt: string; timezone: string; venue: string };
  bookedBy: { name: string; email: string };
}

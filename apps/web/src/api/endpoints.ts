import {
  IDEMPOTENCY_HEADER,
  REPLAY_HEADER,
  type BookingDto,
  type EventDetailDto,
  type EventSummaryDto,
  type LoginInput,
  type RegisterInput,
  type SeatsResponse,
  type UserDto,
} from '@seatly/shared';
import { api, ApiError } from './client';

/** Confirmed in Stage 3: the booking request times out after 10 s (tests shorten it). */
export const bookingConfig = { timeoutMs: 10_000 };

export async function getMe(): Promise<UserDto | null> {
  try {
    return (await api<{ user: UserDto }>('/auth/me')).data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const login = async (input: LoginInput) => (await api<{ user: UserDto }>('/auth/login', { method: 'POST', body: input })).data.user;
export const register = async (input: RegisterInput) =>
  (await api<{ user: UserDto }>('/auth/register', { method: 'POST', body: input })).data.user;
export const logout = async () => {
  await api<void>('/auth/logout', { method: 'POST' });
};

export const listEvents = async () => (await api<{ events: EventSummaryDto[] }>('/events')).data.events;
export const getEvent = async (id: string) => (await api<{ event: EventDetailDto }>(`/events/${encodeURIComponent(id)}`)).data.event;
export const getSeats = async (id: string) => (await api<SeatsResponse>(`/events/${encodeURIComponent(id)}/seats`)).data;

export async function createBooking(
  input: { eventId: string; seatId: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<{ booking: BookingDto; replayed: boolean }> {
  const res = await api<{ booking: BookingDto }>('/bookings', {
    method: 'POST',
    body: input,
    headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
    timeoutMs: bookingConfig.timeoutMs,
    signal,
  });
  return { booking: res.data.booking, replayed: res.headers.get(REPLAY_HEADER) === 'true' };
}

export const getBooking = async (id: string) => (await api<{ booking: BookingDto }>(`/bookings/${encodeURIComponent(id)}`)).data.booking;
export const listMyBookings = async () => (await api<{ bookings: BookingDto[] }>('/me/bookings')).data.bookings;

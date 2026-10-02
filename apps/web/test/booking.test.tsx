import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookingConfig } from '../src/api/endpoints';
import { EVENT_ID, db, delay, err, HttpResponse, makeBooking, resetDb } from './msw';
import { renderApp } from './render';

// Shorten the real 1 s / 3 s waits; the schedule itself is unit-tested in lib.test.ts.
vi.mock('../src/lib/retry', async (orig) => ({
  ...(await orig<typeof import('../src/lib/retry')>()),
  retryDelay: (i: number) => [20, 40][i] ?? 40,
  inProgressDelay: () => 20,
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const page = `/events/${EVENT_ID}`;

beforeEach(() => resetDb());
afterEach(() => {
  bookingConfig.timeoutMs = 10_000;
});

async function pickAndBook(seat: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Seat ${seat}, available` }));
  await user.click(screen.getByRole('button', { name: `Book seat ${seat}` }));
  return user;
}

describe('booking from the event page', () => {
  it('books, then shows the confirmation (AC-10)', async () => {
    const { router } = renderApp(page);
    await pickAndBook('A1');
    expect(await screen.findByRole('heading', { name: 'You’re booked' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/bookings/b-A1');
    expect(screen.getByText('SEAT-7KQ4-M2XP')).toBeInTheDocument();
    expect(db.bookingKeys).toHaveLength(1);
    expect(db.bookingKeys[0]).toMatch(UUID);
  });

  it('on SEAT_TAKEN shows the conflict, refreshes seats and clears the selection (AC-11)', async () => {
    db.bookingResponder = ({ seatId }) => {
      db.booked.add(seatId);
      return err(409, 'SEAT_TAKEN', `Seat ${seatId} was just booked by someone else.`);
    };
    renderApp(page);
    await pickAndBook('B1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Seat B1 was just taken');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Seat B1, booked' })).toBeInTheDocument());
    expect(db.seatFetches).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: /, selected$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Select a seat to continue' })).toBeDisabled();
  });

  it('after a conflict, a new attempt on another seat uses a NEW key', async () => {
    db.bookingResponder = ({ seatId, attempt }) => {
      if (attempt === 1) {
        db.booked.add(seatId);
        return err(409, 'SEAT_TAKEN');
      }
      return HttpResponse.json({ booking: makeBooking(seatId) }, { status: 201 });
    };
    renderApp(page);
    await pickAndBook('B1');
    await screen.findByRole('alert');
    await pickAndBook('B2');
    await screen.findByRole('heading', { name: 'You’re booked' });
    expect(db.bookingKeys).toHaveLength(2);
    expect(db.bookingKeys[0]).not.toBe(db.bookingKeys[1]);
  });

  it('retries a timed-out request with the SAME key (AC-20)', async () => {
    bookingConfig.timeoutMs = 60;
    db.bookingResponder = async ({ seatId, attempt }) => {
      if (attempt === 1) await delay(300);
      return HttpResponse.json({ booking: makeBooking(seatId) }, { status: 201, headers: attempt > 1 ? { 'Idempotent-Replayed': 'true' } : {} });
    };
    renderApp(page);
    await pickAndBook('A1');
    await screen.findByRole('heading', { name: 'You’re booked' });
    expect(db.bookingKeys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(db.bookingKeys).size).toBe(1);
  });

  it('after 2 failed retries shows "Retries exhausted"; Try again reuses the key', async () => {
    let failing = true;
    db.bookingResponder = ({ seatId }) =>
      failing ? err(503, 'BOOKING_UNAVAILABLE', 'busy', { 'Retry-After': '0' }) : HttpResponse.json({ booking: makeBooking(seatId) }, { status: 201 });
    renderApp(page);
    const user = await pickAndBook('A3');
    expect(await screen.findByText('We couldn’t confirm your booking')).toBeInTheDocument();
    expect(db.bookingKeys).toHaveLength(3); // original + 2 automatic retries
    expect(new Set(db.bookingKeys).size).toBe(1);
    expect(screen.getByRole('button', { name: 'Check My bookings' })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'You’re booked' });
    expect(new Set(db.bookingKeys).size).toBe(1);
  });

  it('waits on 409 IDEMPOTENCY_IN_PROGRESS and resends the same key (AC-19b, UI)', async () => {
    db.bookingResponder = ({ seatId, attempt }) =>
      attempt < 3 ? err(409, 'IDEMPOTENCY_IN_PROGRESS', 'busy', { 'Retry-After': '1' }) : HttpResponse.json({ booking: makeBooking(seatId) }, { status: 201 });
    renderApp(page);
    await pickAndBook('A1');
    await screen.findByRole('heading', { name: 'You’re booked' });
    expect(db.bookingKeys).toHaveLength(3);
    expect(new Set(db.bookingKeys).size).toBe(1);
  });

  it('resumes an attempt interrupted by a reload with the stored key', async () => {
    const key = '3f0c8f0e-2c55-4f7a-9b8e-5d2f6f1f9a10';
    sessionStorage.setItem(`seatly:pending:${EVENT_ID}`, JSON.stringify({ seatId: 'A1', key, createdAt: Date.now() }));
    renderApp(page);
    await screen.findByRole('heading', { name: 'You’re booked' });
    expect(db.bookingKeys).toEqual([key]);
    expect(sessionStorage.getItem(`seatly:pending:${EVENT_ID}`)).toBeNull();
  });
});

describe('login and return (AC-14) and session expiry (AC-15)', () => {
  it('a guest pressing Book is sent to log in with the seat as intent', async () => {
    resetDb({ me: null });
    const { router } = renderApp(page);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Seat A1, available' }));
    expect(screen.getByText(/doesn’t hold it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log in to book A1' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(`/events/${EVENT_ID}?seat=A1`);
    expect(await screen.findByText(/Log in to book seat A1 at Midnight Jazz/)).toBeInTheDocument();
    expect(db.bookingKeys).toHaveLength(0);
  });

  it('after login restores the seat only if it is still available, without booking', async () => {
    renderApp(`${page}?seat=A3`, { fromAuth: true });
    expect(await screen.findByText('Seat A3 is still available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat A3, selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book seat A3' })).toBeEnabled();
    expect(db.bookingKeys).toHaveLength(0);
  });

  it('after login drops the seat if it was booked meanwhile', async () => {
    resetDb({ booked: ['A2', 'A3'] });
    const { router } = renderApp(`${page}?seat=A3`, { fromAuth: true });
    expect(await screen.findByText('Seat A3 is no longer available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /, selected$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Select a seat to continue' })).toBeDisabled();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(db.bookingKeys).toHaveLength(0);
  });

  it('a 401 while booking shows "session expired" and sends the user to log in with the seat', async () => {
    db.bookingResponder = () => err(401, 'UNAUTHENTICATED');
    const { router } = renderApp(page);
    const user = await pickAndBook('A1');
    expect(await screen.findByText('Your session expired')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log in again' }));
    const q = new URLSearchParams(router.state.location.search);
    expect(router.state.location.pathname).toBe('/login');
    expect(q.get('reason')).toBe('expired');
    expect(q.get('returnTo')).toBe(`/events/${EVENT_ID}?seat=A1`);
    expect(sessionStorage.getItem(`seatly:pending:${EVENT_ID}`)).toBeNull();
  });
});

describe('auth pages and guards', () => {
  it('protects My bookings (AC-6)', async () => {
    resetDb({ me: null });
    const { router } = renderApp('/bookings');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe('/bookings');
  });

  it('shows one generic error for bad credentials, then logs in and returns', async () => {
    resetDb({ me: null });
    const { router } = renderApp(`/login?returnTo=${encodeURIComponent('/bookings')}`);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass-1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/bookings'));
    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
  });

  it('validates the registration form on submit and focuses the first invalid field', async () => {
    resetDb({ me: null });
    renderApp('/register');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveFocus();
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends signed-in users away from the login page', async () => {
    const { router } = renderApp('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

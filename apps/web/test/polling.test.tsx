import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshnessLabel, seatPollConfig } from '../src/features/events/useSeatPolling';
import { EVENT_ID, db, delay, HttpResponse, makeBooking, resetDb } from './msw';
import { renderApp } from './render';

const page = `/events/${EVENT_ID}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

beforeEach(() => {
  resetDb();
  seatPollConfig.intervalMs = 50;
  seatPollConfig.focusMinAgeMs = 0;
});
afterEach(() => {
  seatPollConfig.intervalMs = 10_000;
  seatPollConfig.focusMinAgeMs = 2_000;
  setVisibility('visible');
});

describe('seat map polling', () => {
  it('shows seats booked by someone else without a manual refresh', async () => {
    renderApp(page);
    await screen.findByRole('button', { name: 'Seat A3, available' });
    db.booked.add('A3');
    expect(await screen.findByRole('button', { name: 'Seat A3, booked' })).toBeInTheDocument();
  });

  it('drops a selected seat that someone else booked, and says so', async () => {
    const user = userEvent.setup();
    renderApp(page);
    await user.click(await screen.findByRole('button', { name: 'Seat A1, available' }));
    expect(screen.getByRole('button', { name: 'Book seat A1' })).toBeInTheDocument();

    db.booked.add('A1');

    expect(await screen.findByText('Seat A1 was just booked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat A1, booked' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book seat A1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Select a seat to continue' })).toBeDisabled();
    // A background refresh must not steal focus.
    expect(document.activeElement).not.toBe(screen.getByText('Seat A1 was just booked').closest('[role]'));
    // Picking another seat clears the notice.
    await user.click(screen.getByRole('button', { name: 'Seat B1, available' }));
    expect(screen.queryByText('Seat A1 was just booked')).toBeNull();
  });

  it('does not poll while the tab is hidden', async () => {
    renderApp(page);
    await screen.findByRole('button', { name: 'Seat A1, available' });
    setVisibility('hidden');
    const before = db.seatFetches;
    await sleep(300);
    expect(db.seatFetches).toBe(before);
  });

  it('does not poll while a booking request is in flight', async () => {
    let inFlightFetches = -1;
    db.bookingResponder = async ({ seatId }) => {
      const start = db.seatFetches;
      await delay(300);
      inFlightFetches = db.seatFetches - start;
      db.booked.add(seatId);
      const booking = makeBooking(seatId);
      db.bookings.unshift(booking);
      return HttpResponse.json({ booking }, { status: 201 });
    };
    const user = userEvent.setup();
    renderApp(page);
    await user.click(await screen.findByRole('button', { name: 'Seat A1, available' }));
    await user.click(screen.getByRole('button', { name: 'Book seat A1' }));
    expect(await screen.findByRole('heading', { name: 'You’re booked' })).toBeInTheDocument();
    expect(inFlightFetches).toBe(0);
  });

  it('refreshes when the window regains focus (two windows side by side)', async () => {
    seatPollConfig.intervalMs = 60_000;
    renderApp(page);
    await screen.findByRole('button', { name: 'Seat A1, available' });
    await sleep(20);
    const before = db.seatFetches;
    db.booked.add('A1');
    fireEvent.focus(window);
    await waitFor(() => expect(db.seatFetches).toBe(before + 1));
    expect(await screen.findByRole('button', { name: 'Seat A1, booked' })).toBeInTheDocument();
  });
});

describe('freshness label', () => {
  it('reads naturally', () => {
    const t = 1_000_000;
    expect(freshnessLabel(t, t + 2_000)).toBe('updated just now');
    expect(freshnessLabel(t, t + 8_400)).toBe('updated 8 s ago');
    expect(freshnessLabel(t, t + 125_000)).toBe('updated 2 min ago');
    expect(freshnessLabel(t, t - 500)).toBe('updated just now');
  });
});

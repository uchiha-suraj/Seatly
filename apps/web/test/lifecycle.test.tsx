import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EVENT_ID, db, err, resetDb } from './msw';
import { renderApp } from './render';

const page = `/events/${EVENT_ID}`;
beforeEach(() => resetDb());

describe('booking closed once the event has started (AC-28)', () => {
  it('shows the closed panel and locks the seat map', async () => {
    db.bookingOpen = false;
    const user = userEvent.setup();
    renderApp(page);
    expect(await screen.findByText('Booking has closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse upcoming events' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Row A, seat 1, available' }));
    expect(screen.queryByRole('button', { name: /^Book seat/ })).toBeNull();
    expect(db.bookingKeys).toHaveLength(0);
  });

  it('switches to the closed panel when the API answers BOOKING_CLOSED', async () => {
    db.bookingResponder = () => {
      db.bookingOpen = false;
      return err(409, 'BOOKING_CLOSED', 'Booking has closed: this event has already started.');
    };
    const user = userEvent.setup();
    renderApp(page);
    await user.click(await screen.findByRole('button', { name: 'Row A, seat 1, available' }));
    await user.click(screen.getByRole('button', { name: 'Book seat A1' }));
    expect(await screen.findByText('Booking has closed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Browse upcoming events' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: /^Book seat/ })).toBeNull();
    expect(db.bookingKeys).toHaveLength(1);
  });
});

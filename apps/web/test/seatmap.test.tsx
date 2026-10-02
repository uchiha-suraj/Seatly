import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { SeatDto } from '@seatly/shared';
import { availabilityBadge } from '../src/features/events/EventCard';
import { SeatMap } from '../src/features/events/SeatMap';

const layout = { rows: ['A', 'B'], seatsPerRow: 3 };
const seats: SeatDto[] = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].map((id) => ({
  seatId: id,
  row: id[0]!,
  number: Number(id[1]),
  status: id === 'A2' ? 'booked' : 'available',
}));

function Harness({ locked = false }: { locked?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <SeatMap layout={layout} seats={seats} selected={selected} locked={locked} onSelect={setSelected} />;
}

describe('SeatMap', () => {
  it('labels seats with their state and toggles one seat at a time', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Seat A2, booked' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Seat A1, available' }));
    expect(screen.getByRole('button', { name: 'Seat A1, selected' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Seat B3, available' }));
    expect(screen.getByRole('button', { name: 'Seat B3, selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat A1, available' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores clicks on booked seats', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Seat A2, booked' }));
    expect(screen.queryByRole('button', { name: /selected/ })).toBeNull();
  });

  it('is one tab stop with arrow-key navigation and Enter/Space to select', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Seat A1, available' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Seat A2, booked' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Seat B2, available' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Seat B2, selected' })).toHaveFocus();
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });

  it('cannot change the selection while locked', async () => {
    const user = userEvent.setup();
    render(<Harness locked />);
    await user.click(screen.getByRole('button', { name: 'Seat A1, available' }));
    expect(screen.queryByRole('button', { name: /selected/ })).toBeNull();
  });
});

describe('availability badge', () => {
  it('uses the singular for a one-seat event and "Sold out" at zero', () => {
    const { rerender } = render(availabilityBadge({ availableSeats: 1, totalSeats: 1 }));
    expect(screen.getByText('1 of 1 seat left')).toBeTruthy();
    rerender(availabilityBadge({ availableSeats: 42, totalSeats: 60 }));
    expect(screen.getByText('42 of 60 seats left')).toBeTruthy();
    rerender(availabilityBadge({ availableSeats: 0, totalSeats: 60 }));
    expect(screen.getByText('Sold out')).toBeTruthy();
  });
});

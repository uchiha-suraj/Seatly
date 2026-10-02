import type { SeatDto, SeatLayout } from '@seatly/shared';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/ui/Icon';

interface Props {
  layout: SeatLayout;
  seats: SeatDto[];
  selected: string | null;
  locked: boolean;
  onSelect(seatId: string | null): void;
}

/**
 * One tab stop (roving tabindex). Arrow keys move, Enter/Space toggles. Booked seats stay
 * focusable so screen-reader users hear why they can't be chosen. State is shown by fill,
 * outline AND icon, never colour alone.
 */
export function SeatMap({ layout, seats, selected, locked, onSelect }: Props) {
  const byId = useMemo(() => new Map(seats.map((s) => [s.seatId, s])), [seats]);
  const grid = useMemo(
    () => layout.rows.map((row) => Array.from({ length: layout.seatsPerRow }, (_, i) => `${row}${i + 1}`)),
    [layout],
  );
  const firstAvailable = seats.find((s) => s.status === 'available')?.seatId ?? grid[0]?.[0] ?? null;
  const [focusId, setFocusId] = useState<string | null>(selected ?? firstAvailable);
  const activeId = focusId && byId.has(focusId) ? focusId : (selected ?? firstAvailable);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the selected seat visible inside the horizontally scrolling map on small screens.
  // Only the map scrolls sideways; the page itself is never scrolled by this.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const seat = selected ? refs.current.get(selected) : undefined;
    const scroller = scrollerRef.current;
    if (!seat || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const seatBox = seat.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    scroller.scrollLeft += seatBox.left + seatBox.width / 2 - (box.left + box.width / 2);
  }, [selected]);

  function move(e: KeyboardEvent, seatId: string) {
    const r = layout.rows.indexOf(seatId.slice(0, 1));
    const c = Number(seatId.slice(1)) - 1;
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    let next: string | undefined;
    if (delta[e.key]) {
      const [dr, dc] = delta[e.key]!;
      next = grid[r + dr]?.[c + dc];
    } else if (e.key === 'Home') next = grid[r]?.[0];
    else if (e.key === 'End') next = grid[r]?.[layout.seatsPerRow - 1];
    if (next) {
      e.preventDefault();
      setFocusId(next);
      refs.current.get(next)?.focus();
    }
  }

  return (
    <div ref={scrollerRef} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="seat-scroller">
      <div className="mx-auto flex w-max flex-col items-center gap-1.5 sm:gap-2">
        <div className="flex h-7 w-full items-center justify-center rounded-sm bg-subtle text-xs font-semibold tracking-[0.06em] text-ink-3 sm:h-8">
          STAGE
        </div>
        <div role="grid" aria-label="Seat map" aria-disabled={locked || undefined} className="flex flex-col gap-1.5 sm:gap-2">
          {grid.map((rowSeats, ri) => (
            <div role="row" key={layout.rows[ri]} className="flex items-center gap-1.5 sm:gap-2">
              <span className="sticky left-0 z-10 flex w-5 shrink-0 items-center justify-center self-stretch bg-surface text-xs font-medium text-ink-3 max-sm:-left-4 max-sm:-ml-4 max-sm:w-9 max-sm:pl-4 max-sm:shadow-[6px_0_0_var(--color-surface),12px_0_8px_-4px_var(--color-surface)]" aria-hidden="true">
                {layout.rows[ri]}
              </span>
              {rowSeats.map((seatId, ci) => {
                const seat = byId.get(seatId);
                const booked = !seat || seat.status === 'booked';
                const isSelected = selected === seatId;
                const label = `Seat ${seatId}, ${isSelected ? 'selected' : booked ? 'booked' : 'available'}`;
                const look = isSelected
                  ? 'bg-brand text-white font-semibold'
                  : booked
                    ? 'bg-seat-booked text-seat-booked-text'
                    : 'border-[1.5px] border-line-strong bg-surface text-ink hover:bg-brand-subtle';
                return (
                  <div role="gridcell" key={seatId} className={ci === Math.floor(layout.seatsPerRow / 2) && layout.seatsPerRow > 2 ? 'ml-3 sm:ml-4' : ''}>
                    <button
                      ref={(el) => {
                        if (el) refs.current.set(seatId, el);
                        else refs.current.delete(seatId);
                      }}
                      type="button"
                      tabIndex={seatId === activeId ? 0 : -1}
                      aria-label={label}
                      aria-pressed={isSelected}
                      aria-disabled={booked || locked || undefined}
                      onFocus={() => setFocusId(seatId)}
                      onKeyDown={(e) => move(e, seatId)}
                      onClick={() => {
                        if (booked || locked) return;
                        onSelect(isSelected ? null : seatId);
                      }}
                      className={`flex size-11 flex-col items-center justify-center rounded-t-[10px] rounded-b-[4px] text-xs leading-4 sm:size-10 ${look} ${locked ? 'cursor-not-allowed opacity-60' : booked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isSelected && <Icon name="check" size={12} />}
                      {booked && !isSelected && <Icon name="x" size={12} />}
                      <span>{seatId.slice(1)}</span>
                    </button>
                  </div>
                );
              })}
              <span className="w-5 text-center text-xs font-medium text-ink-3" aria-hidden="true">
                {layout.rows[ri]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SeatLegend() {
  const item = (cls: string, icon: 'check' | 'x' | null, text: string) => (
    <li className="flex items-center gap-2">
      <span className={`flex size-6 items-center justify-center rounded-t-[6px] rounded-b-[4px] ${cls}`} aria-hidden="true">
        {icon && <Icon name={icon} size={14} />}
      </span>
      {text}
    </li>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2" aria-label="Seat legend">
      {item('border-[1.5px] border-line-strong bg-surface', null, 'Available')}
      {item('bg-brand text-white', 'check', 'Your selection')}
      {item('bg-seat-booked text-seat-booked-text', 'x', 'Booked')}
    </ul>
  );
}

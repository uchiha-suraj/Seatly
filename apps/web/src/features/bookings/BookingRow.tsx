import type { BookingDto } from '@seatly/shared';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateBlock, formatShort } from '../../lib/format';

export function BookingRow({ booking }: { booking: BookingDto }) {
  const d = formatDateBlock(booking.event.startsAt, booking.event.timezone);
  return (
    <li className="relative flex items-center gap-3 rounded-lg border border-line bg-surface p-4 focus-within:ring-2 focus-within:ring-brand hover:border-line-strong sm:gap-5 sm:p-5">
      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-md bg-brand-subtle text-brand" aria-hidden="true">
        <span className="text-xs font-semibold tracking-[0.06em]">{d.month}</span>
        <span className="text-2xl leading-8 font-semibold">{d.day}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="font-semibold">
          <Link to={`/bookings/${booking.id}`} className="outline-none after:absolute after:inset-0">
            {booking.event.title}
          </Link>
        </h2>
        <p className="text-sm text-ink-2">
          {formatShort(booking.event.startsAt, booking.event.timezone)} · {booking.event.venue}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Badge tone="brand">Seat {booking.seat.seatId}</Badge>
          <span className="font-mono text-[13px] text-ink-2">{booking.reference}</span>
        </div>
      </div>
      <Icon name="chevron-right" className="shrink-0 text-ink-3" />
    </li>
  );
}

export function BookingRowSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5" aria-hidden="true">
      <Skeleton className="size-16 rounded-md" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-5 w-32" />
      </div>
    </li>
  );
}

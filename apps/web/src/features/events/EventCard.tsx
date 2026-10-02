import type { EventSummaryDto } from '@seatly/shared';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCardDate } from '../../lib/format';

export function availabilityBadge(e: { availableSeats: number; totalSeats: number }) {
  if (e.availableSeats === 0) return <Badge tone="error">Sold out</Badge>;
  const text = `${e.availableSeats} of ${e.totalSeats} seats left`;
  return <Badge tone={e.availableSeats <= 5 ? 'warning' : 'success'}>{text}</Badge>;
}

/** The whole card is one link; the title is its accessible name. */
export function EventCard({ event }: { event: EventSummaryDto }) {
  const soldOut = event.availableSeats === 0;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition-shadow focus-within:ring-2 focus-within:ring-brand hover:shadow-md">
      <img src={event.imageUrl} alt={event.imageAlt} className={`aspect-[2/1] w-full object-cover ${soldOut ? 'opacity-60' : ''}`} loading="lazy" />
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="text-xs font-semibold tracking-[0.06em] text-brand">{formatCardDate(event.startsAt, event.timezone)}</p>
        <h2 className="text-lg leading-[26px] font-semibold tracking-tight">
          <Link to={`/events/${event.id}`} className="outline-none after:absolute after:inset-0">
            {event.title}
          </Link>
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <Icon name="map-pin" size={16} className="text-ink-3" />
          {event.venue}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1.5">
          {availabilityBadge(event)}
          <span className="ml-auto flex items-center gap-0.5 text-sm font-medium text-brand" aria-hidden="true">
            {soldOut ? 'View event' : 'View seats'}
            <Icon name="chevron-right" size={16} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card" aria-hidden="true">
      <Skeleton className="aspect-[2/1] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { listEvents } from '../../api/endpoints';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { EventCard, EventCardSkeleton } from './EventCard';

export function EventListPage() {
  const location = useLocation();
  const loggedOut = (location.state as { loggedOut?: boolean } | null)?.loggedOut;
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents, staleTime: 30_000 });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 pb-10 sm:gap-8 sm:px-8 sm:pt-12 lg:px-16">
      {loggedOut && (
        <Alert tone="success" title="You’re logged out">
          Log in again any time to book seats.
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-10 font-semibold tracking-tight">Upcoming events</h1>
        <p className="max-w-[760px] text-ink-2 sm:text-lg">
          Pick an event, choose a seat and book it instantly. Seat counts are a live-ish snapshot — the booking step always has the final word.
        </p>
      </div>

      {events.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.isError ? (
        <div className="flex max-w-xl flex-col items-start gap-4">
          <Alert tone="error" title="We couldn’t load events" urgent>
            Check your connection and try again.
          </Alert>
          <Button onClick={() => events.refetch()}>Try again</Button>
        </div>
      ) : events.data.length === 0 ? (
        <div className="flex max-w-xl flex-col items-center gap-2.5 rounded-lg border border-line bg-surface p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-ink-2">
            <Icon name="calendar" size={24} />
          </span>
          <h2 className="text-lg font-semibold">No upcoming events</h2>
          <p className="text-sm text-ink-2">New events will appear here as soon as they’re added.</p>
          <Button variant="secondary" onClick={() => events.refetch()}>
            Refresh
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {events.data.map((e) => (
            <li key={e.id} className="flex">
              <EventCard event={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

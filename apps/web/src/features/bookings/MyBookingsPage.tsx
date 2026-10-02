import { useQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../api/endpoints';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { BookingRow, BookingRowSkeleton } from './BookingRow';

export function MyBookingsPage() {
  const bookings = useQuery({ queryKey: ['myBookings'], queryFn: listMyBookings, staleTime: 30_000 });
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-4 pt-6 pb-12 sm:gap-6 sm:pt-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] leading-10 font-semibold tracking-tight">My bookings</h1>
        {bookings.data && bookings.data.length > 0 && (
          <p className="text-sm text-ink-2 sm:text-base">
            {bookings.data.length} {bookings.data.length === 1 ? 'booking' : 'bookings'} · most recently booked first
          </p>
        )}
      </div>
      {bookings.isError && (
        <div className="flex flex-col items-start gap-4">
          <Alert tone="error" title="We couldn’t load your bookings" urgent className="w-full">
            Check your connection and try again.
          </Alert>
          <Button onClick={() => bookings.refetch()}>Try again</Button>
        </div>
      )}
      {bookings.isPending ? (
        <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading bookings">
          {[0, 1, 2].map((i) => (
            <BookingRowSkeleton key={i} />
          ))}
        </ul>
      ) : bookings.data?.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-lg border border-line bg-surface p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <Icon name="ticket" size={24} />
          </span>
          <h2 className="text-lg font-semibold">No bookings yet</h2>
          <p className="text-sm text-ink-2">When you book a seat, it’ll show up here with its reference.</p>
          <ButtonLink to="/">Browse events</ButtonLink>
        </div>
      ) : bookings.data ? (
        <ul className="flex flex-col gap-3">
          {bookings.data.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

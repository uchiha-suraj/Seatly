import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { getBooking } from '../../api/endpoints';
import { NotFoundPage } from '../../components/NotFoundPage';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatBookedAt, formatLong } from '../../lib/format';

/** Confirmation ("You're booked") right after booking, calmer "Booking details" when revisited. */
export function BookingDetailsPage() {
  const { bookingId = '' } = useParams();
  const location = useLocation();
  const justBooked = (location.state as { justBooked?: boolean } | null)?.justBooked === true;
  const booking = useQuery({ queryKey: ['booking', bookingId], queryFn: () => getBooking(bookingId), staleTime: 5 * 60_000 });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (booking.data) headingRef.current?.focus();
  }, [booking.data]);

  if (booking.isError && booking.error instanceof ApiError && booking.error.status === 404) return <NotFoundPage />;

  if (booking.isPending || booking.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-10" aria-busy={booking.isPending}>
        {booking.isError ? (
          <>
            <p className="font-semibold">We couldn’t load this booking.</p>
            <Button onClick={() => booking.refetch()}>Try again</Button>
          </>
        ) : (
          <>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        )}
      </div>
    );
  }

  const b = booking.data;
  const rows: [string, string][] = [
    ['Event', b.event.title],
    ['Date & time', formatLong(b.event.startsAt, b.event.timezone)],
    ['Venue', b.event.venue],
    ['Seat', `${b.seat.seatId} (Row ${b.seat.row}, Seat ${b.seat.number})`],
    ['Booked on', formatBookedAt(b.bookedAt)],
    ['Booked by', `${b.bookedBy.name} · ${b.bookedBy.email}`],
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(b.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-8 pb-12 sm:gap-6 sm:pt-14">
      {justBooked ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-success-line bg-success-bg text-success sm:size-14">
            <Icon name="check" size={28} />
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="text-[32px] leading-10 font-semibold tracking-tight outline-none">
            You’re booked
          </h1>
          <p className="text-ink-2 sm:text-lg">
            Seat {b.seat.seatId} is confirmed for {b.event.title}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Link to="/bookings" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <Icon name="arrow-left" size={16} />
            My bookings
          </Link>
          <div className="flex items-center gap-3">
            <h1 ref={headingRef} tabIndex={-1} className="text-[32px] leading-10 font-semibold tracking-tight outline-none">
              Booking details
            </h1>
            <Badge tone="success">Confirmed</Badge>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card sm:rounded-xl">
        <div className="flex items-center gap-4 bg-brand-subtle p-4 sm:px-8 sm:py-6">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.06em] text-brand">BOOKING REFERENCE</span>
            <span className="font-mono text-xl font-medium tracking-[0.04em]">{b.reference}</span>
          </div>
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Reference copied' : ''}
          </span>
        </div>
        <dl className="px-4 py-1 sm:px-8 sm:py-2">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4 sm:py-3.5 ${i < rows.length - 1 ? 'border-b border-line' : ''}`}>
              <dt className="text-xs text-ink-2 sm:w-36 sm:shrink-0 sm:text-sm">{k}</dt>
              <dd className={k === 'Seat' ? 'font-semibold' : ''}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {justBooked && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <ButtonLink to="/bookings" className="sm:flex-1">
              View my bookings
            </ButtonLink>
            <ButtonLink to="/" variant="secondary" className="sm:flex-1">
              Browse more events
            </ButtonLink>
          </div>
          <p className="text-center text-sm text-ink-3">
            No tickets or emails in this version — your booking lives in My bookings. Keep the reference if you need to quote it.
          </p>
        </>
      )}
    </div>
  );
}

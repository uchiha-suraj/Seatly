import type { Ref } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { seatLabel } from '../../lib/format';

/** The 12 Figma variants of the Booking panel (+ a generic error). */
export type PanelState =
  | 'loading'
  | 'noSeat'
  | 'selected'
  | 'loggedOut'
  | 'submitting'
  | 'retrying'
  | 'retryFailed'
  | 'conflict'
  | 'sessionExpired'
  | 'backFree'
  | 'backTaken'
  | 'soldOut'
  | 'error';

interface Props {
  state: PanelState;
  seatId: string | null;
  eventLine: string;
  totalSeats: number;
  errorMessage?: string;
  alertRef?: Ref<HTMLDivElement>;
  onBook(): void;
  onClear(): void;
  onLogin(): void;
  onRegister(): void;
  onRetry(): void;
  onCheckBookings(): void;
  onLoginAgain(): void;
  onBrowse(): void;
}

const LIVE: Partial<Record<PanelState, (s: string) => string>> = {
  submitting: (s) => `Booking seat ${s}…`,
  retrying: () => 'Still checking your booking…',
  retryFailed: () => 'We couldn’t confirm your booking.',
};

/** Desktop: sticky card in the right column. Mobile: sticky bottom sheet. */
export function BookingPanel({ alertRef, ...p }: Props) {
  const seat = p.seatId;
  const hasSeat = !!seat && ['selected', 'loggedOut', 'submitting', 'retrying', 'retryFailed', 'sessionExpired', 'backFree', 'error'].includes(p.state);
  const locked = p.state === 'submitting' || p.state === 'retrying';

  const alert = (() => {
    switch (p.state) {
      case 'retrying':
        return (
          <Alert tone="warning" title="Still checking your booking…">
            The connection dropped. We’re retrying the same request, so you can’t be booked twice.
          </Alert>
        );
      case 'retryFailed':
        return (
          <Alert tone="warning" title="We couldn’t confirm your booking" urgent ref={alertRef}>
            It may have gone through. Check My bookings first. “Try again” resends the same request, so it can’t create a second booking.
          </Alert>
        );
      case 'conflict':
        return (
          <Alert tone="error" title={`Seat ${seat ?? ''} was just taken`} urgent ref={alertRef}>
            Another attendee booked it a moment before you. We refreshed the seat map — choose another seat.
          </Alert>
        );
      case 'sessionExpired':
        return (
          <Alert tone="warning" title="Your session expired" urgent ref={alertRef}>
            Log in again to finish booking. We’ll bring you back to this event. Seat {seat} isn’t held while you’re away.
          </Alert>
        );
      case 'backFree':
        return (
          <Alert tone="success" title={`Seat ${seat} is still available`}>
            We refreshed availability after you logged in. It isn’t held — confirm to book it.
          </Alert>
        );
      case 'backTaken':
        return (
          <Alert tone="info" title={`Seat ${seat ?? ''} is no longer available`} ref={alertRef}>
            Someone booked it while you were logging in. We refreshed the seat map — pick another seat.
          </Alert>
        );
      case 'error':
        return (
          <Alert tone="error" title="That booking didn’t go through" urgent ref={alertRef}>
            {p.errorMessage ?? 'Please choose a seat again.'}
          </Alert>
        );
      default:
        return null;
    }
  })();

  const actions = (() => {
    switch (p.state) {
      case 'selected':
      case 'backFree':
        return (
          <>
            <Button className="w-full" onClick={p.onBook}>
              Book seat {seat}
            </Button>
            <Button variant="ghost" className="w-full" onClick={p.onClear}>
              Clear selection
            </Button>
          </>
        );
      case 'loggedOut':
        return (
          <>
            <Button className="w-full" onClick={p.onLogin}>
              Log in to book {seat}
            </Button>
            <Button variant="ghost" className="w-full" onClick={p.onRegister}>
              New here? Create an account
            </Button>
          </>
        );
      case 'submitting':
        return (
          <Button className="w-full" loading>
            Booking seat {seat}…
          </Button>
        );
      case 'retrying':
        return (
          <Button className="w-full" loading>
            Checking your booking…
          </Button>
        );
      case 'retryFailed':
        return (
          <>
            <Button className="w-full" onClick={p.onCheckBookings}>
              Check My bookings
            </Button>
            <Button variant="secondary" className="w-full" onClick={p.onRetry}>
              Try again
            </Button>
          </>
        );
      case 'sessionExpired':
        return (
          <Button className="w-full" onClick={p.onLoginAgain}>
            Log in again
          </Button>
        );
      case 'soldOut':
        return (
          <>
            <Button className="w-full" disabled>
              Sold out
            </Button>
            <Button variant="ghost" className="w-full" onClick={p.onBrowse}>
              Browse other events
            </Button>
          </>
        );
      default:
        return (
          <Button className="w-full" disabled>
            Select a seat to continue
          </Button>
        );
    }
  })();

  return (
    <section
      aria-label="Your booking"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-line bg-surface px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom))] shadow-sticky lg:sticky lg:top-[88px] lg:gap-5 lg:rounded-lg lg:border lg:p-6 lg:shadow-card"
    >
      <p className="sr-only" aria-live="polite">
        {LIVE[p.state]?.(seat ?? '') ?? ''}
      </p>
      {p.state === 'loading' ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading booking panel">
          <Skeleton className="hidden h-5 w-40 lg:block" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : (
        <>
          <div className="hidden flex-col gap-0.5 lg:flex">
            <h2 className="text-lg font-semibold">Your booking</h2>
            <p className="text-sm text-ink-2">{p.eventLine}</p>
          </div>
          {alert}
          <div className="flex items-center gap-3 rounded-md bg-subtle p-3 lg:flex-col lg:items-start lg:gap-1 lg:p-4">
            {hasSeat ? (
              <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-[0.06em] text-ink-3">SELECTED SEAT</span>
                <span className="flex items-center gap-2.5">
                  <span className="text-2xl leading-8 font-semibold lg:text-[32px] lg:leading-10">{seat}</span>
                  <span className="text-sm text-ink-2">{seatLabel(seat)}</span>
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{p.state === 'soldOut' ? 'Sold out' : 'No seat selected'}</span>
                <span className="text-sm text-ink-2">
                  {p.state === 'soldOut' ? `All ${p.totalSeats} seats are booked.` : 'Choose an available seat on the map.'}
                </span>
              </div>
            )}
          </div>
          {(p.state === 'selected' || p.state === 'loggedOut' || p.state === 'backFree') && (
            <p className="flex gap-2 text-sm text-ink-2">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-ink-3" />
              Selecting a seat doesn’t hold it. It’s yours only once you confirm.
            </p>
          )}
          <div className="flex flex-col gap-2">{actions}</div>
          <p className="text-xs text-ink-3 max-lg:hidden">{locked ? 'Seat map is locked until we hear back.' : 'One seat per booking.'}</p>
          {locked && <p className="text-xs text-ink-3 lg:hidden">Seat map is locked until we hear back.</p>}
        </>
      )}
    </section>
  );
}

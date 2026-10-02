import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { getEvent, getSeats } from '../../api/endpoints';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatLongRange, formatShort, formatShortRange } from '../../lib/format';
import { loginPath } from '../../lib/returnTo';
import { NotFoundPage } from '../../components/NotFoundPage';
import { meKey, useMe } from '../auth/useMe';
import { BookingPanel, type PanelState } from '../booking/BookingPanel';
import { loadPending } from '../booking/pendingAttempt';
import { useBookingAttempt } from '../booking/useBookingAttempt';
import { SeatLegend, SeatMap } from './SeatMap';

type IntentResult = 'backFree' | 'backTaken' | null;

export function EventDetailsPage() {
  const { eventId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => getEvent(eventId), staleTime: 5 * 60_000 });
  const seats = useQuery({ queryKey: ['seats', eventId], queryFn: () => getSeats(eventId), staleTime: 0, refetchOnWindowFocus: true });

  // A pending attempt (interrupted by a reload) owns the selection until it settles.
  const [selected, setSelected] = useState<string | null>(() => loadPending(eventId)?.seatId ?? null);
  const [intent, setIntent] = useState<IntentResult>(null);
  const [intentSeat, setIntentSeat] = useState<string | null>(null);
  const [intentHandled, setIntentHandled] = useState(() => loadPending(eventId) !== null);
  const alertRef = useRef<HTMLDivElement>(null);
  const resumed = useRef(false);

  const attempt = useBookingAttempt(eventId, {
    onSuccess(booking) {
      qc.setQueryData(['booking', booking.id], booking);
      void qc.invalidateQueries({ queryKey: ['events'] });
      void qc.invalidateQueries({ queryKey: ['myBookings'] });
      navigate(`/bookings/${booking.id}`, { state: { justBooked: true } });
    },
    onSettled() {
      void seats.refetch();
    },
    onUnauthenticated() {
      qc.setQueryData(meKey, null);
    },
    onAbandoned() {
      setSelected(null);
    },
  });

  const returnTo = (seatId: string | null) => `/events/${eventId}${seatId ? `?seat=${encodeURIComponent(seatId)}` : ''}`;

  // Seat intent after login (Flow A), derived once from a seat map fetched after this page
  // mounted: restore the seat only if it is still available, never auto-submit.
  if (!intentHandled && seats.data && seats.isFetchedAfterMount) {
    setIntentHandled(true);
    const wanted = params.get('seat')?.toUpperCase() ?? null;
    const fromAuth = (location.state as { fromAuth?: boolean } | null)?.fromAuth === true;
    if (wanted) {
      const free = seats.data.seats.some((s) => s.seatId === wanted && s.status === 'available');
      setSelected(free ? wanted : null);
      if (fromAuth) {
        setIntent(free ? 'backFree' : 'backTaken');
        setIntentSeat(wanted);
      }
    }
  }

  function select(seatId: string | null) {
    setSelected(seatId);
    setIntent(null);
    // Picking another seat abandons an uncertain attempt: the next booking gets a new key.
    if (attempt.state.status === 'retryFailed') attempt.discard();
    else if (attempt.state.status !== 'idle') attempt.reset();
  }

  // Mirror the selection in the URL (?seat=A7) so a refresh or the login round-trip keeps the intent.
  useEffect(() => {
    if (!intentHandled) return;
    const current = params.get('seat');
    if ((current ?? null) === selected) return;
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (selected) n.set('seat', selected);
        else n.delete('seat');
        return n;
      },
      { replace: true, state: location.state },
    );
  }, [selected, intentHandled, params, setParams, location.state]);

  // Resume an attempt interrupted by a reload: same seat, same idempotency key.
  useEffect(() => {
    if (resumed.current || me.isPending || !me.data) return;
    resumed.current = true;
    attempt.resume();
  }, [me.isPending, me.data, attempt]);

  // Alerts that need attention receive focus.
  useEffect(() => {
    const s = attempt.state.status;
    if (s === 'conflict' || s === 'sessionExpired' || s === 'retryFailed' || s === 'error' || intent === 'backTaken') alertRef.current?.focus();
  }, [attempt.state.status, intent]);

  if (event.isError && event.error instanceof ApiError && event.error.status === 404) return <NotFoundPage />;

  if (event.isError || seats.isError) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
        <BackLink />
        <Alert tone="error" title="We couldn’t load this event" urgent>
          Check your connection and try again. Nothing was booked.
        </Alert>
        <Button className="w-full sm:w-auto" onClick={() => void Promise.all([event.refetch(), seats.refetch()])}>
          Try again
        </Button>
      </div>
    );
  }

  const ev = event.data;
  const seatData = seats.data;
  const loading = !ev || !seatData || me.isPending;
  const st = attempt.state;

  const panelState: PanelState = (() => {
    if (loading) return 'loading';
    if (st.status === 'submitting') return 'submitting';
    if (st.status === 'retrying') return 'retrying';
    if (st.status === 'retryFailed') return 'retryFailed';
    if (st.status === 'conflict') return 'conflict';
    if (st.status === 'sessionExpired') return 'sessionExpired';
    if (st.status === 'error') return 'error';
    if (intent === 'backTaken' && !selected) return 'backTaken';
    if (selected && !me.data) return 'loggedOut';
    if (selected) return intent === 'backFree' ? 'backFree' : 'selected';
    if (seatData!.availableSeats === 0) return 'soldOut';
    return 'noSeat';
  })();
  const panelSeat = st.status !== 'idle' ? st.seatId : panelState === 'backTaken' ? intentSeat : selected;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-0 pb-72 sm:px-8 lg:px-16 lg:pt-6 lg:pb-16">
      <div className="px-4 sm:px-0">
        <BackLink />
      </div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-6 lg:gap-8">
          {ev ? (
            <img src={ev.imageUrl} alt={ev.imageAlt} className="aspect-[2/1] w-full object-cover sm:rounded-xl lg:aspect-[880/300]" />
          ) : (
            <Skeleton className="aspect-[2/1] w-full sm:rounded-xl lg:aspect-[880/300]" />
          )}
          <div className="flex flex-col gap-3 px-4 sm:px-0">
            {ev ? (
              <>
                <h1 className="text-[32px] leading-10 font-semibold tracking-tight lg:text-[40px] lg:leading-[48px]">{ev.title}</h1>
                <div className="flex flex-col gap-2 text-ink-2 sm:flex-row sm:flex-wrap sm:gap-6">
                  <span className="flex items-center gap-2">
                    <Icon name="calendar" size={18} className="text-ink-3" />
                    <span className="max-sm:hidden">{formatLongRange(ev.startsAt, ev.endsAt, ev.timezone)}</span>
                    <span className="sm:hidden">{formatShortRange(ev.startsAt, ev.endsAt, ev.timezone)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Icon name="map-pin" size={18} className="text-ink-3" />
                    {ev.venue}
                  </span>
                </div>
                <p className="max-w-[760px] text-ink-2 lg:text-lg">{ev.description}</p>
              </>
            ) : (
              <>
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </>
            )}
          </div>

          <section aria-labelledby="choose-seat" className="mx-4 flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:mx-0 lg:gap-6 lg:rounded-xl lg:p-8">
            <div className="flex items-center gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <h2 id="choose-seat" className="text-lg font-semibold lg:text-2xl">
                  Choose your seat
                </h2>
                {seatData && (
                  <p className="text-sm text-ink-2">
                    {seatData.availableSeats} of {seatData.totalSeats}
                    <span className="max-sm:hidden">{seatData.totalSeats === 1 ? ' seat' : ' seats'}</span> available · {seats.isFetching ? 'refreshing…' : 'updated just now'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void seats.refetch()}
                className="flex size-11 items-center justify-center gap-1.5 rounded-md border border-line text-sm font-medium text-brand hover:bg-brand-subtle lg:w-auto lg:border-0 lg:px-3"
                aria-label="Refresh seats"
              >
                <Icon name="refresh" size={18} className={seats.isFetching ? 'animate-spin' : ''} />
                <span className="hidden lg:inline">Refresh</span>
              </button>
            </div>
            <SeatLegend />
            {seatData ? (
              <SeatMap layout={seatData.layout} seats={seatData.seats} selected={selected} locked={attempt.busy} onSelect={(s) => select(s)} />
            ) : (
              <Skeleton className="h-72 w-full rounded-lg" />
            )}
            <p className="text-xs text-ink-3 sm:hidden">Swipe sideways to see every seat in a row.</p>
          </section>
        </div>

        <div className="lg:w-[384px] lg:shrink-0">
          <BookingPanel
            state={panelState}
            seatId={panelSeat}
            eventLine={ev ? `${formatShort(ev.startsAt, ev.timezone).replace(/ \d{4}/, '')} · ${ev.venue.split(',')[0]}` : ''}
            totalSeats={seatData?.totalSeats ?? 0}
            errorMessage={st.status === 'error' ? st.message : undefined}
            alertRef={alertRef}
            onBook={() => selected && attempt.book(selected)}
            onClear={() => select(null)}
            onLogin={() => navigate(loginPath(returnTo(selected)))}
            onRegister={() => navigate(`/register?returnTo=${encodeURIComponent(returnTo(selected))}`)}
            onRetry={attempt.retry}
            onCheckBookings={() => navigate('/bookings')}
            onLoginAgain={() => navigate(loginPath(returnTo(panelSeat), 'expired'))}
            onBrowse={() => navigate('/')}
          />
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-brand hover:underline">
      <Icon name="arrow-left" size={16} />
      All events
    </Link>
  );
}

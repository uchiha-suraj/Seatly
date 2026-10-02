import { ButtonLink } from './ui/Button';
import { Icon } from './ui/Icon';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 pt-24 pb-16 text-center sm:pt-40">
      <span className="flex size-14 items-center justify-center rounded-full bg-subtle text-ink-2 sm:size-16">
        <Icon name="compass" size={30} />
      </span>
      <p className="text-xs font-semibold tracking-[0.06em] text-ink-3">ERROR 404</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[32px] sm:leading-10">We couldn’t find that page</h1>
      <p className="text-ink-2 sm:text-lg">
        The link may be mistyped, or the event may no longer exist. Booking links only work for the account that made the booking.
      </p>
      <ButtonLink to="/" className="mt-2">
        Browse events
      </ButtonLink>
    </div>
  );
}

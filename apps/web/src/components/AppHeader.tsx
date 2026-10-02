import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate } from 'react-router';
import { logout } from '../api/endpoints';
import { meKey, useMe } from '../features/auth/useMe';
import { Button, buttonClass } from './ui/Button';
import { Icon } from './ui/Icon';

// Matches Figma: no visual active marker; NavLink still sets aria-current="page" for assistive tech.
const navClass = () => buttonClass('ghost', 'px-3');

export function AppHeader() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => {
      qc.setQueryData(meKey, null);
      qc.removeQueries({ queryKey: ['myBookings'] });
      qc.removeQueries({ queryKey: ['booking'] });
      navigate('/', { state: { loggedOut: true } });
    },
  });
  const user = me.data;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:h-16 sm:gap-8 sm:px-8 lg:px-16">
        <Link to="/" className="flex items-center gap-2 rounded-md" aria-label="Seatly home">
          <span className="flex size-7 items-center justify-center rounded-sm bg-brand text-white">
            <Icon name="ticket" size={16} />
          </span>
          <span className="text-lg font-semibold">Seatly</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={navClass}>
            Events
          </NavLink>
          {user && (
            <NavLink to="/bookings" className={navClass}>
              My bookings
            </NavLink>
          )}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1 sm:gap-2">
          {me.isPending ? null : user ? (
            <>
              <span className="hidden items-center gap-2 px-2 text-sm font-medium text-ink-2 sm:flex">
                <Icon name="user" size={18} />
                {user.name}
              </span>
              <NavLink to="/bookings" className={`${navClass()} sm:hidden`}>
                Bookings
              </NavLink>
              <Button variant="secondary" className="max-sm:hidden" loading={signOut.isPending} onClick={() => signOut.mutate()}>
                Log out
              </Button>
              <Button variant="ghost" className="px-3 sm:hidden" loading={signOut.isPending} onClick={() => signOut.mutate()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonClass('ghost', 'px-3')}>
                Log in
              </Link>
              <Link to="/register" className={buttonClass('secondary', 'max-sm:hidden')}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

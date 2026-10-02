import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Skeleton } from '../../components/ui/Skeleton';
import { loginPath } from '../../lib/returnTo';
import { useMe } from './useMe';

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <PageSkeleton />;
  if (!me.data) return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <PageSkeleton />;
  if (me.data) return <Navigate to="/" replace />;
  return <>{children}</>;
}

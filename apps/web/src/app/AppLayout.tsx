import { Outlet } from 'react-router';
import { AppHeader } from '../components/AppHeader';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line px-4 py-6 text-xs text-ink-3 sm:px-8 lg:px-16">Seatly — a portfolio demo. Seeded events, no payments.</footer>
    </div>
  );
}

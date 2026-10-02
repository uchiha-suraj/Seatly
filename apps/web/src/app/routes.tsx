import type { RouteObject } from 'react-router';
import { NotFoundPage } from '../components/NotFoundPage';
import { AuthPage } from '../features/auth/AuthPage';
import { GuestOnly, RequireAuth } from '../features/auth/guards';
import { BookingDetailsPage } from '../features/bookings/BookingDetailsPage';
import { MyBookingsPage } from '../features/bookings/MyBookingsPage';
import { EventDetailsPage } from '../features/events/EventDetailsPage';
import { EventListPage } from '../features/events/EventListPage';
import { AppLayout } from './AppLayout';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <EventListPage /> },
      { path: '/events/:eventId', element: <EventDetailsPage /> },
      { path: '/login', element: <GuestOnly><AuthPage key="login" mode="login" /></GuestOnly> },
      { path: '/register', element: <GuestOnly><AuthPage key="register" mode="register" /></GuestOnly> },
      { path: '/bookings', element: <RequireAuth><MyBookingsPage /></RequireAuth> },
      { path: '/bookings/:bookingId', element: <RequireAuth><BookingDetailsPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

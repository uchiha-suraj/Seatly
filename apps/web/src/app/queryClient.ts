import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

export function createQueryClient(): QueryClient {
  const qc: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        // Any 401 means the session is gone: the header and guards update immediately.
        if (err instanceof ApiError && err.status === 401) qc.setQueryData(['me'], null);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        if (err instanceof ApiError && err.status === 401) qc.setQueryData(['me'], null);
      },
    }),
    defaultOptions: {
      queries: {
        // GETs retry twice on network/5xx, never on 4xx.
        retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
        refetchOnWindowFocus: false,
      },
      // Booking retries are handled by useBookingAttempt with the same idempotency key.
      mutations: { retry: false },
    },
  });
  return qc;
}

import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createQueryClient } from '../src/app/queryClient';
import { routes } from '../src/app/routes';

export function renderApp(path: string, state?: unknown) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  const url = new URL(path, 'http://localhost');
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: url.pathname, search: url.search, state }] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}

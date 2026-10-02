import { useQuery } from '@tanstack/react-query';
import { getMe } from '../../api/endpoints';

export const meKey = ['me'] as const;

/** null = anonymous. A 401 is an answer here, not an error. */
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: getMe, staleTime: 5 * 60_000 });
}

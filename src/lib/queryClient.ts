import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query client.
 *
 * Strategy:
 *  - `staleTime: 30s` — data is considered "fresh" for 30s, no refetch needed
 *  - `gcTime: 10min` — kept in memory 10min after last subscriber unmounts
 *  - `refetchOnWindowFocus: false` — too noisy, users tab-switch a lot
 *  - `retry: 1` — survive transient cold-start, but fail fast on real errors
 *  - `networkMode: 'always'` — survive flaky mobile network
 *
 * Per-query overrides can tighten or loosen these defaults (e.g. categories
 * use `staleTime: 1h` because they change rarely).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'always',
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
});

/**
 * Common cache keys used across the app. Centralising them helps invalidating
 * the right slice from anywhere (e.g. after an upload, invalidate ['resources']).
 */
export const queryKeys = {
  categories: ['categories'] as const,
  resources: (filters?: Record<string, unknown>) => ['resources', filters] as const,
  resource: (id: string) => ['resource', id] as const,
  profile: (id: string) => ['profile', id] as const,
  profilesMap: (ids: string[]) => ['profiles', ids.sort().join(',')] as const,
  comments: (resourceId: string) => ['comments', resourceId] as const,
  peerReviews: (resourceId: string) => ['peer-reviews', resourceId] as const,
  recommendations: (resourceId: string) => ['recommendations', resourceId] as const,
  adminStats: ['admin-stats'] as const,
};

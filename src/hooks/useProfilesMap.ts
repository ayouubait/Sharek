import { useQuery } from '@tanstack/react-query';
import { fetchProfilesMap, type ProfileInfo } from '@/lib/profiles';
import { queryKeys } from '@/lib/queryClient';

/**
 * Returns a cached map of user profiles, keyed by user id.
 *
 * Useful in lists (resources grid, comments, etc.) where we need to display
 * author name/avatar without refetching the same profile on every render.
 *
 * Cache strategy: 5 min stale, 30 min in memory. Profiles don't change often
 * (avatar, name, specialty).
 */
export function useProfilesMap(ids: string[]): {
  profiles: Record<string, ProfileInfo> | undefined;
  isLoading: boolean;
} {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.profilesMap(uniqueIds),
    queryFn: () => fetchProfilesMap(uniqueIds),
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return { profiles: data, isLoading };
}

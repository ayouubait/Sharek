import { supabase } from './supabase';
import { withTimeout } from './utils';

export interface ProfileInfo {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar_url: string | null;
  institution?: string;
  city?: string;
}

export function buildProfileMap(data: { id: string; name: string | null; initials: string | null; color: string | null; avatar_url: string | null; institution?: string | null; city?: string | null }[]): Record<string, ProfileInfo> {
  const map: Record<string, ProfileInfo> = {};
  data.forEach((p) => {
    map[p.id] = {
      id: p.id,
      name: p.name || 'Utilisateur',
      initials: p.initials || 'U',
      color: p.color || '#64748b',
      avatar_url: p.avatar_url || null,
      institution: p.institution || undefined,
      city: p.city || undefined,
    };
  });
  return map;
}

export async function fetchProfilesMap(ids: string[]): Promise<Record<string, ProfileInfo>> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return {};

  // Retry up to 2 times with 10s timeout - Supabase can be slow on cold queries
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, name, initials, color, avatar_url, institution, city')
          .in('id', uniqueIds),
        10000
      );
      if (!error && data) return buildProfileMap(data);
    } catch {
      // try again
    }
  }
  return {};
}

export function getDisplayProfile(
  id: string,
  profilesMap: Record<string, ProfileInfo> | undefined | null,
  overrides?: { name?: string; initials?: string; color?: string; avatar_url?: string | null }
): ProfileInfo {
  const profile = profilesMap?.[id];
  if (profile) return profile;

  return {
    id,
    name: overrides?.name || 'Utilisateur',
    initials: overrides?.initials || '?',
    color: overrides?.color || '#94a3b8',
    avatar_url: overrides?.avatar_url || null,
  };
}
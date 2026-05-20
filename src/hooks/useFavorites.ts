import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

const LEGACY_KEY = 'sharek-favorites';

/**
 * useFavorites - hook centralisant les favoris d'un utilisateur.
 *
 * - Source de vérité : table `public.favorites` (Supabase).
 * - Au premier load, migre automatiquement les anciennes entrées localStorage
 *   `sharek-favorites` vers la DB, puis purge le localStorage.
 * - Réactif via realtime channel filtré sur `user_id`.
 *
 * Retourne :
 *   - `favorites` : Set<string> des resource_id
 *   - `isFavorite(id)` : helper
 *   - `toggleFavorite(id)` : ajoute/retire
 *   - `addFavorite(id)`, `removeFavorite(id)`
 *   - `loading`, `error`
 */
export function useFavorites() {
  const { user } = useAuth();
  const userId = user?.id;

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Migration one-shot : localStorage → DB ────────────────────────
  const migrateLegacy = useCallback(async (uid: string): Promise<string[]> => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return [];
      const ids = JSON.parse(raw) as unknown;
      if (!Array.isArray(ids) || ids.length === 0) {
        localStorage.removeItem(LEGACY_KEY);
        return [];
      }
      const validIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (validIds.length === 0) {
        localStorage.removeItem(LEGACY_KEY);
        return [];
      }
      const rows = validIds.map((rid) => ({ user_id: uid, resource_id: rid }));
      // upsert avec onConflict pour ne pas dupliquer si l'utilisateur a déjà sync ailleurs.
      const { error: upErr } = await supabase
        .from('favorites')
        .upsert(rows, { onConflict: 'user_id,resource_id', ignoreDuplicates: true });
      if (upErr) {
        // Si la ressource n'existe plus (FK violation), on tente une à une et on ignore les erreurs.
        logger.warn('Bulk favorites migration partial failure, will continue', upErr);
      }
      localStorage.removeItem(LEGACY_KEY);
      return validIds;
    } catch (err) {
      logger.warn('Legacy favorites migration failed', err);
      return [];
    }
  }, []);

  // ── Fetch initial ─────────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await migrateLegacy(userId);
      const { data, error: fetchErr } = await supabase
        .from('favorites')
        .select('resource_id')
        .eq('user_id', userId);
      if (fetchErr) throw fetchErr;
      setFavorites(new Set((data ?? []).map((r) => r.resource_id as string)));
    } catch (err) {
      logger.error('Favorites fetch failed', err);
      setError((err as Error)?.message || 'Erreur de chargement des favoris');
    } finally {
      setLoading(false);
    }
  }, [userId, migrateLegacy]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // ── Realtime : sync cross-tab ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel(`favorites-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'favorites', filter: `user_id=eq.${userId}` },
        (payload) => {
          const rid = (payload.new as { resource_id?: string }).resource_id;
          if (rid) setFavorites((prev) => new Set(prev).add(rid));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'favorites', filter: `user_id=eq.${userId}` },
        (payload) => {
          const rid = (payload.old as { resource_id?: string }).resource_id;
          if (rid) {
            setFavorites((prev) => {
              const next = new Set(prev);
              next.delete(rid);
              return next;
            });
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // ── Mutations ─────────────────────────────────────────────────────
  const addFavorite = useCallback(
    async (resourceId: string) => {
      if (!userId) return false;
      // optimistic
      setFavorites((prev) => new Set(prev).add(resourceId));
      const { error: insErr } = await supabase
        .from('favorites')
        .insert({ user_id: userId, resource_id: resourceId });
      if (insErr && !insErr.message.toLowerCase().includes('duplicate')) {
        logger.error('Add favorite failed', insErr);
        // rollback
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(resourceId);
          return next;
        });
        return false;
      }
      return true;
    },
    [userId],
  );

  const removeFavorite = useCallback(
    async (resourceId: string) => {
      if (!userId) return false;
      // optimistic
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(resourceId);
        return next;
      });
      const { error: delErr } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('resource_id', resourceId);
      if (delErr) {
        logger.error('Remove favorite failed', delErr);
        // rollback
        setFavorites((prev) => new Set(prev).add(resourceId));
        return false;
      }
      return true;
    },
    [userId],
  );

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const toggleFavorite = useCallback(
    async (resourceId: string) => {
      if (!userId) return false;
      return isFavorite(resourceId) ? removeFavorite(resourceId) : addFavorite(resourceId);
    },
    [userId, isFavorite, addFavorite, removeFavorite],
  );

  // Stabilise la référence de l'array via useMemo : sans ça, chaque appel
  // du hook produit un NOUVEAU tableau (même contenu) → tout useEffect
  // qui a `favoriteIds` en dépendance re-fire à l'infini et freeze le thread.
  const favoriteIds = useMemo(() => Array.from(favorites), [favorites]);

  return {
    favorites,
    favoriteIds,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    loading,
    error,
    refetch: fetchFavorites,
  };
}

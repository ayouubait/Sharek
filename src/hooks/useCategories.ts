import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: 'level' | 'type' | 'unit' | 'specialty' | 'comment_type';
  sort_order: number;
  is_active: boolean;
  parent_slug: string | null;
}

const DEFAULT_CATEGORIES: Category[] = [
  // Levels
  { id: 'c1', name: 'Collège', slug: 'college', type: 'level', sort_order: 1, is_active: true, parent_slug: null },
  { id: 'c2', name: 'Tronc commun scientifique', slug: 'tcs', type: 'level', sort_order: 2, is_active: true, parent_slug: null },
  { id: 'c3', name: 'Bac sciences', slug: 'bac_sciences', type: 'level', sort_order: 3, is_active: true, parent_slug: null },
  { id: 'c4', name: 'Tous niveaux', slug: 'all_levels', type: 'level', sort_order: 4, is_active: true, parent_slug: null },
  // Types
  { id: 'c5', name: 'Cours', slug: 'course', type: 'type', sort_order: 1, is_active: true, parent_slug: null },
  { id: 'c6', name: 'Fiche de travail', slug: 'worksheet', type: 'type', sort_order: 2, is_active: true, parent_slug: null },
  { id: 'c7', name: 'Évaluation', slug: 'evaluation', type: 'type', sort_order: 3, is_active: true, parent_slug: null },
  { id: 'c8', name: 'Activité pratique', slug: 'practical', type: 'type', sort_order: 4, is_active: true, parent_slug: null },
  { id: 'c9', name: 'Simulation', slug: 'simulation', type: 'type', sort_order: 5, is_active: true, parent_slug: null },
  { id: 'c10', name: 'Diaporama', slug: 'slides', type: 'type', sort_order: 6, is_active: true, parent_slug: null },
  // Specialties
  { id: 'c26', name: 'Sciences de la Vie et de la Terre', slug: 'svt', type: 'specialty', sort_order: 1, is_active: true, parent_slug: null },
  { id: 'c27', name: 'Sciences Physiques', slug: 'sp', type: 'specialty', sort_order: 2, is_active: true, parent_slug: null },
  { id: 'c28', name: 'Mathématiques', slug: 'maths', type: 'specialty', sort_order: 3, is_active: true, parent_slug: null },
  { id: 'c29', name: 'Chimie', slug: 'chimie', type: 'specialty', sort_order: 4, is_active: true, parent_slug: null },
  { id: 'c30', name: 'Physique', slug: 'physique', type: 'specialty', sort_order: 5, is_active: true, parent_slug: null },
];

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('categories')
      .select('id, name, slug, type, sort_order, is_active, parent_slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    8000
  );
  if (error) throw error;
  if (!data || data.length === 0) return DEFAULT_CATEGORIES;
  return data.map((d) => ({
    id: String(d.id),
    name: d.name,
    slug: d.slug,
    type: d.type as Category['type'],
    sort_order: d.sort_order ?? 0,
    is_active: d.is_active,
    parent_slug: d.parent_slug ?? null,
  }));
}

export function useCategories() {
  const { data: categories = DEFAULT_CATEGORIES, isLoading, error } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    staleTime: 60 * 60 * 1000, // 1 hour - categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // 24 hours in memory
    retry: 2,
    placeholderData: DEFAULT_CATEGORIES,
  });

  const levels = useMemo(
    () => categories.filter((c) => c.type === 'level' && c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const types = useMemo(
    () => categories.filter((c) => c.type === 'type' && c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const units = useMemo(
    () => categories.filter((c) => c.type === 'unit' && c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const specialties = useMemo(
    () => categories.filter((c) => c.type === 'specialty' && c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const unitsByParentSlug = useCallback(
    (parentSlug: string | null | undefined) =>
      parentSlug ? units.filter((u) => u.parent_slug === parentSlug) : [],
    [units]
  );

  const typeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    types.forEach((t) => { map[t.slug] = t.name; });
    return map;
  }, [types]);

  const levelLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    levels.forEach((l) => { map[l.slug] = l.name; });
    return map;
  }, [levels]);

  return {
    categories,
    levels,
    types,
    units,
    specialties,
    loading: isLoading,
    error: error?.message || null,
    unitsByParentSlug,
    typeLabelMap,
    levelLabelMap,
  };
}

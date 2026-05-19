import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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

  // Units - college
  { id: 'c11', name: 'Les êtres vivants et leur environnement', slug: 'etres_vivants', type: 'unit', sort_order: 1, is_active: true, parent_slug: 'college' },
  { id: 'c12', name: 'La matière et ses transformations', slug: 'matiere_transformations', type: 'unit', sort_order: 2, is_active: true, parent_slug: 'college' },
  { id: 'c13', name: 'La Terre et l\'univers', slug: 'terre_univers', type: 'unit', sort_order: 3, is_active: true, parent_slug: 'college' },
  { id: 'c14', name: 'Les reproductions chez les êtres vivants', slug: 'reproduction_vivants', type: 'unit', sort_order: 4, is_active: true, parent_slug: 'college' },
  { id: 'c15', name: 'La nutrition et les organes digestifs', slug: 'nutrition', type: 'unit', sort_order: 5, is_active: true, parent_slug: 'college' },
  { id: 'c16', name: 'La respiration et les échanges gazeux', slug: 'respiration', type: 'unit', sort_order: 6, is_active: true, parent_slug: 'college' },

  // Units - TCS
  { id: 'c17', name: 'La cellule et les échanges avec le milieu', slug: 'cellule', type: 'unit', sort_order: 1, is_active: true, parent_slug: 'tcs' },
  { id: 'c18', name: 'La reproduction et l\'hérédité', slug: 'reproduction', type: 'unit', sort_order: 2, is_active: true, parent_slug: 'tcs' },
  { id: 'c19', name: 'Les équilibres naturels', slug: 'equilibres_naturels', type: 'unit', sort_order: 3, is_active: true, parent_slug: 'tcs' },
  { id: 'c20', name: 'L\'organisme et sa relation avec le milieu', slug: 'organisme', type: 'unit', sort_order: 4, is_active: true, parent_slug: 'tcs' },

  // Units - Bac
  { id: 'c21', name: 'Les métabolismes cellulaires', slug: 'metabolismes', type: 'unit', sort_order: 1, is_active: true, parent_slug: 'bac_sciences' },
  { id: 'c22', name: 'Le système nerveux', slug: 'systeme_nerveux', type: 'unit', sort_order: 2, is_active: true, parent_slug: 'bac_sciences' },
  { id: 'c23', name: 'La biologie et l\'environnement', slug: 'biologie_environnement', type: 'unit', sort_order: 3, is_active: true, parent_slug: 'bac_sciences' },
  { id: 'c24', name: 'La génétique humaine', slug: 'genetique', type: 'unit', sort_order: 4, is_active: true, parent_slug: 'bac_sciences' },
  { id: 'c25', name: 'Les biotechnologies', slug: 'biotechnologies', type: 'unit', sort_order: 5, is_active: true, parent_slug: 'bac_sciences' },

  // Specialties
  { id: 'c26', name: 'Sciences de la Vie et de la Terre', slug: 'svt', type: 'specialty', sort_order: 1, is_active: true, parent_slug: null },
  { id: 'c27', name: 'Sciences Physiques', slug: 'sp', type: 'specialty', sort_order: 2, is_active: true, parent_slug: null },
  { id: 'c28', name: 'Mathématiques', slug: 'maths', type: 'specialty', sort_order: 3, is_active: true, parent_slug: null },
  { id: 'c29', name: 'Chimie', slug: 'chimie', type: 'specialty', sort_order: 4, is_active: true, parent_slug: null },
  { id: 'c30', name: 'Physique', slug: 'physique', type: 'specialty', sort_order: 5, is_active: true, parent_slug: null },
];

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: supaError } = await supabase
        .from('categories')
        .select('id, name, slug, type, sort_order, is_active, parent_slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (supaError) throw supaError;

      if (data && data.length > 0) {
        const mapped: Category[] = data.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug,
          type: d.type as Category['type'],
          sort_order: d.sort_order ?? 0,
          is_active: d.is_active,
          parent_slug: d.parent_slug ?? null,
        }));
        setCategories(mapped);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des catégories');
      // Garde les valeurs par défaut en fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
    types.forEach((t) => {
      map[t.slug] = t.name;
    });
    return map;
  }, [types]);

  const levelLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    levels.forEach((l) => {
      map[l.slug] = l.name;
    });
    return map;
  }, [levels]);

  return {
    categories,
    levels,
    types,
    units,
    specialties,
    loading,
    error,
    unitsByParentSlug,
    typeLabelMap,
    levelLabelMap,
    refresh: fetchCategories,
  };
}
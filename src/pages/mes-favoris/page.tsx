import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import { useFavorites } from '@/hooks/useFavorites';
import { logger } from '@/lib/logger';
import type { Resource } from '@/mocks/data';
import MainLayout from '@/components/layout/MainLayout';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import StatusBadge from '@/pages/ressource-detail/components/StatusBadge';
import { getTypeConfig } from '@/lib/typeConfig';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MesFavoris() {
  const navigate = useNavigate();
  const { favoriteIds, loading: favoritesLoading, removeFavorite: removeFavoriteDB } = useFavorites();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();

  // Fetch resources when favoriteIds change
  useEffect(() => {
    if (favoritesLoading) return;
    if (favoriteIds.length === 0) {
      setResources([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchResources() {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('resources')
            .select(
              'id, title, school_level, unit, type, type_label, file_url, file_type, cover_image_url, objectives, competencies, duration, keywords, status, status_label, author_id, created_at, views, downloads, comments_count, subject'
            )
            .in('id', favoriteIds)
            .order('created_at', { ascending: false }),
          8000
        );

        if (cancelled) return;
        if (error) throw error;

        const supaResources: Resource[] = (data || []).map((r) => ({
          id: r.id,
          title: r.title,
          school_level: r.school_level,
          unit: r.unit,
          type: r.type,
          type_label: r.type_label,
          file_url: r.file_url || '',
          file_type: r.file_type || '',
          cover_image_url: r.cover_image_url || null,
          objectives: r.objectives,
          competencies: r.competencies,
          duration: r.duration,
          keywords: r.keywords || [],
          status: r.status || 'not_evaluated',
          status_label: r.status_label || 'Non évalué',
          author_id: r.author_id,
          created_at: r.created_at,
          views: r.views || 0,
          downloads: r.downloads || 0,
          comments_count: r.comments_count || 0,
          subject: r.subject,
        }));

        setResources(supaResources);

        const authorIds = [...new Set(supaResources.map((r) => r.author_id).filter(Boolean))];
        if (authorIds.length > 0) {
          const profiles = await fetchProfilesMap(authorIds);
          if (!cancelled) setAuthorProfiles(profiles);
        }
      } catch (err) {
        logger.error('Favorites resource fetch failed', err);
        if (!cancelled) setResources([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchResources();
    return () => {
      cancelled = true;
    };
  }, [favoriteIds, favoritesLoading]);

  function removeFavorite(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Optimistic UI: remove from local list immediately, then sync DB.
    setResources((prev) => prev.filter((r) => r.id !== id));
    removeFavoriteDB(id);
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <nav className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:text-sharek-600 transition-colors"
            >
              Tableau de bord
            </button>
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-arrow-right-s-line" />
            </div>
            <span className="text-slate-800 font-medium">Mes favoris</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-800">Mes ressources favorites</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Retrouvez ici toutes les ressources que vous avez ajoutées à vos favoris.
          </p>
        </div>
        <a
          href="/ressources"
          onClick={(e) => {
            e.preventDefault();
            navigate('/ressources');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-search-line" />
          </div>
          Explorer les ressources
        </a>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin" />
              </div>
              Chargement des favoris...
            </span>
          ) : (
            <>
              <span className="font-medium text-slate-800">{resources.length}</span> ressource
              {resources.length > 1 ? 's' : ''} en favori
              {resources.length > 1 ? 's' : ''}
            </>
          )}
        </p>
      </div>

      {/* Grid or empty state */}
      {!loading && resources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-heart-3-line text-2xl" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun favori pour le moment</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Cliquez sur le cœur sur une ressource pour l'ajouter à vos favoris et la retrouver ici.
          </p>
          <a
            href="/ressources"
            onClick={(e) => {
              e.preventDefault();
              navigate('/ressources');
            }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-folder-open-line" />
            </div>
            Parcourir les ressources
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {resources.map((resource) => {
            const author = getDisplayProfile(resource.author_id, authorProfiles || {});
            const typeCfg = getTypeConfig(resource.type, resource.type_label);
            return (
              <div
                key={resource.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft hover:shadow-card hover:border-slate-300 transition-all cursor-pointer flex flex-col overflow-hidden group relative"
              >
                {/* Remove favorite button */}
                <button
                  onClick={(e) => removeFavorite(resource.id, e)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Retirer des favoris"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-heart-fill text-sm" />
                  </div>
                </button>

                <div
                  onClick={() => navigate(`/ressources/${resource.id}`)}
                  className="flex-1 flex flex-col"
                >
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    {resource.cover_image_url ? (
                      <img
                        src={resource.cover_image_url}
                        alt={resource.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                          <div className="w-6 h-6 flex items-center justify-center">
                            <i className={`${typeCfg.icon} text-xl`} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{typeCfg.label}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2 flex-wrap">
                      <ResourceTypeBadge type={resource.type} bordered className="rounded-md" />
                      <div className="scale-90 origin-bottom-left">
                        <StatusBadge resource={resource} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-1">
                    <h3 className="text-base font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">
                      {resource.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-graduation-cap-line" />
                        </div>
                        {resource.school_level}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="truncate max-w-[140px]" title={resource.unit}>
                        {resource.unit}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-time-line" />
                        </div>
                        {resource.duration}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: author.color + '20',
                          color: author.color,
                        }}
                      >
                        {author.initials || '??'}
                      </div>
                      <span className="text-xs text-slate-600 truncate">
                        {author.name || 'Auteur inconnu'}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {formatDate(resource.created_at)}
                      </span>
                    </div>

                    {(resource.keywords || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(resource.keywords || []).slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                        {(resource.keywords || []).length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 text-xs">
                            +{(resource.keywords || []).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className="ri-eye-line" />
                      </div>
                      {resource.views}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className="ri-download-line" />
                      </div>
                      {resource.downloads}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className="ri-message-3-line" />
                      </div>
                      {resource.comments_count}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-sharek-600 font-medium">
                      Voir
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className="ri-arrow-right-line" />
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import type { Resource } from '@/mocks/data';
import { withTimeout } from '@/lib/utils';
import { getTypeConfig } from '@/lib/typeConfig';
import MainLayout from '@/components/layout/MainLayout';
import StatusBadge from '@/pages/ressource-detail/components/StatusBadge';
import { useCategories } from '@/hooks/useCategories';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ResourcesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isAdmin = user?.role === 'admin';
  const userSpecialty = user?.specialty;
  const { types, levels, typeLabelMap, specialties } = useCategories();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [autoFilterDiscipline, setAutoFilterDiscipline] = useState(() => {
    return !!userSpecialty && !isAdmin;
  });
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();

  useEffect(() => {
    if (userSpecialty && !isAdmin) {
      setAutoFilterDiscipline(true);
    }
  }, [userSpecialty, isAdmin]);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('resources')
        .select('id, title, school_level, unit, type, type_label, file_url, file_type, cover_image_url, objectives, competencies, duration, keywords, status, status_label, author_id, created_at, views, downloads, comments_count, subject')
        .order('created_at', { ascending: false }), 8000);

      if (error) throw error;

      const supaResources: Resource[] = (data || [])
        .map((r) => ({
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
        setAuthorProfiles(profiles);
      }
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.keywords || []).some((k) => k.toLowerCase().includes(search.toLowerCase())) ||
        r.unit.toLowerCase().includes(search.toLowerCase());
      const matchesLevel = !filterLevel || r.school_level === filterLevel;
      const matchesType = !filterType || r.type === filterType;
      const matchesStatus = !filterStatus || r.status === filterStatus;
      const matchesSubject = !filterSubject || (r.subject || '').toLowerCase() === filterSubject.toLowerCase();
      return matchesSearch && matchesLevel && matchesType && matchesStatus && matchesSubject;
    });
  }, [resources, search, filterLevel, filterType, filterStatus, filterSubject]);

  const schoolLevels = useMemo(() => {
    return Array.from(new Set(resources.map((r) => r.school_level)));
  }, [resources]);

  const typeSlugs = useMemo(() => {
    return Array.from(new Set(resources.map((r) => r.type)));
  }, [resources]);

  const statuses = useMemo(() => {
    return Array.from(new Set(resources.map((r) => r.status)));
  }, [resources]);

  const hasActiveFilters = search || filterLevel || filterType || filterStatus || filterSubject;

  function clearFilters() {
    setSearch('');
    setFilterLevel('');
    setFilterType('');
    setFilterStatus('');
    setFilterSubject('');
    setAutoFilterDiscipline(false);
    setSearchParams({});
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <button onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')} className="hover:text-sharek-600 transition-colors">
              Tableau de bord
            </button>
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-arrow-right-s-line" />
            </div>
            <span className="text-slate-800 dark:text-slate-100 font-medium">Ressources</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ressources pédagogiques</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Explorez, filtrez et découvrez les ressources partagées par la communauté ShareK.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isAdmin && userSpecialty && (
            <button
              onClick={() => setAutoFilterDiscipline((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                autoFilterDiscipline
                  ? 'bg-sharek-50 text-sharek-700 border-sharek-200'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <i className={autoFilterDiscipline ? 'ri-filter-fill' : 'ri-filter-line'} />
              </div>
              {autoFilterDiscipline ? `Ma discipline : ${userSpecialty}` : 'Toutes disciplines'}
            </button>
          )}
          <button
            onClick={() => navigate('/ressources/ajouter')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line" />
            </div>
            Ajouter une ressource
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-soft">
        <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-search-line" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.trim()) {
                  setSearchParams({ search: e.target.value.trim() });
                } else {
                  setSearchParams({});
                }
              }}
              placeholder="Rechercher par titre, mot-clé ou unité..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all"
            />
          </div>

          <div className="relative min-w-[160px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-graduation-cap-line" />
            </div>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Tous les niveaux</option>
              {levels.map((lvl) => (
                <option key={lvl.slug} value={lvl.name}>
                  {lvl.name}
                </option>
              ))}
              {schoolLevels.filter((sl) => !levels.some((l) => l.name === sl)).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line" />
            </div>
          </div>

          <div className="relative min-w-[160px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-folder-line" />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
              {typeSlugs.filter((ts) => !types.some((t) => t.slug === ts)).map((typeSlug) => (
                <option key={typeSlug} value={typeSlug}>
                  {typeLabelMap[typeSlug] || typeSlug}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line" />
            </div>
          </div>

          <div className="relative min-w-[160px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-flag-line" />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Tous les statuts</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'not_evaluated'
                    ? 'Non évalué'
                    : status === 'pending_reviewers'
                      ? 'En attente de reviewers'
                      : status === 'under_review'
                        ? 'En cours de peer reviewing'
                        : status === 'needs_revision'
                          ? 'À réviser'
                          : status === 'peer_reviewed'
                            ? 'Peer reviewed'
                            : status}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line" />
            </div>
          </div>

          <div className="relative min-w-[180px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-book-open-line" />
            </div>
            <select
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                if (e.target.value) setAutoFilterDiscipline(false);
              }}
              className="w-full pl-10 pr-8 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-900 focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Toutes les disciplines</option>
              {specialties.map((s) => (
                <option key={s.slug} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
              <i className="ri-arrow-down-s-line" />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:bg-slate-800/50 transition-colors whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-close-line" />
              </div>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin" />
              </div>
              Chargement des ressources...
            </span>
          ) : (
            <>
              <span className="font-medium text-slate-800 dark:text-slate-100">{filteredResources.length}</span> ressource
              {filteredResources.length > 1 ? 's' : ''} trouvée
              {filteredResources.length > 1 ? 's' : ''}
              {filterSubject && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sharek-50 text-sharek-700 border border-sharek-200">
                  <i className="ri-book-open-line" />
                  {filterSubject}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Resources grid */}
      {!loading && filteredResources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-soft">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-search-2-line text-2xl" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">Aucune ressource trouvée</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Essayez de modifier vos critères de recherche ou de filtre, ou ajoutez une nouvelle ressource à la
            plateforme.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-line" />
                </div>
                Réinitialiser les filtres
              </button>
            )}
            <button
              onClick={() => navigate('/ressources/ajouter')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Ajouter une ressource
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredResources.map((resource) => {
            const author = getDisplayProfile(resource.author_id, authorProfiles || {});
            const typeCfg = getTypeConfig(resource.type, resource.type_label);
            return (
              <div
                key={resource.id}
                onClick={() => navigate(`/ressources/${resource.id}`)}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft hover:shadow-card hover:border-slate-300 dark:border-slate-600 transition-all cursor-pointer flex flex-col overflow-hidden group"
              >
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {resource.cover_image_url ? (
                    <img
                      src={resource.cover_image_url}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <i className={`${typeCfg.icon} text-xl`} />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        {typeCfg.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1">
                  <div className="flex flex-wrap items-start gap-2 mb-3">
                    <ResourceTypeBadge type={resource.type} bordered className="rounded-md" />
                    <div className="scale-90 origin-top-right">
                      <StatusBadge resource={resource} size="sm" />
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-snug mb-2 line-clamp-2">
                    {resource.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3 flex-wrap">
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
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{author.name || 'Auteur inconnu'}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{formatDate(resource.created_at)}</span>
                  </div>

                  {(resource.keywords || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(resource.keywords || []).slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                      {(resource.keywords || []).length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-xs">
                          +{(resource.keywords || []).length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
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
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
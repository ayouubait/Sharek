import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import type { Resource } from '@/mocks/data';
import { withTimeout } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';
import StatusBadge from '@/pages/ressource-detail/components/StatusBadge';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import { getTypeConfig } from '@/lib/typeConfig';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MesRessources() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const currentUserId = user?.id;

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('resources')
        .select('*')
        .eq('author_id', currentUserId)
        .order('created_at', { ascending: false }), 8000);

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
      }));

      setResources(supaResources);
    } catch (err) {
      logger.error('Mes ressources fetch failed', err);
      toast.error('Impossible de charger vos ressources. Vérifiez votre connexion.');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, toast]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase())) ||
        r.unit.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !filterStatus || r.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [resources, search, filterStatus]);

  const stats = useMemo(() => {
    const total = resources.length;
    const totalViews = resources.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalDownloads = resources.reduce((sum, r) => sum + (r.downloads || 0), 0);
    const totalComments = resources.reduce((sum, r) => sum + (r.comments_count || 0), 0);
    const reviewed = resources.filter((r) => r.status === 'peer_reviewed').length;
    return { total, totalViews, totalDownloads, totalComments, reviewed };
  }, [resources]);

  const statuses = useMemo(() => {
    return Array.from(new Set(resources.map((r) => r.status)));
  }, [resources]);

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) {
        logger.error('Resource delete failed', error);
        toast.error("Impossible de supprimer la ressource. Réessayez.");
        return;
      }
      setResources((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
      toast.success('Ressource supprimée.');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!currentUserId) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-lock-line text-2xl" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700">Connexion requise</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-sm text-center">
            Connectez-vous pour accéder à vos ressources et les gérer.
          </p>
          <button
            onClick={() => navigate('/connexion')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-login-box-line" />
            </div>
            Se connecter
          </button>
        </div>
      </MainLayout>
    );
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
            <span className="text-slate-800 font-medium">Mes ressources</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-800">Mes ressources</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gérez les ressources que vous avez partagées sur ShareK.
          </p>
        </div>
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 md:p-5 shadow-soft">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-sharek-50 text-sharek-600 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                <i className="ri-folder-open-line" />
              </div>
            </div>
            <span className="text-xs md:text-sm text-slate-500 truncate">Ressources</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 md:p-5 shadow-soft">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-ocean-50 text-ocean-600 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                <i className="ri-eye-line" />
              </div>
            </div>
            <span className="text-xs md:text-sm text-slate-500 truncate">Vues totales</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 md:p-5 shadow-soft">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                <i className="ri-download-line" />
              </div>
            </div>
            <span className="text-xs md:text-sm text-slate-500 truncate">Téléchargements</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.totalDownloads.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 md:p-5 shadow-soft">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                <i className="ri-message-3-line" />
              </div>
            </div>
            <span className="text-xs md:text-sm text-slate-500 truncate">Commentaires</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.totalComments}</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-soft">
        <div className="flex flex-col sm:flex-row gap-3 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
              <i className="ri-search-line" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, mot-clé ou unité..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all"
            />
          </div>

          {/* Filter: Status */}
          <div className="relative min-w-0 w-full sm:w-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
              <i className="ri-flag-line" />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-48 pl-10 pr-8 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sharek-400 focus:ring-2 focus:ring-sharek-100 outline-none transition-all appearance-none cursor-pointer"
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
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 pointer-events-none">
              <i className="ri-arrow-down-s-line" />
            </div>
          </div>

          {(search || filterStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setFilterStatus('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
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
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin" />
              </div>
              Chargement de vos ressources...
            </span>
          ) : (
            <>
              <span className="font-medium text-slate-800">{filteredResources.length}</span> ressource
              {filteredResources.length > 1 ? 's' : ''}
            </>
          )}
        </p>
        {stats.reviewed > 0 && (
          <p className="text-sm text-emerald-600 font-medium">
            {stats.reviewed} validée{stats.reviewed > 1 ? 's' : ''} par peer review
          </p>
        )}
      </div>

      {/* Empty state */}
      {!loading && filteredResources.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-soft">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-folder-3-line text-2xl" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">
            {resources.length === 0 ? 'Aucune ressource pour le moment' : 'Aucune ressource trouvée'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {resources.length === 0
              ? 'Vous n\'avez pas encore partagé de ressources. Commencez par ajouter votre première ressource pédagogique.'
              : 'Essayez de modifier vos critères de recherche ou de filtre.'}
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            {resources.length === 0 && (
              <button
                onClick={() => navigate('/ressources/ajouter')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-add-line" />
                </div>
                Ajouter une ressource
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resources table */}
      {!loading && filteredResources.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Ressource
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Niveau
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Statut
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Vues
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Téléch.
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Comm.
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResources.map((resource) => (
                  <tr
                    key={resource.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {resource.cover_image_url ? (
                          <img
                            src={resource.cover_image_url}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <i className={`${getTypeConfig(resource.type).icon} text-sm`} />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-slate-800 line-clamp-1">
                            {resource.title}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(resource.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-slate-600">{resource.school_level}</span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <ResourceTypeBadge type={resource.type} bordered className="rounded-md" />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge resource={resource} size="sm" />
                    </td>
                    <td className="px-5 py-4 text-right hidden lg:table-cell">
                      <span className="text-slate-600">{resource.views || 0}</span>
                    </td>
                    <td className="px-5 py-4 text-right hidden lg:table-cell">
                      <span className="text-slate-600">{resource.downloads || 0}</span>
                    </td>
                    <td className="px-5 py-4 text-right hidden lg:table-cell">
                      <span className="text-slate-600">{resource.comments_count || 0}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/ressources/${resource.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sharek-700 dark:text-sharek-300 bg-sharek-50 dark:bg-sharek-900/30 hover:bg-sharek-100 dark:hover:bg-sharek-900/50 border border-sharek-200 dark:border-sharek-700/50 transition-colors"
                          title="Voir la ressource"
                        >
                          <i className="ri-eye-line text-sm" />
                          <span className="hidden sm:inline">Voir</span>
                        </button>
                        <button
                          onClick={() => navigate(`/ressources/modifier/${resource.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-700/50 transition-colors"
                          title="Modifier"
                        >
                          <i className="ri-edit-line text-sm" />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(resource.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-700/50 transition-colors"
                          title="Supprimer"
                        >
                          <i className="ri-delete-bin-line text-sm" />
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-alert-line text-xl" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
              Supprimer cette ressource ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Cette action est irréversible. La ressource et ses commentaires associés seront supprimés définitivement.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleteLoading && (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin" />
                  </div>
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
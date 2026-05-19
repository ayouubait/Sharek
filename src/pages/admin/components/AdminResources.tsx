import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface AdminResourcesProps {
  onCountsRefresh: () => void;
}

interface ResourceRow {
  id: string;
  title: string;
  author_id: string;
  created_at: string;
  status: string;
  status_label: string | null;
  type: string;
  type_label: string | null;
  views: number | null;
  downloads: number | null;
  is_featured: boolean | null;
  file_url: string | null;
}

export default function AdminResources({ onCountsRefresh }: AdminResourcesProps) {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [authorsMap, setAuthorsMap] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('resources')
        .select('id, title, author_id, created_at, status, status_label, type, type_label, views, downloads, is_featured, file_url')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await withTimeout(query, 8000);
      if (error) throw error;

      let filtered = data || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r: ResourceRow) =>
            r.title.toLowerCase().includes(q) ||
            (r.type_label || '').toLowerCase().includes(q)
        );
      }

      setResources(filtered);

      // Fetch author names
      const authorIds = [...new Set(filtered.map((r) => r.author_id))];
      if (authorIds.length > 0) {
        const { data: profiles } = await withTimeout(supabase
          .from('profiles')
          .select('id, name')
          .in('id', authorIds), 8000);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { map[p.id] = p.name || 'Inconnu'; });
        setAuthorsMap(map);
      }
    } catch (err) {
      console.error('Resources fetch error:', err);
      setToast({ type: 'error', message: 'Erreur lors du chargement des ressources.' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleToggleFeatured = async (resource: ResourceRow) => {
    setActionLoading(true);
    try {
      const { error } = await withTimeout(supabase
        .from('resources')
        .update({ is_featured: !resource.is_featured })
        .eq('id', resource.id), 8000);
      if (error) throw error;
      setToast({ type: 'success', message: resource.is_featured ? 'Ressource retirée de la mise en vedette.' : 'Ressource mise en vedette.' });
      fetchResources();
      onCountsRefresh();
    } catch (err) {
      console.error('Featured toggle error:', err);
      setToast({ type: 'error', message: 'Erreur lors de la mise à jour.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeStatus = async (resourceId: string, newStatus: string, newLabel: string) => {
    setActionLoading(true);
    try {
      const { error } = await withTimeout(supabase
        .from('resources')
        .update({ status: newStatus, status_label: newLabel })
        .eq('id', resourceId), 8000);
      if (error) throw error;
      setToast({ type: 'success', message: 'Statut mis à jour.' });
      fetchResources();
      onCountsRefresh();
    } catch (err) {
      console.error('Status change error:', err);
      setToast({ type: 'error', message: 'Erreur lors du changement de statut.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedResource) return;
    setActionLoading(true);
    try {
      // Delete file from storage if exists
      if (selectedResource.file_url) {
        const path = selectedResource.file_url.split('/').pop();
        if (path) {
          await withTimeout(supabase.storage.from('resources').remove([path]), 8000);
        }
      }
      // Delete versions
      await withTimeout(supabase.from('resource_versions').delete().eq('resource_id', selectedResource.id), 8000);
      // Delete comments
      await withTimeout(supabase.from('comments').delete().eq('resource_id', selectedResource.id), 8000);
      // Delete peer reviews
      await withTimeout(supabase.from('peer_reviews').delete().eq('resource_id', selectedResource.id), 8000);
      // Delete recommendations
      await withTimeout(supabase.from('recommendations').delete().eq('resource_id', selectedResource.id), 8000);
      // Delete resource
      const { error } = await withTimeout(supabase.from('resources').delete().eq('id', selectedResource.id), 8000);
      if (error) throw error;

      setToast({ type: 'success', message: 'Ressource supprimée définitivement.' });
      setDeleteModalOpen(false);
      setSelectedResource(null);
      fetchResources();
      onCountsRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      setToast({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setActionLoading(false);
    }
  };

  // auto dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const statusOptions = [
    { value: 'not_evaluated', label: 'Non évalué' },
    { value: 'pending_reviewers', label: 'En attente de reviewers' },
    { value: 'under_review', label: 'En cours de peer reviewing' },
    { value: 'needs_revision', label: 'À réviser' },
    { value: 'peer_reviewed', label: 'Peer reviewed' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="w-5 h-5 flex items-center justify-center text-slate-400">
            <i className="ri-search-line"></i>
          </div>
          <input
            type="text"
            placeholder="Rechercher une ressource..."
            className="flex-1 bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-sharek-400"
        >
          <option value="all">Tous les statuts</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Ressource</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Vues / DL</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Aucune ressource trouvée.
                    </td>
                  </tr>
                )}
                {resources.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/ressources/${r.id}`} className="font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600 block">
                        {r.title}
                      </Link>
                      <ResourceTypeBadge type={r.type} label={r.type_label || undefined} />
                      {r.is_featured && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                          <i className="ri-star-line"></i> Vedette
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <Link to={`/enseignant/${r.author_id}`} className="hover:text-sharek-600">
                        {authorsMap[r.author_id] || 'Inconnu'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        onChange={(e) => {
                          const opt = statusOptions.find(s => s.value === e.target.value);
                          if (opt) handleChangeStatus(r.id, opt.value, opt.label);
                        }}
                        disabled={actionLoading}
                        className="bg-white border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sharek-400"
                      >
                        {statusOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {r.views ?? 0} / {r.downloads ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Link
                          to={`/ressources/${r.id}/analytics`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
                          title="Voir les analytics"
                        >
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-bar-chart-box-line"></i>
                          </div>
                          Stats
                        </Link>
                        <button
                          onClick={() => handleToggleFeatured(r)}
                          disabled={actionLoading}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                            r.is_featured
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-white text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30'
                          }`}
                          title={r.is_featured ? 'Retirer de la mise en vedette' : 'Mettre en vedette'}
                        >
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className={r.is_featured ? 'ri-star-fill' : 'ri-star-line'}></i>
                          </div>
                          {r.is_featured ? 'Vedette' : 'Vedette'}
                        </button>
                        <button
                          onClick={() => { setSelectedResource(r); setDeleteModalOpen(true); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-delete-bin-line"></i>
                          </div>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteModalOpen && selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-lg">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Supprimer la ressource</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Voulez-vous vraiment supprimer définitivement <strong>{selectedResource.title}</strong> ? Cette action est irréversible et supprime aussi les commentaires, reviews et versions associés.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteModalOpen(false); setSelectedResource(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {actionLoading ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
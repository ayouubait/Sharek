import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';

interface AdminPendingReviewsProps {
  onCountsRefresh: () => void;
}

interface ResourceRow {
  id: string;
  title: string;
  author_id: string;
  status: string;
  status_label: string | null;
  created_at: string;
  file_url: string | null;
  type_label: string | null;
}

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  initials: string | null;
  color: string | null;
  contribution_score: number | null;
}

interface ReviewRow {
  id: string;
  reviewer_id: string;
  resource_id: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
}

export default function AdminPendingReviews({ onCountsRefresh }: AdminPendingReviewsProps) {
  const [pendingResources, setPendingResources] = useState<ResourceRow[]>([]);
  const [underReview, setUnderReview] = useState<ResourceRow[]>([]);
  const [reviewers, setReviewers] = useState<ProfileRow[]>([]);
  const [activeReviews, setActiveReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Ressources en attente de reviewers
      const { data: pending } = await withTimeout(
        supabase.from('resources')
          .select('id, title, author_id, status, status_label, created_at, file_url, type_label')
          .eq('status', 'pending_reviewers')
          .order('created_at', { ascending: false }),
        8000
      );

      // Ressources en cours de peer reviewing
      const { data: underRev } = await withTimeout(
        supabase.from('resources')
          .select('id, title, author_id, status, status_label, created_at, file_url, type_label')
          .eq('status', 'under_review')
          .order('created_at', { ascending: false }),
        8000
      );

      // Tous les utilisateurs non-bannis (enseignants/reviewers potentiels)
      const { data: users } = await withTimeout(
        supabase.from('profiles')
          .select('id, name, email, initials, color, contribution_score')
          .eq('is_banned', false)
          .neq('role', 'admin')
          .order('contribution_score', { ascending: false }),
        8000
      );

      // Reviews actives
      const { data: reviews } = await withTimeout(
        supabase.from('peer_reviews')
          .select('id, reviewer_id, resource_id, status, assigned_at, completed_at')
          .eq('status', 'in_progress')
          .order('assigned_at', { ascending: false }),
        8000
      );

      setPendingResources(pending || []);
      setUnderReview(underRev || []);
      setReviewers(users || []);
      setActiveReviews(reviews || []);
    } catch (err) {
      console.error('Pending reviews fetch error:', err);
      setToast({ type: 'error', message: 'Erreur lors du chargement des données.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openAssign = (resourceId: string) => {
    setSelectedResource(resourceId);
    setSelectedReviewers([]);
    setAssignModalOpen(true);
  };

  const handleAssignReviewers = async () => {
    if (!selectedResource || selectedReviewers.length === 0) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const inserts = selectedReviewers.map((reviewerId) => ({
        resource_id: selectedResource,
        reviewer_id: reviewerId,
        status: 'in_progress',
        assigned_at: now,
      }));

      const { error } = await withTimeout(
        supabase.from('peer_reviews').insert(inserts),
        8000
      );
      if (error) throw error;

      // Update resource status to under_review
      const { error: updError } = await withTimeout(
        supabase.from('resources')
          .update({ status: 'under_review', status_label: 'En cours de peer reviewing' })
          .eq('id', selectedResource),
        8000
      );
      if (updError) throw updError;

      setToast({ type: 'success', message: `${selectedReviewers.length} reviewer(s) assigné(s).` });
      setAssignModalOpen(false);
      setSelectedResource(null);
      setSelectedReviewers([]);
      fetchData();
      onCountsRefresh();
    } catch (err) {
      console.error('Assign error:', err);
      setToast({ type: 'error', message: 'Erreur lors de l\'assignation.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceComplete = async (resourceId: string) => {
    if (!window.confirm('Forcer la complétion du peer review pour cette ressource ?')) return;
    setActionLoading(true);
    try {
      const { error: revError } = await withTimeout(
        supabase.from('peer_reviews')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('resource_id', resourceId),
        8000
      );
      if (revError) throw revError;

      const { error: resError } = await withTimeout(
        supabase.from('resources')
          .update({ status: 'peer_reviewed', status_label: 'Peer reviewed' })
          .eq('id', resourceId),
        8000
      );
      if (resError) throw resError;

      setToast({ type: 'success', message: 'Peer review forcé à complété.' });
      fetchData();
      onCountsRefresh();
    } catch (err) {
      console.error('Force complete error:', err);
      setToast({ type: 'error', message: 'Erreur lors de la complétion forcée.' });
    } finally {
      setActionLoading(false);
    }
  };

  const assignedCountForResource = (resourceId: string) =>
    activeReviews.filter((r) => r.resource_id === resourceId).length;

  const assignedReviewsForResource = (resourceId: string) =>
    activeReviews.filter((r) => r.resource_id === resourceId);

  const getReviewerProfile = (reviewerId: string) =>
    reviewers.find((u) => u.id === reviewerId);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'En cours' },
      invited: { bg: 'bg-slate-50 dark:bg-slate-700/30', text: 'text-slate-600 dark:text-slate-300', label: 'Invité' },
      accepted: { bg: 'bg-ocean-50', text: 'text-ocean-700', label: 'Confirmé' },
      reading: { bg: 'bg-sharek-50', text: 'text-sharek-700', label: 'En lecture' },
      recommendation_submitted: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Recommandation envoyée' },
    };
    const cfg = map[status] || map.in_progress;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Pending reviewers */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center text-red-600">
            <i className="ri-time-line"></i>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">En attente de reviewers</h3>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
            {pendingResources.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : pendingResources.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Aucune ressource en attente de reviewers.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {pendingResources.map((r) => (
              <div key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link to={`/ressources/${r.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600 block truncate">
                    {r.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <ResourceTypeBadge type={r.type} label={r.type_label || undefined} />
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {r.file_url && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700/50">
                        Fichier joint
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openAssign(r.id)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-sharek-600 text-white hover:bg-sharek-700 transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-user-add-line"></i>
                  </div>
                  Assigner des reviewers
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Under review */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center text-ocean-600">
            <i className="ri-team-line"></i>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">En cours de peer reviewing</h3>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-600 border border-ocean-100">
            {underReview.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : underReview.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Aucune ressource en cours de peer reviewing.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {underReview.map((r) => {
              const assigned = assignedReviewsForResource(r.id);
              const count = assigned.length;
              return (
                <div key={r.id} className="px-5 py-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link to={`/ressources/${r.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600 block truncate">
                        {r.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-slate-400">{count} reviewer(s) assigné(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAssign(r.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors whitespace-nowrap disabled:opacity-60"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-user-add-line"></i>
                        </div>
                        Ajouter
                      </button>
                      <button
                        onClick={() => handleForceComplete(r.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap disabled:opacity-60"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-check-double-line"></i>
                        </div>
                        Forcer complétion
                      </button>
                    </div>
                  </div>

                  {/* Reviewer identity cards */}
                  {count > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {assigned.map((ar) => {
                        const prof = getReviewerProfile(ar.reviewer_id);
                        const initials = prof?.initials || (prof?.name || '?').charAt(0).toUpperCase();
                        const color = prof?.color || '#64748b';
                        return (
                          <div
                            key={ar.id}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30/80 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {prof?.name || ar.reviewer_id.slice(0, 8)}
                              </p>
                              {prof?.email && (
                                <p className="text-[10px] text-slate-400 truncate">{prof.email}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 ml-1">
                              {statusBadge(ar.status)}
                              <Link
                                to={`/enseignant/${ar.reviewer_id}`}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 dark:border-slate-700 text-ocean-600 hover:bg-ocean-50 transition-colors"
                                title="Voir le profil"
                              >
                                <i className="ri-user-line text-[10px]"></i>
                              </Link>
                              <Link
                                to={`/messages/${ar.reviewer_id}`}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 dark:border-slate-700 text-sharek-600 hover:bg-sharek-50 transition-colors"
                                title="Envoyer un message"
                              >
                                <i className="ri-mail-send-line text-[10px]"></i>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assignModalOpen && selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-lg w-full shadow-lg max-h-[80vh] flex flex-col">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Assigner des reviewers</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Sélectionnez un ou plusieurs enseignants pour reviewer cette ressource.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {reviewers.length === 0 && (
                <p className="text-sm text-slate-400">Aucun enseignant disponible.</p>
              )}
              {reviewers.map((u) => {
                const isSelected = selectedReviewers.includes(u.id);
                const isAlreadyAssigned = activeReviews.some(
                  (r) => r.resource_id === selectedResource && r.reviewer_id === u.id && r.status === 'in_progress'
                );
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (isAlreadyAssigned) return;
                      setSelectedReviewers((prev) =>
                        isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      );
                    }}
                    disabled={isAlreadyAssigned}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isAlreadyAssigned
                        ? 'bg-slate-50 dark:bg-slate-700/30 text-slate-400 cursor-not-allowed'
                        : isSelected
                        ? 'bg-sharek-50 border border-sharek-200 text-sharek-800'
                        : 'bg-white border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isSelected ? 'bg-sharek-200 text-sharek-700' : 'bg-ocean-100 text-ocean-600'
                    }`} style={{ backgroundColor: isSelected ? undefined : (u.color || '#0d9488') }}>
                      {(u.initials || (u.name || u.email || '?').charAt(0)).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                      <p className="text-xs text-slate-400">
                        Score {u.contribution_score || 0}
                        {isAlreadyAssigned && ' · Déjà assigné'}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 flex items-center justify-center text-sharek-600">
                        <i className="ri-check-line"></i>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedReviewers.length} sélectionné(s)
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => { setAssignModalOpen(false); setSelectedResource(null); setSelectedReviewers([]); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAssignReviewers}
                  disabled={actionLoading || selectedReviewers.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-sharek-600 hover:bg-sharek-700 transition-colors ${
                    actionLoading || selectedReviewers.length === 0 ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {actionLoading ? 'Assignation...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import type { Resource, ResourceVersion } from '@/mocks/data';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import ShareModal from '@/components/ShareModal';
import ReportModal from '@/components/ReportModal';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import DocumentViewer from './components/DocumentViewer';
import StatusBadge from './components/StatusBadge';
import CommentsSection from './components/CommentsSection';
import PeerReviewPanel from './components/PeerReviewPanel';
import VersionManager from './components/VersionManager';

interface AuthorProfile {
  id: string;
  name: string;
  initials: string;
  color: string;
  institution?: string;
  city?: string;
  avatar?: string | null;
}

interface AdminStats {
  totalComments: number;
  totalReviews: number;
  completedReviews: number;
  pendingReviews: number;
  totalVersions: number;
  recommendationsCount: number;
  avgScore: number | null;
  uniqueCommenters: number;
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [showMetadata, setShowMetadata] = useState(false);
  const [resource, setResource] = useState<Resource | null>(null);
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVersion, setActiveVersion] = useState<ResourceVersion | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(resource?.status || 'not_evaluated');
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [reviewersList, setReviewersList] = useState<{ id: string; name: string; initials: string; color: string }[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<{ id: string; name: string; initials: string; color: string; status: string }[]>([]);
  const [reviewersLoading, setReviewersLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [unassigningReviewerId, setUnassigningReviewerId] = useState<string | null>(null);
  const [peerRefreshKey, setPeerRefreshKey] = useState(0);
  const [swappingReviewerId, setSwappingReviewerId] = useState<string | null>(null);
  const [swapSelectedId, setSwapSelectedId] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { isFavorite: isFavoriteFn, toggleFavorite: toggleFavoriteDB } = useFavorites();
  const isFavorite = id ? isFavoriteFn(id) : false;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch resource and real author profile
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchResource() {
      let data: Resource | null = null;
      // Retry up to 3 times before giving up - Supabase can have cold starts
      for (let attempt = 0; attempt < 3 && !data && !cancelled; attempt++) {
        try {
          const result = await withTimeout(supabase
            .from('resources')
            .select('*')
            .eq('id', id)
            .maybeSingle(), 15000);
          if (result.data) {
            data = result.data as unknown as Resource;
            break;
          }
        } catch {
          // timeout: try again
        }
      }

      if (cancelled) return;

      if (data) {
        setResource(data);
        try {
          const { data: profileData } = await withTimeout(supabase
            .from('profiles')
            .select('id, name, initials, color, institution, city, avatar_url')
            .eq('id', data.author_id)
            .maybeSingle(), 10000);

          if (profileData && !cancelled) {
            setAuthor({
              id: profileData.id,
              name: profileData.name || 'Auteur',
              initials: profileData.initials || 'A',
              color: profileData.color || '#0d9488',
              institution: profileData.institution || '',
              city: profileData.city || '',
              avatar: profileData.avatar_url || null,
            });
          }
        } catch {
          // profile fetch failed, keep going
        }
      }

      if (!cancelled) setLoading(false);
    }

    fetchResource();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch admin stats when resource loaded and user is admin
  useEffect(() => {
    if (!id || !isAdmin || !resource) return;
    let cancelled = false;
    setStatsLoading(true);

    async function fetchAdminStats() {
      try {
        const [commentsRes, reviewsRes, versionsRes, recsRes] = await Promise.all([
          withTimeout(supabase.from('comments').select('id, author_id').eq('resource_id', id), 8000),
          withTimeout(supabase.from('peer_reviews').select('id, status').eq('resource_id', id), 8000),
          withTimeout(supabase.from('resource_versions').select('id').eq('resource_id', id), 8000),
          withTimeout(supabase.from('recommendations').select('score').eq('resource_id', id), 8000),
        ]);

        if (cancelled) return;

        const comments = (commentsRes.data as { id: string; author_id: string }[]) || [];
        const reviews = (reviewsRes.data as { id: string; status: string }[]) || [];
        const versions = (versionsRes.data as { id: string }[]) || [];
        const recs = (recsRes.data as { score: number }[]) || [];

        const uniqueCommenters = new Set(comments.map((c) => c.author_id)).size;
        const completedReviews = reviews.filter((r) => r.status === 'completed').length;
        const avgScore = recs.length > 0
          ? Number((recs.reduce((s, r) => s + r.score, 0) / recs.length).toFixed(1))
          : null;

        setAdminStats({
          totalComments: comments.length,
          totalReviews: reviews.length,
          completedReviews,
          pendingReviews: reviews.length - completedReviews,
          totalVersions: versions.length,
          recommendationsCount: recs.length,
          avgScore,
          uniqueCommenters,
        });
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    fetchAdminStats();
    return () => { cancelled = true; };
  }, [id, isAdmin, resource]);

  // Fetch available reviewers when assign modal opens
  useEffect(() => {
    if (!showAssignModal || !id) return;
    let cancelled = false;
    setReviewersLoading(true);

    async function fetchReviewers() {
      try {
        // Fetch existing reviewers with status for this resource
        const { data: existing } = await withTimeout(
          supabase.from('peer_reviews').select('reviewer_id, status').eq('resource_id', id),
          8000
        );
        const existingEntries = (existing || []) as { reviewer_id: string; status: string }[];
        const existingIds = new Set(existingEntries.map((r) => r.reviewer_id));

        // Fetch all teacher profiles
        const { data: profiles } = await withTimeout(
          supabase.from('profiles').select('id, name, initials, color').not('name', 'is', null),
          8000
        );

        if (cancelled) return;

        const allProfiles = (profiles || []) as { id: string; name: string; initials: string; color: string }[];

        // Assigned reviewers (grisés)
        const assigned = allProfiles
          .filter((p) => existingIds.has(p.id))
          .map((p) => {
            const entry = existingEntries.find((e) => e.reviewer_id === p.id);
            return { ...p, status: entry?.status || 'pending' };
          });
        setAssignedReviewers(assigned);

        // Available reviewers
        const filtered = allProfiles
          .filter((p) => !existingIds.has(p.id) && p.id !== resource?.author_id)
          .slice(0, 50);
        setReviewersList(filtered);
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setReviewersLoading(false);
      }
    }

    fetchReviewers();
    return () => { cancelled = true; };
  }, [showAssignModal, id, resource?.author_id]);

  // Keep selectedStatus in sync with resource
  useEffect(() => {
    if (resource) setSelectedStatus(resource.status);
  }, [resource?.status]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function toggleFavorite() {
    if (!resource || !user) {
      setToast({ message: 'Connectez-vous pour gérer vos favoris.', type: 'error' });
      return;
    }
    const wasFavorite = isFavorite;
    const ok = await toggleFavoriteDB(resource.id);
    if (ok) {
      setToast({
        message: wasFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris',
        type: 'success',
      });
    } else {
      setToast({ message: 'Action impossible. Réessayez.', type: 'error' });
    }
  }

  async function handleChangeStatus() {
    if (!resource || !id) return;
    setActionLoading(true);
    try {
      const { error } = await withTimeout(
        supabase.from('resources').update({ status: selectedStatus }).eq('id', id),
        10000
      );
      if (error) throw error;
      setResource({ ...resource, status: selectedStatus });
      setToast({ message: 'Statut mis à jour avec succès', type: 'success' });
      setShowStatusModal(false);
    } catch {
      setToast({ message: 'Erreur lors de la mise à jour du statut', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnassignReviewer(reviewerId: string) {
    if (!id) return;
    setUnassigningReviewerId(reviewerId);
    try {
      const { error } = await withTimeout(
        supabase.from('peer_reviews').delete().eq('resource_id', id).eq('reviewer_id', reviewerId),
        10000
      );
      if (error) throw error;

      const removed = assignedReviewers.find((r) => r.id === reviewerId);
      if (removed) {
        const { status: _status, ...rest } = removed;
        setReviewersList((prev) => [...prev, rest]);
      }
      setAssignedReviewers((prev) => prev.filter((r) => r.id !== reviewerId));

      setAdminStats((prev) => {
        if (!prev) return null;
        const wasCompleted = removed?.status === 'completed';
        return {
          ...prev,
          totalReviews: prev.totalReviews - 1,
          completedReviews: wasCompleted ? prev.completedReviews - 1 : prev.completedReviews,
          pendingReviews: wasCompleted ? prev.pendingReviews : prev.pendingReviews - 1,
        };
      });

      setToast({ message: 'Reviewer désassigné', type: 'success' });
    } catch {
      setToast({ message: 'Erreur lors de la désassignation', type: 'error' });
    } finally {
      setUnassigningReviewerId(null);
    }
  }

  async function handleAssignReviewer() {
    if (!selectedReviewer || !id) return;
    if (assignedReviewers.length >= 2) {
      setToast({ message: 'Maximum 2 reviewers par ressource. Désassignez avant d\'en ajouter.', type: 'error' });
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await withTimeout(
        supabase.from('peer_reviews').insert({
          resource_id: id,
          reviewer_id: selectedReviewer,
          status: 'invited',
          status_label: 'Invité',
        }),
        10000
      );
      if (error) throw error;
      setToast({ message: 'Reviewer assigné avec succès', type: 'success' });
      setShowAssignModal(false);
      setSelectedReviewer('');
      // Refresh admin stats
      setAdminStats((prev) => prev ? { ...prev, totalReviews: prev.totalReviews + 1, pendingReviews: prev.pendingReviews + 1 } : null);
      // Force PeerReviewPanel to refetch
      setPeerRefreshKey((k) => k + 1);
    } catch {
      setToast({ message: 'Erreur lors de l\'assignation', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSwapReviewer(oldReviewerId: string, newReviewerId: string) {
    if (!id || oldReviewerId === newReviewerId) return;
    setActionLoading(true);
    setPeerRefreshKey((k) => k + 1);
    try {
      const { error } = await withTimeout(
        supabase.from('peer_reviews')
          .update({ reviewer_id: newReviewerId })
          .eq('resource_id', id)
          .eq('reviewer_id', oldReviewerId),
        10000
      );
      if (error) throw error;

      const oldReviewer = assignedReviewers.find((r) => r.id === oldReviewerId);
      const newReviewer = reviewersList.find((r) => r.id === newReviewerId);

      if (oldReviewer && newReviewer) {
        const { status: _status, ...oldRest } = oldReviewer;

        setReviewersList((prev) => {
          const withoutNew = prev.filter((r) => r.id !== newReviewerId);
          return [...withoutNew, oldRest];
        });

        setAssignedReviewers((prev) => {
          const withoutOld = prev.filter((r) => r.id !== oldReviewerId);
          return [...withoutOld, { ...newReviewer, status: 'pending' }];
        });

        if (oldReviewer.status === 'completed') {
          setAdminStats((prev) => prev ? {
            ...prev,
            completedReviews: prev.completedReviews - 1,
            pendingReviews: prev.pendingReviews + 1,
          } : null);
        }
      }

      setToast({ message: 'Reviewer remplacé avec succès', type: 'success' });
      setSwappingReviewerId(null);
      setSwapSelectedId('');
    } catch {
      setToast({ message: 'Erreur lors du remplacement', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 flex items-center justify-center">
            <i className="ri-loader-4-line animate-spin text-ocean-500 text-3xl" />
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-4">Chargement de la ressource...</p>
        </div>
      </MainLayout>
    );
  }

  if (!resource) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-file-close-line text-2xl" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Ressource introuvable</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            La ressource demand&eacute;e n&apos;existe pas ou a &eacute;t&eacute; supprim&eacute;e.
          </p>
          <Link
            to="/ressources"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <i className="ri-folder-open-line" />
            Retour aux ressources
          </Link>
        </div>
      </MainLayout>
    );
  }


  const formattedDate = new Date(resource.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const authorName = author?.name || 'Auteur inconnu';
  const authorInitials = author?.initials || '?';
  const authorColor = author?.color || '#94a3b8';
  const authorInstitution = author?.institution || '';
  const authorCity = author?.city || '';

  const resourceAgeDays = Math.ceil(
    (Date.now() - new Date(resource.created_at).getTime()) / 86400000
  );

  return (
    <MainLayout>
      <div className="pb-8">
        {/* === COMPACT HEADER === */}
        <div className="mb-4">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-3 min-w-0">
            <button onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')} className="hover:text-ocean-600 transition-colors whitespace-nowrap">Tableau de bord</button>
            <div className="w-3 h-3 flex items-center justify-center flex-shrink-0"><i className="ri-arrow-right-s-line" /></div>
            <Link to="/ressources" className="hover:text-ocean-600 transition-colors whitespace-nowrap">Ressources</Link>
            <div className="w-3 h-3 flex items-center justify-center flex-shrink-0"><i className="ri-arrow-right-s-line" /></div>
            <span className="text-slate-500 dark:text-slate-400 truncate min-w-0 max-w-[200px]">{resource.title}</span>
          </nav>

          {/* Cover Image */}
          {resource.cover_image_url && (
            <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <img
                src={resource.cover_image_url}
                alt={`Couverture de ${resource.title}`}
                className="w-full h-52 sm:h-64 object-cover"
              />
            </div>
          )}

          {/* Title + badges in one row */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ResourceTypeBadge type={resource.type} label={resource.type_label} className="rounded-full gap-1.5 px-2.5 py-1" iconClassName="w-3.5 h-3.5" />
                <StatusBadge resource={resource} size="sm" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-snug break-words">{resource.title}</h1>
            </div>

            {/* Compact metadata bar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400">
              {/* Author */}
              {author ? (
                <Link to={`/enseignant/${author.id}`} className="inline-flex items-center gap-1.5 hover:text-ocean-600 transition-colors bg-slate-50 dark:bg-slate-800/50 rounded-full pl-0.5 pr-2.5 py-0.5">
                  {author.avatar ? (
                    <img src={author.avatar} alt={authorName} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: authorColor }}>{authorInitials}</div>
                  )}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{authorName}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: authorColor }}>{authorInitials}</div>
                  <span className="font-medium">{authorName}</span>
                </span>
              )}

              {/* Metadata chips */}
              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5">
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-calendar-line text-[10px]" /></div>
                {formattedDate}
              </span>

              {(authorInstitution || authorCity) && (
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5">
                  <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-building-line text-[10px]" /></div>
                  {[authorInstitution, authorCity].filter(Boolean).join(', ')}
                </span>
              )}

              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5">
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-eye-line text-[10px]" /></div>
                {resource.views || 0} vues
              </span>

              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5">
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-download-line text-[10px]" /></div>
                {resource.downloads || 0} téléchargements
              </span>
            </div>

            {/* Action buttons row */}
            <div className="flex flex-wrap items-center gap-2">
              {author && author.id !== user?.id && (
                <Link
                  to={`/messages/${author.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ocean-700 bg-ocean-50 rounded-full hover:bg-ocean-100 transition-colors"
                >
                  <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-mail-send-line text-[10px]" /></div>
                  Contacter
                </Link>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-share-line text-[10px]" /></div>
                Partager
              </button>
              <button
                onClick={toggleFavorite}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  isFavorite
                    ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                    : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className={`${isFavorite ? 'ri-heart-fill' : 'ri-heart-line'} text-[10px]`} />
                </div>
                {isFavorite ? 'Favori' : 'Favoris'}
              </button>
              {user && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
                >
                  <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-flag-line text-[10px]" /></div>
                  Signaler
                </button>
              )}
              <Link
                to={`/ressources/${resource.id}/analytics`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-bar-chart-box-line text-[10px]" /></div>
                Analytics
              </Link>
              {(activeVersion?.file_url || resource.file_url) && (
                <a
                  href={activeVersion?.file_url || resource.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 rounded-full hover:bg-ocean-700 transition-colors"
                >
                  <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-download-line text-[10px]" /></div>
                  Télécharger
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Admin Stats Panel */}
        {isAdmin && (
          <div className="mb-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center rounded bg-rose-50 text-rose-500">
                  <i className="ri-bar-chart-box-line text-xs" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Stats Admin</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:bg-slate-800/50 transition-colors whitespace-nowrap"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-edit-line" />
                  </div>
                  Modifier statut
                </button>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 rounded-md hover:bg-ocean-700 transition-colors whitespace-nowrap"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-user-add-line" />
                  </div>
                  Assigner reviewer
                </button>
                <Link
                  to={`/ressources/${resource.id}/analytics`}
                  className="text-xs font-medium text-ocean-600 hover:text-ocean-700 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Analytics
                  <i className="ri-arrow-right-line" />
                </Link>
              </div>
            </div>
            {statsLoading ? (
              <div className="px-5 py-6 flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                <i className="ri-loader-4-line animate-spin" />
                Chargement des statistiques...
              </div>
            ) : adminStats ? (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <AdminStatCard
                  icon="ri-eye-line"
                  label="Vues"
                  value={resource.views?.toLocaleString('fr-FR') || '0'}
                  color="text-ocean-600"
                  bg="bg-ocean-50"
                />
                <AdminStatCard
                  icon="ri-download-line"
                  label="Téléchargements"
                  value={resource.downloads?.toLocaleString('fr-FR') || '0'}
                  color="text-emerald-600"
                  bg="bg-emerald-50"
                />
                <AdminStatCard
                  icon="ri-message-3-line"
                  label="Commentaires"
                  value={adminStats.totalComments.toString()}
                  sub={`${adminStats.uniqueCommenters} auteur${adminStats.uniqueCommenters > 1 ? 's' : ''}`}
                  color="text-teal-600"
                  bg="bg-teal-50"
                />
                <AdminStatCard
                  icon="ri-user-search-line"
                  label="Reviews"
                  value={`${adminStats.completedReviews}/${adminStats.totalReviews}`}
                  sub={`${adminStats.pendingReviews} en attente`}
                  color="text-amber-600"
                  bg="bg-amber-50 dark:bg-slate-800"
                />
                <AdminStatCard
                  icon="ri-star-line"
                  label="Recommandations"
                  value={adminStats.recommendationsCount.toString()}
                  sub={adminStats.avgScore !== null ? `Moy. ${adminStats.avgScore}/10` : 'Aucune'}
                  color="text-violet-600"
                  bg="bg-violet-50"
                />
                <AdminStatCard
                  icon="ri-git-branch-line"
                  label="Versions"
                  value={adminStats.totalVersions.toString()}
                  color="text-blue-600"
                  bg="bg-blue-50"
                />
                <AdminStatCard
                  icon="ri-time-line"
                  label="Âge"
                  value={`${resourceAgeDays}j`}
                  color="text-slate-600 dark:text-slate-300"
                  bg="bg-slate-100 dark:bg-slate-800"
                />
                <AdminStatCard
                  icon="ri-fire-line"
                  label="Engagement"
                  value={
                    resource.views && resource.views > 0
                      ? `${(((resource.downloads || 0) + adminStats.totalComments * 2) / resource.views * 100).toFixed(1)}%`
                      : '-'
                  }
                  sub="Downloads + coms / vues"
                  color="text-rose-600"
                  bg="bg-rose-50"
                />
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500">
                Impossible de charger les statistiques.
              </div>
            )}
          </div>
        )}

        {/* Main content grid */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Center column */}
          <div className="flex-1 min-w-0">
            {/* Version Manager */}
            <VersionManager
              resourceId={resource.id}
              resourceAuthorId={resource.author_id}
              currentVersion={resource.current_version || 1}
              versionCount={resource.version_count || 1}
              onVersionChange={setActiveVersion}
            />

            {/* Document viewer */}
            <div id="document">
              <DocumentViewer
                resource={resource}
                activeFileUrl={activeVersion?.file_url}
                resourceAuthorId={resource.author_id}
              />
            </div>

            {/* Resource metadata - compact inline */}
            <div className="mt-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mr-1">Métadonnées</span>
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <i className="ri-school-line text-[10px]" /> {resource.school_level}
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <i className="ri-book-line text-[10px]" /> {resource.unit}
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <i className="ri-time-line text-[10px]" /> {resource.duration}
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <i className="ri-eye-line text-[10px]" /> {resource.views || 0} vues
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-full px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <i className="ri-download-line text-[10px]" /> {resource.downloads || 0} téléchargements
                </span>
                <span className="inline-flex items-center gap-1 bg-ocean-50 dark:bg-slate-800 rounded-full px-2.5 py-0.5 text-xs text-ocean-700 dark:text-ocean-300">
                  <i className="ri-hashtag text-[10px]" /> {resource.keywords.length} mot{resource.keywords.length > 1 ? 's' : ''}-clé{resource.keywords.length > 1 ? 's' : ''}
                </span>
              </div>

              {showMetadata && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <p><span className="font-medium text-slate-500 dark:text-slate-400">Objectifs :</span> <span className="break-words">{resource.objectives}</span></p>
                  <p><span className="font-medium text-slate-500 dark:text-slate-400">Compétences :</span> <span className="break-words">{resource.competencies}</span></p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {resource.keywords.map((kw: string) => (
                      <span key={kw} className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-ocean-50 dark:bg-slate-800 text-ocean-700 dark:text-ocean-300 rounded-md">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="mt-3 text-xs font-medium text-ocean-600 hover:text-ocean-700 inline-flex items-center gap-1 transition-colors"
              >
                {showMetadata ? 'Moins de détails' : 'Plus de détails'}
                <i className={`ri-arrow-down-s-line transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Comments section */}
            <div className="mt-4">
              <CommentsSection resourceId={resource.id} resourceAuthorId={resource.author_id} resourceType={resource.type} resourceTypeLabel={resource.type_label} />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full xl:w-80 flex-shrink-0">
            <div className="xl:sticky xl:top-20">
              <PeerReviewPanel
                resourceId={resource.id}
                resourceStatus={resource.status}
                resourceAuthorId={resource.author_id}
                resourceType={resource.type}
                resourceTypeLabel={resource.type_label}
                refreshKey={peerRefreshKey}
              />
            </div>
          </div>
        </div>

        {/* Author Profile Block - above footer */}
        {author && (
          <div className="mt-8 -mx-4 lg:-mx-8 px-4 lg:px-8 py-8 bg-amber-50 dark:bg-slate-800 border-y border-amber-100 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-5xl mx-auto">
              {author.avatar ? (
                <img src={author.avatar} alt={authorName} className="w-16 h-16 rounded-full object-cover border-2 border-amber-200 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white border-2 border-amber-200 flex-shrink-0" style={{ backgroundColor: authorColor }}>
                  {authorInitials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Publié par</p>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{authorName}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {authorInstitution && (
                    <span className="inline-flex items-center gap-1">
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-building-line text-xs text-amber-500 dark:text-amber-400" /></div>
                      {authorInstitution}
                    </span>
                  )}
                  {authorCity && (
                    <span className="inline-flex items-center gap-1">
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-map-pin-line text-xs text-amber-500 dark:text-amber-400" /></div>
                      {authorCity}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-calendar-line text-xs text-amber-500 dark:text-amber-400" /></div>
                    Membre depuis {formattedDate}
                  </span>
                </div>
              </div>
              <Link
                to={`/enseignant/${author.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-slate-700 hover:bg-amber-200 dark:hover:bg-slate-600 rounded-lg transition-colors flex-shrink-0"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-user-line text-xs" /></div>
                Voir le profil
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Toast */}
      {isAdmin && (
        <>
          {/* Status Modal */}
          {showStatusModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-md p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Modifier le statut</h3>
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
                <div className="space-y-2 mb-5">
                  {[
                    { value: 'not_evaluated', label: 'Non évalué', desc: 'Brouillon, pas encore soumis' },
                    { value: 'pending_reviewers', label: 'En attente de reviewers', desc: 'Publié, en recherche d\'évaluateurs' },
                    { value: 'under_review', label: 'En cours de peer review', desc: 'Reviewers assignés, évaluation en cours' },
                    { value: 'needs_revision', label: 'À réviser', desc: 'Retours reçus, modifications demandées' },
                    { value: 'peer_reviewed', label: 'Peer reviewed', desc: 'Validé et publié officiellement' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStatus === opt.value
                          ? 'border-ocean-300 bg-ocean-50/40'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resourceStatus"
                        value={opt.value}
                        checked={selectedStatus === opt.value}
                        onChange={() => setSelectedStatus(opt.value)}
                        className="mt-0.5 accent-ocean-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 rounded-md transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleChangeStatus}
                    disabled={actionLoading || selectedStatus === resource?.status}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading && <i className="ri-loader-4-line animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Assign Reviewer Modal */}
          {showAssignModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-md p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Assigner un reviewer</h3>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
                {reviewersLoading ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                    <i className="ri-loader-4-line animate-spin text-xl" />
                    Chargement des enseignants...
                  </div>
                ) : reviewersList.length === 0 && assignedReviewers.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
                      <i className="ri-user-search-line text-xl" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Aucun enseignant trouvé</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Aucun profil disponible pour l\'assignation.</p>
                  </div>
                ) : (
                  <div className="mb-5 space-y-4">
                    {/* Already assigned reviewers */}
                    {assignedReviewers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Déjà assignés ({assignedReviewers.length})
                        </p>
                        <div className="space-y-1">
                          {assignedReviewers.map((r) => (
                            swappingReviewerId === r.id ? (
                              <div key={r.id} className="p-3 rounded-lg border border-ocean-200 bg-ocean-50/20 space-y-3">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Choisir un nouveau reviewer :</p>
                                {reviewersList.length === 0 ? (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">Aucun reviewer disponible pour le remplacement.</p>
                                ) : (
                                  <div className="max-h-40 overflow-y-auto space-y-1">
                                    {reviewersList.map((sr) => (
                                      <label
                                        key={sr.id}
                                        className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                                          swapSelectedId === sr.id
                                            ? 'border-ocean-300 bg-ocean-50'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name="swapReviewer"
                                          value={sr.id}
                                          checked={swapSelectedId === sr.id}
                                          onChange={() => setSwapSelectedId(sr.id)}
                                          className="accent-ocean-600"
                                        />
                                        <div
                                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                          style={{ backgroundColor: sr.color || '#0d9488' }}
                                        >
                                          {sr.initials || '?'}
                                        </div>
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{sr.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    onClick={() => { setSwappingReviewerId(null); setSwapSelectedId(''); }}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:bg-slate-900 rounded-md transition-colors"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={() => handleSwapReviewer(r.id, swapSelectedId)}
                                    disabled={!swapSelectedId || actionLoading || reviewersList.length === 0}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading && <i className="ri-loader-4-line animate-spin" />}
                                    Remplacer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={r.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 group"
                              >
                                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                  <i className="ri-lock-line text-slate-400 dark:text-slate-500 text-xs" />
                                </div>
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                  style={{ backgroundColor: r.color || '#0d9488' }}
                                >
                                  {r.initials || '?'}
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{r.name}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  r.status === 'completed'
                                    ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-slate-800 text-amber-600 dark:text-amber-300'
                                }`}>
                                  {r.status === 'completed' ? 'Terminé' : 'En cours'}
                                </span>
                                <div className="ml-auto flex items-center gap-1">
                                  <button
                                    onClick={() => { setSwappingReviewerId(r.id); setSwapSelectedId(''); }}
                                    disabled={actionLoading}
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-ocean-50 text-slate-300 hover:text-ocean-500 transition-colors disabled:opacity-50"
                                    title="Modifier"
                                  >
                                    <i className="ri-edit-line text-xs" />
                                  </button>
                                  <button
                                    onClick={() => handleUnassignReviewer(r.id)}
                                    disabled={unassigningReviewerId === r.id || actionLoading}
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                    title="Désassigner"
                                  >
                                    {unassigningReviewerId === r.id ? (
                                      <i className="ri-loader-4-line animate-spin text-xs" />
                                    ) : (
                                      <i className="ri-delete-bin-line text-xs" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available reviewers */}
                    {reviewersList.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Disponibles ({reviewersList.length})
                        </p>
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                          {reviewersList.map((r) => (
                            <label
                              key={r.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                selectedReviewer === r.id
                                  ? 'border-ocean-300 bg-ocean-50/40'
                                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="reviewer"
                                value={r.id}
                                checked={selectedReviewer === r.id}
                                onChange={() => setSelectedReviewer(r.id)}
                                className="accent-ocean-600"
                              />
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: r.color || '#0d9488' }}
                              >
                                {r.initials || '?'}
                              </div>
                              <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{r.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 rounded-md transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAssignReviewer}
                    disabled={actionLoading || !selectedReviewer || reviewersList.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading && <i className="ri-loader-4-line animate-spin" />}
                    Assigner
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Share Modal */}
      {showShareModal && resource && (
        <ShareModal
          title={resource.title}
          description={resource.description || resource.objectives || ''}
          onClose={() => setShowShareModal(false)}
          onToast={(msg) => setToast({ message: msg, type: 'success' })}
        />
      )}

      {/* Report Modal */}
      {showReportModal && resource && user && (
        <ReportModal
          resourceId={resource.id}
          resourceTitle={resource.title}
          userId={user.id}
          onClose={() => setShowReportModal(false)}
          onToast={(msg, type = 'success') => setToast({ message: msg, type })}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
            </div>
            {toast.message}
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function AdminStatCard({
  icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:bg-slate-800/50 transition-colors">
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${bg} ${color} mb-2`}>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`${icon} text-sm`} />
        </div>
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
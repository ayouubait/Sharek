import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { PeerReview as MockPeerReview, Recommendation as MockRecommendation } from '@/mocks/data';
import { supabase } from '@/lib/supabase';

interface PeerReviewPanelProps {
  resourceId: string;
  resourceStatus: string;
  resourceAuthorId?: string;
  resourceType?: string;
  resourceTypeLabel?: string;
}

interface SupaPeerReview {
  id: string;
  resource_id: string;
  reviewer_id: string;
  status: string;
  status_label: string;
  joined_at: string;
  recommendation_submitted: boolean;
}

interface SupaRecommendation {
  id: string;
  resource_id: string;
  reviewer_id: string;
  reviewer_name: string;
  file_name: string;
  submitted_at: string;
  status: string;
  status_label: string;
  observations: string;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  decision: string;
}

const reviewSteps = [
  { step: 'Ressource soumise', icon: 'ri-file-upload-line' },
  { step: 'Reviewer 1 confirmé', icon: 'ri-user-follow-line' },
  { step: 'Reviewer 2 confirmé', icon: 'ri-user-follow-line' },
  { step: 'Lecture et analyse du document', icon: 'ri-book-open-line' },
  { step: 'Commentaires déposés', icon: 'ri-message-3-line' },
  { step: 'Fichier de recommandation soumis', icon: 'ri-file-list-3-line' },
  { step: 'Validation finale', icon: 'ri-shield-check-line' },
];

const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string; step: number }> = {
  invited: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'ri-mail-line', label: 'Invité', step: 1 },
  accepted: { bg: 'bg-ocean-50', text: 'text-ocean-700', icon: 'ri-check-line', label: 'Confirmé', step: 2 },
  reading: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'ri-book-open-line', label: 'En lecture', step: 3 },
  recommendation_submitted: { bg: 'bg-sharek-50', text: 'text-sharek-700', icon: 'ri-file-list-3-line', label: 'Recommandation soumise', step: 5 },
};

const decisionOptions = [
  'Validé avec modifications mineures',
  'Validé avec modifications majeures',
  'Non validé',
];

export default function PeerReviewPanel({ resourceId, resourceStatus, resourceAuthorId, resourceType, resourceTypeLabel }: PeerReviewPanelProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const currentUserId = user?.id || 't1';
  const currentUserName = user?.name || 'Fatima Zahra';

  const isAuthor = !!resourceAuthorId && currentUserId === resourceAuthorId;

  const [localReviews, setLocalReviews] = useState<(MockPeerReview | SupaPeerReview)[]>([]);
  const [recommendations, setRecommendations] = useState<(MockRecommendation | SupaRecommendation)[]>([]);
  const [showRecommendations, setShowRecommendations] = useState<Record<string, boolean>>();
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRecForm, setShowRecForm] = useState(false);
  const [recForm, setRecForm] = useState({
    observations: '',
    strengths: '',
    weaknesses: '',
    suggestions: '',
    decision: decisionOptions[0],
    file_name: 'recommandation.pdf',
  });
  const [submitRecLoading, setSubmitRecLoading] = useState(false);
  const [reviewerProfiles, setReviewerProfiles] = useState<Record<string, { name: string; email: string; initials: string; color: string }>>({});

  const myReview = localReviews.find((r) => r.reviewer_id === currentUserId);

  const completedStepCount = () => {
    switch (resourceStatus) {
      case 'peer_reviewed':
        return 7;
      case 'needs_revision':
        return 5;
      case 'under_review':
        return 4;
      case 'pending_reviewers':
        return 3;
      case 'not_evaluated':
        return 1;
      default:
        return 1;
    }
  };

  const renderReviewer = (id: string) => {
    if (id === currentUserId) {
      return { name: currentUserName, initials: currentUserName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(), color: '#0d9488' };
    }
    const prof = reviewerProfiles?.[id];
    if (prof) return { name: prof.name, initials: prof.initials, color: prof.color };
    return { name: 'Reviewer', initials: '?', color: '#64748b' };
  };

  const renderReviewerAnonymized = (id: string) => {
    if (id === currentUserId) {
      return { name: currentUserName, initials: currentUserName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(), color: '#0d9488', anonymized: false };
    }
    const idx = localReviews.findIndex((r) => r.reviewer_id === id) + 1;
    return {
      name: `Reviewer ${idx || ''}`.trim(),
      initials: `R${idx || ''}`.trim(),
      color: '#94a3b8',
      anonymized: true,
    };
  };

  // Charger les peer reviews et recommendations depuis Supabase + profils des reviewers pour l'admin
  const loadData = useCallback(async () => {
    setIsLoading(true);

    let allReviews: (MockPeerReview | SupaPeerReview)[] = [];
    let allRecs: (MockRecommendation | SupaRecommendation)[] = [];

    try {
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('resource_id', resourceId)
        .order('joined_at', { ascending: true });

      if (!reviewsError && reviewsData) {
        const supaReviews = reviewsData as SupaPeerReview[];
        allReviews = supaReviews;

        // Si admin, fetch les profils complets des reviewers
        if (isAdmin) {
          const reviewerIds = supaReviews.map((r) => r.reviewer_id).filter(Boolean);
          if (reviewerIds.length > 0) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('id, name, email, initials, color')
              .in('id', reviewerIds);
            if (profData) {
              const map: Record<string, { name: string; email: string; initials: string; color: string }> = {};
              for (const p of profData) {
                map[p.id] = {
                  name: p.name || p.email?.split('@')[0] || 'Inconnu',
                  email: p.email || '',
                  initials: p.initials || (p.name || '?').charAt(0).toUpperCase(),
                  color: p.color || '#64748b',
                };
              }
              setReviewerProfiles(map);
            }
          }
        }
      }

      const { data: recsData, error: recsError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('resource_id', resourceId)
        .order('submitted_at', { ascending: true });

      if (!recsData || recsError) return;
        const supaRecs = recsData as SupaRecommendation[];
        allRecs = supaRecs;
    } catch {
      // Silencieux — mocks restent
    }

    setLocalReviews(allReviews);
    setRecommendations(allRecs);
    setIsLoading(false);
  }, [resourceId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcceptReview = async () => {
    if (!myReview) return;
    setActionLoading('accept');
    try {
      const { error } = await supabase
        .from('peer_reviews')
        .update({ status: 'accepted', status_label: 'Accepté' })
        .eq('id', myReview.id);
      if (!error) {
        setLocalReviews((prev) =>
          prev.map((r) => (r.id === myReview.id ? { ...r, status: 'accepted', status_label: 'Accepté' } : r))
        );
      }
    } catch {
      setLocalReviews((prev) =>
        prev.map((r) => (r.id === myReview.id ? { ...r, status: 'accepted', status_label: 'Accepté' } : r))
      );
    }
    setActionLoading(null);
  };

  const handleStartReading = async () => {
    if (!myReview) return;
    setActionLoading('read');
    try {
      const { error } = await supabase
        .from('peer_reviews')
        .update({ status: 'reading', status_label: 'En lecture' })
        .eq('id', myReview.id);
      if (!error) {
        setLocalReviews((prev) =>
          prev.map((r) => (r.id === myReview.id ? { ...r, status: 'reading', status_label: 'En lecture' } : r))
        );
      }
    } catch {
      setLocalReviews((prev) =>
        prev.map((r) => (r.id === myReview.id ? { ...r, status: 'reading', status_label: 'En lecture' } : r))
      );
    }
    setActionLoading(null);
  };

  const handleSubmitRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myReview || !user) return;
    setSubmitRecLoading(true);
    try {
      const { error: recError } = await supabase.from('recommendations').insert({
        resource_id: resourceId,
        reviewer_id: currentUserId,
        reviewer_name: currentUserName,
        file_name: recForm.file_name || 'recommandation.pdf',
        observations: recForm.observations,
        strengths: recForm.strengths,
        weaknesses: recForm.weaknesses,
        suggestions: recForm.suggestions,
        decision: recForm.decision,
        status: 'submitted',
        status_label: 'Soumis',
      });
      if (!recError) {
        const { error: prError } = await supabase
          .from('peer_reviews')
          .update({ status: 'recommendation_submitted', status_label: 'Recommandation soumise', recommendation_submitted: true })
          .eq('id', myReview.id);
        if (!prError) {
          setLocalReviews((prev) =>
            prev.map((r) =>
              r.id === myReview.id
                ? { ...r, status: 'recommendation_submitted', status_label: 'Recommandation soumise', recommendation_submitted: true }
                : r
            )
          );
          setRecommendations((prev) => [
            ...prev,
            {
              id: `rec-${Date.now()}`,
              resource_id: resourceId,
              reviewer_id: currentUserId,
              reviewer_name: currentUserName,
              file_name: recForm.file_name || 'recommandation.pdf',
              submitted_at: new Date().toISOString(),
              status: 'submitted',
              status_label: 'Soumis',
              observations: recForm.observations,
              strengths: recForm.strengths,
              weaknesses: recForm.weaknesses,
              suggestions: recForm.suggestions,
              decision: recForm.decision,
            } as SupaRecommendation,
          ]);
          setShowRecForm(false);
          setRecForm({ observations: '', strengths: '', weaknesses: '', suggestions: '', decision: decisionOptions[0], file_name: 'recommandation.pdf' });
          if (resourceAuthorId && resourceAuthorId !== currentUserId) {
            try {
              await supabase.from('notifications').insert({
                user_id: resourceAuthorId,
                type: 'review',
                title: 'Recommandation soumise',
                message: `${currentUserName} a soumis sa recommandation pour votre ${resourceTypeLabel ? resourceTypeLabel.toLowerCase() : 'ressource'}.`,
                resource_id: resourceId,
              });
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      setLocalReviews((prev) =>
        prev.map((r) =>
          r.id === myReview.id
            ? { ...r, status: 'recommendation_submitted', status_label: 'Recommandation soumise', recommendation_submitted: true }
            : r
        )
      );
      setRecommendations((prev) => [
        ...prev,
        {
          id: `rec-${Date.now()}`,
          resource_id: resourceId,
          reviewer_id: currentUserId,
          reviewer_name: currentUserName,
          file_name: recForm.file_name || 'recommandation.pdf',
          submitted_at: new Date().toISOString(),
          status: 'submitted',
          status_label: 'Soumis',
          observations: recForm.observations,
          strengths: recForm.strengths,
          weaknesses: recForm.weaknesses,
          suggestions: recForm.suggestions,
          decision: recForm.decision,
        } as SupaRecommendation,
      ]);
      setShowRecForm(false);
    }
    setSubmitRecLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const isReviewer = localReviews.some((r) => r.reviewer_id === currentUserId);
  const reviewerCount = localReviews.length;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden p-5 text-center">
          <div className="w-8 h-8 flex items-center justify-center mx-auto mb-3">
            <i className="ri-loader-4-line animate-spin text-ocean-500 text-2xl"></i>
          </div>
          <p className="text-sm text-slate-400">Chargement du peer review...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Reviewers card */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Peer reviewers</h3>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {reviewerCount}/2
          </span>
        </div>
        <div className="p-5">
          {localReviews.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 text-slate-300 mx-auto mb-3">
                <i className="ri-user-search-line text-2xl"></i>
              </div>
              <p className="text-sm text-slate-500 font-medium">Aucun reviewer pour le moment</p>
              <p className="text-xs text-slate-400 mt-1">Deux reviewers sont nécessaires pour démarrer le processus.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localReviews.map((review) => {
                const reviewer = isAdmin ? renderReviewer(review.reviewer_id) : renderReviewerAnonymized(review.reviewer_id);
                const config = statusConfig[review.status] || statusConfig.invited;
                const isMe = review.reviewer_id === currentUserId;
                const prof = isAdmin ? reviewerProfiles?.[review.reviewer_id] ?? null : null;

                return (
                  <div key={review.id} className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                      style={{ backgroundColor: reviewer.color }}
                    >
                      {reviewer.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {reviewer.name}
                        </span>
                        {isMe && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sharek-50 text-sharek-600 border border-sharek-200 w-fit">
                            Vous
                          </span>
                        )}
                        {!isAdmin && (reviewer as {anonymized?: boolean}).anonymized && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 w-fit">
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-eye-off-line"></i>
                            </div>
                            Anonymisé
                          </span>
                        )}
                        {isAdmin && prof && (
                          <span className="text-xs text-slate-400">
                            {prof.email}
                          </span>
                        )}
                      </div>

                      {/* Step progress for this reviewer */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}
                        >
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className={config.icon}></i>
                          </div>
                          {config.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          Étape {config.step} sur 5
                        </span>
                      </div>

                      {/* Step visual bar */}
                      <div className="mt-2 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((step) => (
                          <div
                            key={step}
                            className={`h-1.5 flex-1 rounded-full ${
                              step <= config.step ? 'bg-sharek-400' : 'bg-slate-100'
                            }`}
                          />
                        ))}
                      </div>

                      <p className="text-xs text-slate-400 mt-1.5">
                        Assigné le {formatDate(review.joined_at)}
                      </p>
                      {review.recommendation_submitted && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-sharek-600 mt-1">
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-checkbox-circle-line"></i>
                          </div>
                          Recommandation soumise
                        </span>
                      )}

                      {/* Admin actions */}
                      {isAdmin && review.reviewer_id !== currentUserId && (
                        <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <Link
                            to={`/enseignant/${review.reviewer_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-ocean-600 hover:text-ocean-700 px-2 py-1 rounded-md bg-ocean-50 border border-ocean-100 transition-colors w-fit"
                          >
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-user-line"></i>
                            </div>
                            Voir profil
                          </Link>
                          <Link
                            to={`/messages/${review.reviewer_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-sharek-600 hover:text-sharek-700 px-2 py-1 rounded-md bg-sharek-50 border border-sharek-100 transition-colors w-fit"
                          >
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-mail-send-line"></i>
                            </div>
                            Envoyer un message
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info message when reviewers are pending */}
          {reviewerCount === 1 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-amber-500 mt-0.5">
                <i className="ri-time-line text-sm"></i>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-medium">En attente d'un deuxième reviewer.</span>{' '}
                Le processus de peer reviewing débutera dès que deux reviewers seront confirmés.
              </p>
            </div>
          )}

          {reviewerCount >= 2 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-sharek-50 border border-sharek-200">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-sharek-600 mt-0.5">
                <i className="ri-check-line text-sm"></i>
              </div>
              <p className="text-xs text-sharek-800 leading-relaxed">
                Deux reviewers sont confirmés. Le processus de peer reviewing est en cours.
              </p>
            </div>
          )}

          {/* Workflow actions for the connected reviewer */}
          {isAuthenticated && isReviewer && myReview && (
            <div className="mt-5 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Mes actions de reviewer</p>

              {myReview.status === 'invited' && (
                <button
                  onClick={handleAcceptReview}
                  disabled={actionLoading === 'accept'}
                  className="w-full px-4 py-2.5 bg-ocean-600 hover:bg-ocean-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading === 'accept' ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      En cours...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line"></i>
                      Accepter la review
                    </>
                  )}
                </button>
              )}

              {myReview.status === 'accepted' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Vous avez accepté cette review. Lisez attentivement la ressource avant de passer à la rédaction de la recommandation.
                  </p>
                  <div className="flex gap-2">
                    <a
                      href="#document"
                      className="flex-1 px-3 py-2 text-xs font-medium text-ocean-700 bg-ocean-50 hover:bg-ocean-100 rounded-md transition-colors border border-ocean-200 flex items-center justify-center gap-1.5"
                    >
                      <i className="ri-book-open-line"></i>
                      Lire le document
                    </a>
                    <button
                      onClick={handleStartReading}
                      disabled={actionLoading === 'read'}
                      className="flex-1 px-3 py-2 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      {actionLoading === 'read' ? (
                        <>
                          <i className="ri-loader-4-line animate-spin"></i>
                          En cours...
                        </>
                      ) : (
                        <>
                          <i className="ri-check-double-line"></i>
                          Marquer comme lu
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {myReview.status === 'reading' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Document lu. Vous pouvez maintenant rédiger et soumettre votre recommandation.
                  </p>
                  <button
                    onClick={() => setShowRecForm(true)}
                    className="w-full px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="ri-edit-line"></i>
                    Rédiger la recommandation
                  </button>
                </div>
              )}

              {myReview.status === 'recommendation_submitted' && (
                <div className="flex items-center gap-2 text-sharek-700 bg-sharek-50 border border-sharek-200 rounded-md px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-checkbox-circle-line text-sm"></i>
                  </div>
                  <p className="text-xs font-medium">Recommandation soumise avec succès</p>
                </div>
              )}
            </div>
          )}

          {/* Author message */}
          {isAuthenticated && isAuthor && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-slate-400 mt-0.5">
                <i className="ri-user-forbid-line text-sm"></i>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-medium">Vous êtes l&apos;auteur de cette ressource.</span>{' '}
                Vous ne pouvez pas participer à votre propre peer review. Deux reviewers extérieurs évalueront votre travail.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendation form */}
      {showRecForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">Nouvelle recommandation</h4>
            <button
              onClick={() => setShowRecForm(false)}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
          <form onSubmit={handleSubmitRecommendation} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observations</label>
              <textarea
                value={recForm.observations}
                onChange={(e) => setRecForm((prev) => ({ ...prev, observations: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-none"
                placeholder="Vos observations générales sur la ressource..."
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Points forts</label>
                <textarea
                  value={recForm.strengths}
                  onChange={(e) => setRecForm((prev) => ({ ...prev, strengths: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-none"
                  placeholder="Ce qui fonctionne bien..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Points à améliorer</label>
                <textarea
                  value={recForm.weaknesses}
                  onChange={(e) => setRecForm((prev) => ({ ...prev, weaknesses: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-none"
                  placeholder="Ce qui peut être amélioré..."
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Suggestions</label>
              <textarea
                value={recForm.suggestions}
                onChange={(e) => setRecForm((prev) => ({ ...prev, suggestions: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-none"
                placeholder="Vos suggestions concrètes..."
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Décision finale</label>
                <select
                  value={recForm.decision}
                  onChange={(e) => setRecForm((prev) => ({ ...prev, decision: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
                >
                  {decisionOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom du fichier</label>
                <input
                  type="text"
                  value={recForm.file_name}
                  onChange={(e) => setRecForm((prev) => ({ ...prev, file_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
                  placeholder="recommandation.pdf"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors border border-slate-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitRecLoading}
                className="px-4 py-2 text-xs font-medium text-white bg-sharek-600 hover:bg-sharek-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1.5"
              >
                {submitRecLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Envoi...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line"></i>
                    Soumettre la recommandation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Progress tracker */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Progression globale du peer reviewing</h3>
        </div>
        <div className="p-5">
          <div className="relative space-y-0">
            {reviewSteps.map((step, index) => {
              const completed = index < completedStepCount();
              const isLast = index === reviewSteps.length - 1;

              return (
                <div key={step.step} className="relative flex items-start gap-3 pb-5 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[17px] top-7 w-0.5 ${
                        index < completedStepCount() - 1 ? 'bg-sharek-400' : 'bg-slate-200'
                      }`}
                      style={{ height: 'calc(100% - 14px)' }}
                    />
                  )}
                  {/* Step icon */}
                  <div
                    className={`relative z-10 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full border-2 ${
                      completed
                        ? 'bg-sharek-500 border-sharek-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      {completed ? (
                        <i className="ri-check-line text-sm"></i>
                      ) : (
                        <i className={`${step.icon} text-sm`}></i>
                      )}
                    </div>
                  </div>
                  {/* Step label */}
                  <div className="pt-1.5">
                    <p
                      className={`text-sm font-medium ${
                        completed ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {step.step}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Fichiers de recommandation</h3>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {recommendations.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {recommendations.map((rec) => {
              const reviewer = isAdmin ? renderReviewer(rec.reviewer_id) : renderReviewerAnonymized(rec.reviewer_id);
              const isOpen = showRecommendations?.[rec.id];

              return (
                <div key={rec.id} className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded bg-red-50 text-red-500 flex-shrink-0">
                      <i className="ri-file-pdf-2-line text-lg"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{rec.file_name}</p>
                      <p className="text-xs text-slate-400">
                        Par {reviewer.name} · {formatDate(rec.submitted_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        rec.status === 'submitted'
                          ? 'bg-sharek-50 text-sharek-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {rec.status_label}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      setShowRecommendations((prev) => ({ ...prev, [rec.id]: !prev?.[rec.id] }))
                    }
                    className="text-xs font-medium text-ocean-600 hover:text-ocean-700 flex items-center gap-1"
                  >
                    <i className={isOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
                    {isOpen ? 'Masquer le contenu' : "Voir le contenu de la recommandation"}
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Observations</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{rec.observations}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Points forts</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{rec.strengths}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Points à améliorer</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{rec.weaknesses}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Suggestions</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{rec.suggestions}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Décision finale</p>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${
                            rec.decision.includes('Validé')
                              ? 'bg-sharek-50 text-sharek-700'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          <i className="ri-shield-check-line"></i>
                          {rec.decision}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-default">
                      <i className="ri-eye-off-line"></i>
                      Fichier non téléchargeable
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
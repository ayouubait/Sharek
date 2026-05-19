import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import type { Resource } from '@/mocks/data';
import { useAuth } from '@/contexts/AuthContext';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';

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

const statusColors: Record<
  string,
  { bg: string; border: string; text: string; icon: string; label: string }
> = {
  invited: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    icon: 'ri-mail-line',
    label: 'Invité',
  },
  accepted: {
    bg: 'bg-ocean-50',
    border: 'border-ocean-200',
    text: 'text-ocean-700',
    icon: 'ri-user-follow-line',
    label: 'Accepté',
  },
  reading: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: 'ri-book-open-line',
    label: 'En lecture',
  },
  recommendation_submitted: {
    bg: 'bg-sharek-50',
    border: 'border-sharek-200',
    text: 'text-sharek-700',
    icon: 'ri-file-list-3-line',
    label: 'Recommandation soumise',
  },
};



export default function PeerReview() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Record<string, Resource>>({});
  const [peerReviews, setPeerReviews] = useState<SupaPeerReview[]>([]);
  const [recommendations, setRecommendations] = useState<SupaRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [reviewerProfiles, setReviewerProfiles] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();

  const getResource = (id: string) => resources[id];
  const getReviewer = (id: string) => getDisplayProfile(id, reviewerProfiles);
  const getRecommendation = (resourceId: string, reviewerId: string) =>
    recommendations.find(
      (r) => r.resource_id === resourceId && r.reviewer_id === reviewerId
    );

  const loadData = useCallback(async () => {
    setLoading(true);

    // Ressources depuis Supabase
    const resMap: Record<string, Resource> = {};
    try {
      // Limiter aux ressources potentiellement reviewables (pas peer_reviewed déjà).
      // Cap à 200 pour éviter timeout sur grosses bases.
      const { data: supaResources } = await withTimeout(
        supabase
          .from('resources')
          .select('*')
          .neq('status', 'peer_reviewed')
          .order('created_at', { ascending: false })
          .limit(200),
        8000
      );
      if (supaResources) {
        for (const sr of supaResources as unknown as Resource[]) {
          resMap[sr.id] = sr;
        }
      }
    } catch {
      // ignore
    }
    setResources(resMap);

    // Peer reviews : filtrer par reviewer_id courant
    let allReviews: SupaPeerReview[] = [];

    try {
      if (user?.id) {
        const { data: supaReviews } = await withTimeout(
          supabase
            .from('peer_reviews')
            .select('*')
            .eq('reviewer_id', user.id)
            .order('joined_at', { ascending: false }),
          8000
        );
        if (supaReviews) {
          allReviews = supaReviews as SupaPeerReview[];
        }
      }
    } catch {
      // ignore
    }
    setPeerReviews(allReviews);

    // Recommendations : filtrer par reviewer_id courant
    let allRecs: SupaRecommendation[] = [];

    try {
      if (user?.id) {
        const { data: supaRecs } = await withTimeout(
          supabase
            .from('recommendations')
            .select('*')
            .eq('reviewer_id', user.id)
            .order('submitted_at', { ascending: false }),
          8000
        );
        if (supaRecs) {
          allRecs = supaRecs as SupaRecommendation[];
        }
      }
    } catch {
      // ignore
    }
    setRecommendations(allRecs);

    // Fetch reviewer profiles
    const reviewerIds = [...new Set(allReviews.map((r) => r.reviewer_id))];
    if (reviewerIds.length > 0) {
      const profiles = await fetchProfilesMap(reviewerIds);
      setReviewerProfiles(profiles);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeReviews = peerReviews.filter((pr) => !pr.recommendation_submitted);
  const completedReviews = peerReviews.filter((pr) => pr.recommendation_submitted);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <MainLayout>
      <div className="pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">
              <i className="ri-team-line text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Peer Reviewing</h1>
              <p className="text-sm text-slate-500">
                Suivi des évaluations collaboratives des ressources pédagogiques
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Reviews actives',
              value: activeReviews.length,
              icon: 'ri-user-follow-line',
              color: 'text-ocean-600',
              bg: 'bg-ocean-50',
            },
            {
              label: 'Recommendations soumises',
              value: recommendations.length,
              icon: 'ri-file-list-3-line',
              color: 'text-sharek-600',
              bg: 'bg-sharek-50',
            },
            {
              label: 'Reviews terminées',
              value: completedReviews.length,
              icon: 'ri-shield-check-line',
              color: 'text-teal-600',
              bg: 'bg-teal-50',
            },
            {
              label: 'Ressources en review',
              value: new Set(peerReviews.map((pr) => pr.resource_id)).size,
              icon: 'ri-book-open-line',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-slate-200 p-5 flex items-center gap-4"
            >
              <div className={`w-11 h-11 flex-shrink-0 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <i className={`${stat.icon} text-lg`}></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'active'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            En cours ({activeReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Terminées ({completedReviews.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <div className="w-10 h-10 flex items-center justify-center mx-auto mb-4">
              <i className="ri-loader-4-line animate-spin text-ocean-500 text-3xl"></i>
            </div>
            <p className="text-sm text-slate-400">Chargement des peer reviews...</p>
          </div>
        ) : activeTab === 'active' ? (
          <div className="space-y-4">
            {activeReviews.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-slate-100 text-slate-300 mx-auto mb-4">
                  <i className="ri-user-search-line text-3xl"></i>
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">Aucune review en cours</h3>
                <p className="text-sm text-slate-400">
                  Toutes les peer reviews sont terminées ou aucune ressource n&apos;est en attente de reviewer.
                </p>
              </div>
            ) : (
              activeReviews.map((review) => {
                const resource = getResource(review.resource_id);
                const reviewer = getReviewer(review.reviewer_id);
                const config = statusColors[review.status] || statusColors.invited;


                return (
                  <div
                    key={review.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Resource info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {resource && (
                            <ResourceTypeBadge
                              type={resource?.type || ''}
                              label={resource?.type_label || ''}
                              className="rounded-full px-2 py-0.5"
                              iconClassName="w-3.5 h-3.5"
                            />
                          )}
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.bg} ${config.border} ${config.text}`}>
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className={config.icon}></i>
                            </div>
                            {review.status_label}
                          </span>
                        </div>
                        <Link
                          to={`/ressources/${review.resource_id}`}
                          className="text-sm font-semibold text-slate-800 hover:text-ocean-600 transition-colors line-clamp-1"
                        >
                          {resource?.title || 'Ressource inconnue'}
                        </Link>
                        {resource && (
                          <p className="text-xs text-slate-400 mt-1">
                            {resource.school_level} · {resource.unit} · {resource.duration}
                          </p>
                        )}
                      </div>

                      {/* Reviewer */}
                      <div className="flex items-center gap-3 sm:w-64 flex-shrink-0">
                        <div
                          className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                          style={{ backgroundColor: reviewer?.color || '#94a3b8' }}
                        >
                          {reviewer?.initials || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {reviewer?.name || review.reviewer_id}
                          </p>
                          <p className="text-xs text-slate-400">
                            Rejoint le {formatDate(review.joined_at)}
                          </p>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0">
                        <Link
                          to={`/ressources/${review.resource_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ocean-600 hover:bg-ocean-50 rounded-md transition-colors border border-ocean-200"
                        >
                          <i className="ri-eye-line"></i>
                          Voir la ressource
                        </Link>
                        {review.status === 'invited' && (
                          <Link
                            to={`/ressources/${review.resource_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors"
                          >
                            <i className="ri-check-line"></i>
                            Accepter
                          </Link>
                        )}
                        {review.status === 'accepted' && (
                          <Link
                            to={`/ressources/${review.resource_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
                          >
                            <i className="ri-book-open-line"></i>
                            Lire
                          </Link>
                        )}
                        {review.status === 'reading' && (
                          <Link
                            to={`/ressources/${review.resource_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-sharek-600 hover:bg-sharek-700 rounded-md transition-colors"
                          >
                            <i className="ri-edit-line"></i>
                            Rédiger
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Progress mini-bar */}
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-sharek-500 text-white">
                            <i className="ri-check-line text-[10px]"></i>
                          </div>
                          Assigné
                        </span>
                        <div className="flex-1 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sharek-400 rounded-full"
                            style={{
                              width:
                                review.status === 'invited'
                                  ? '20%'
                                  : review.status === 'accepted'
                                    ? '40%'
                                    : review.status === 'reading'
                                      ? '60%'
                                      : review.status === 'recommendation_submitted'
                                        ? '100%'
                                        : '85%',
                            }}
                          />
                        </div>
                        <span className="flex items-center gap-1">
                          <div className={`w-3.5 h-3.5 flex items-center justify-center rounded-full ${review.recommendation_submitted ? 'bg-sharek-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <i className={`${review.recommendation_submitted ? 'ri-check-line' : 'ri-time-line'} text-[10px]`}></i>
                          </div>
                          Recommandation
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {completedReviews.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-slate-100 text-slate-300 mx-auto mb-4">
                  <i className="ri-shield-check-line text-3xl"></i>
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">Aucune review terminée</h3>
                <p className="text-sm text-slate-400">
                  Les reviews avec recommandation soumise apparaîtront ici.
                </p>
              </div>
            ) : (
              completedReviews.map((review) => {
                const resource = getResource(review.resource_id);
                const reviewer = getReviewer(review.reviewer_id);
                const rec = getRecommendation(review.resource_id, review.reviewer_id);
                const config = statusColors[review.status] || statusColors.invited;


                return (
                  <div
                    key={review.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Resource info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {resource && (
                            <ResourceTypeBadge
                              type={resource?.type || ''}
                              label={resource?.type_label || ''}
                              className="rounded-full px-2 py-0.5"
                              iconClassName="w-3.5 h-3.5"
                            />
                          )}
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.bg} ${config.border} ${config.text}`}>
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className={config.icon}></i>
                            </div>
                            {review.status_label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sharek-50 text-sharek-700">
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-checkbox-circle-line"></i>
                            </div>
                            Recommandation soumise
                          </span>
                        </div>
                        <Link
                          to={`/ressources/${review.resource_id}`}
                          className="text-sm font-semibold text-slate-800 hover:text-ocean-600 transition-colors line-clamp-1"
                        >
                          {resource?.title || 'Ressource inconnue'}
                        </Link>
                        {resource && (
                          <p className="text-xs text-slate-400 mt-1">
                            {resource.school_level} · {resource.unit} · {resource.duration}
                          </p>
                        )}
                      </div>

                      {/* Reviewer */}
                      <div className="flex items-center gap-3 sm:w-64 flex-shrink-0">
                        <div
                          className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                          style={{ backgroundColor: reviewer?.color || '#94a3b8' }}
                        >
                          {reviewer?.initials || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {reviewer?.name || review.reviewer_id}
                          </p>
                          <p className="text-xs text-slate-400">
                            Rejoint le {formatDate(review.joined_at)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0">
                        <Link
                          to={`/ressources/${review.resource_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ocean-600 hover:bg-ocean-50 rounded-md transition-colors border border-ocean-200"
                        >
                          <i className="ri-eye-line"></i>
                          Voir
                        </Link>
                      </div>
                    </div>

                    {/* Recommendation preview */}
                    {rec && (
                      <div className="mx-5 mb-5 bg-slate-50 rounded-lg border border-slate-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded bg-red-50 text-red-500">
                            <i className="ri-file-pdf-2-line"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{rec.file_name}</p>
                            <p className="text-xs text-slate-400">Soumis le {formatDate(rec.submitted_at)}</p>
                          </div>
                          <span
                            className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                              rec.decision.includes('Validé')
                                ? 'bg-sharek-50 text-sharek-700'
                                : 'bg-orange-50 text-orange-700'
                            }`}
                          >
                            {rec.decision}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {rec.observations && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Observations</p>
                              <p className="text-sm text-slate-600 line-clamp-2">{rec.observations}</p>
                            </div>
                          )}
                          {rec.strengths && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Points forts</p>
                              <p className="text-sm text-slate-600 line-clamp-2">{rec.strengths}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
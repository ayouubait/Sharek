import { useMemo } from 'react';
import type { Resource, PeerReview, Comment } from '@/mocks/data';

interface DashboardStatsProps {
  resources: Resource[];
  reviews: PeerReview[];
  comments: Comment[];
  contributionScore: number;
  loading: boolean;
}

function StatCard({
  label,
  value,
  icon,
  color,
  sublabel,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  sublabel?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
    sharek: { bg: 'bg-sharek-50', text: 'text-sharek-700', border: 'border-sharek-100', ring: 'ring-sharek-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', ring: 'ring-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', ring: 'ring-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', ring: 'ring-amber-500' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', ring: 'ring-violet-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', ring: 'ring-rose-500' },
  };

  const c = colorMap[color] || colorMap.sharek;

  return (
    <div className={`relative overflow-hidden rounded-xl border ${c.border} bg-white dark:bg-slate-800 p-5 transition-all hover:shadow-card`}>
      <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full ${c.bg} opacity-50 blur-2xl`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.text}`}>
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={icon}></i>
            </div>
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{value.toLocaleString('fr-FR')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${c.bg} ${c.ring} ring-1 ring-inset opacity-40`} />
    </div>
  );
}

export default function DashboardStats({ resources, reviews, comments, contributionScore, loading }: DashboardStatsProps) {
  const stats = useMemo(() => {
    const totalViews = resources.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalDownloads = resources.reduce((sum, r) => sum + (r.downloads || 0), 0);
    const validated = resources.filter((r) => r.status === 'peer_reviewed').length;
    const underReview = resources.filter((r) => r.status === 'under_review' || r.status === 'pending_reviewers').length;
    const activeReviewerMissions = reviews.filter((r) => !r.recommendation_submitted).length;
    const pendingRevision = resources.filter((r) => r.status === 'needs_revision').length;
    const commentCount = comments.length;

    return {
      totalViews,
      totalDownloads,
      validated,
      underReview,
      activeReviewerMissions,
      pendingRevision,
      commentCount,
      resourceCount: resources.length,
    };
  }, [resources, reviews, comments]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
            <div className="w-9 h-9 rounded-lg bg-slate-200 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Ressources"
          value={stats.resourceCount}
          icon="ri-folder-open-line"
          color="sharek"
          sublabel={`${stats.validated} validée${stats.validated > 1 ? 's' : ''}`}
        />
        <StatCard
          label="Vues totales"
          value={stats.totalViews}
          icon="ri-eye-line"
          color="blue"
          sublabel="Sur vos ressources"
        />
        <StatCard
          label="Téléchargements"
          value={stats.totalDownloads}
          icon="ri-download-line"
          color="emerald"
          sublabel="Tous formats"
        />
        <StatCard
          label="Reviews actives"
          value={stats.activeReviewerMissions}
          icon="ri-team-line"
          color="amber"
          sublabel="En tant que reviewer"
        />
        <StatCard
          label="Commentaires"
          value={stats.commentCount}
          icon="ri-message-3-line"
          color="violet"
          sublabel="Sur vos ressources"
        />
        <StatCard
          label="Score"
          value={contributionScore}
          icon="ri-bar-chart-grouped-line"
          color="rose"
          sublabel="Contribution globale"
        />
      </div>

      {/* Progress bar: resources lifecycle */}
      {stats.resourceCount > 0 && (
        <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Parcours de vos ressources</h3>
            <span className="text-xs text-slate-400">{stats.resourceCount} ressource{stats.resourceCount > 1 ? 's' : ''} au total</span>
          </div>
          <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
            {stats.validated > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(stats.validated / stats.resourceCount) * 100}%` }}
              />
            )}
            {stats.underReview > 0 && (
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(stats.underReview / stats.resourceCount) * 100}%` }}
              />
            )}
            {stats.pendingRevision > 0 && (
              <div
                className="h-full bg-amber-500"
                style={{ width: `${(stats.pendingRevision / stats.resourceCount) * 100}%` }}
              />
            )}
            {stats.resourceCount - stats.validated - stats.underReview - stats.pendingRevision > 0 && (
              <div
                className="h-full bg-slate-300"
                style={{
                  width: `${
                    ((stats.resourceCount - stats.validated - stats.underReview - stats.pendingRevision) / stats.resourceCount) * 100
                  }%`,
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs">
            {stats.validated > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">{stats.validated} Validée{stats.validated > 1 ? 's' : ''}</span>
              </div>
            )}
            {stats.underReview > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600">{stats.underReview} En review</span>
              </div>
            )}
            {stats.pendingRevision > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600">{stats.pendingRevision} À réviser</span>
              </div>
            )}
            {stats.resourceCount - stats.validated - stats.underReview - stats.pendingRevision > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-slate-600">
                  {stats.resourceCount - stats.validated - stats.underReview - stats.pendingRevision} Autre{stats.resourceCount - stats.validated - stats.underReview - stats.pendingRevision > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
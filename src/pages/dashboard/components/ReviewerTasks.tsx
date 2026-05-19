import { useNavigate } from 'react-router-dom';
import type { PeerReview, Resource } from '@/mocks/data';

interface ReviewerTasksProps {
  reviews: PeerReview[];
  resources: Resource[];
  loading: boolean;
}

const reviewStatusConfig: Record<string, { label: string; color: string; bg: string; icon: string; nextStep: string }> = {
  reading: {
    label: 'En lecture',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: 'ri-book-open-line',
    nextStep: 'Lire et analyser le document',
  },
  accepted: {
    label: 'Accepté',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'ri-check-line',
    nextStep: 'Soumettre la recommandation',
  },
  invited: {
    label: 'Invité',
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-50 dark:bg-slate-700/30 border-slate-200',
    icon: 'ri-mail-line',
    nextStep: 'Accepter l\'invitation',
  },
};

export default function ReviewerTasks({ reviews, resources, loading }: ReviewerTasksProps) {
  const navigate = useNavigate();

  // Only show active reviews (not completed with recommendation)
  const activeReviews = reviews.filter((r) => !r.recommendation_submitted);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <i className="ri-team-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mes missions de reviewer</h2>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30">
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeReviews.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <i className="ri-team-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mes missions de reviewer</h2>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center text-slate-300 mb-3">
            <i className="ri-user-follow-line text-xl"></i>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Aucune review en cours</p>
          <p className="text-xs text-slate-400 mt-1">
            Parcourez les ressources pour trouver des sujets à reviewer.
          </p>
          <button
            onClick={() => navigate('/ressources')}
            className="mt-4 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <i className="ri-search-line"></i>
            Trouver une ressource à reviewer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <i className="ri-team-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mes missions de reviewer</h2>
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
            {activeReviews.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        {activeReviews.map((review) => {
          const resource = resources.find((r) => r.id === review.resource_id);
          const cfg = reviewStatusConfig[review.status] || reviewStatusConfig.reading;
          return (
            <div key={review.id} className="p-4 hover:bg-slate-50 dark:bg-slate-700/30/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                  <i className={`${cfg.icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 dark:text-slate-100 truncate">
                      {resource ? resource.title : `Ressource #${review.resource_id.slice(0, 8)}`}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{cfg.nextStep}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => navigate(`/ressources/${review.resource_id}`)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      Accéder à la ressource
                      <i className="ri-arrow-right-line text-[10px]"></i>
                    </button>
                    {review.status === 'accepted' && (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <i className="ri-file-list-3-line text-[10px]"></i>
                        Prêt à recommander
                      </span>
                    )}
                    {review.status === 'reading' && (
                      <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                        <i className="ri-time-line text-[10px]"></i>
                        Analyse en cours
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 dark:bg-slate-700/30/50">
        <button
          onClick={() => navigate('/peer-review')}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 flex items-center gap-1"
        >
          Voir toutes mes reviews
          <i className="ri-arrow-right-line text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}
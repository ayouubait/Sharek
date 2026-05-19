import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import { useNavigate } from 'react-router-dom';
import type { Resource } from '@/mocks/data';

interface AuthorTasksProps {
  resources: Resource[];
  loading: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; action: string; actionColor: string }> = {
  needs_revision: {
    label: 'À réviser',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    action: 'Modifier la ressource',
    actionColor: 'text-orange-600 hover:text-orange-700',
  },
  under_review: {
    label: 'En cours de review',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    action: 'Voir les commentaires',
    actionColor: 'text-blue-600 hover:text-blue-700',
  },
  pending_reviewers: {
    label: 'En attente de reviewers',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    action: 'Inviter des reviewers',
    actionColor: 'text-amber-600 hover:text-amber-700',
  },
  not_evaluated: {
    label: 'Non évalué',
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-50 dark:bg-slate-700/30 border-slate-200',
    action: 'Soumettre au peer review',
    actionColor: 'text-sharek-600 hover:text-sharek-700',
  },
  peer_reviewed: {
    label: 'Validée',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    action: 'Voir la ressource',
    actionColor: 'text-emerald-600 hover:text-emerald-700',
  },
};

export default function AuthorTasks({ resources, loading }: AuthorTasksProps) {
  const navigate = useNavigate();

  const activeResources = resources.filter((r) =>
    ['needs_revision', 'under_review', 'pending_reviewers', 'not_evaluated'].includes(r.status)
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sharek-50 flex items-center justify-center text-sharek-600">
            <i className="ri-stack-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Ce sur quoi je travaille</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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

  if (activeResources.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sharek-50 flex items-center justify-center text-sharek-600">
            <i className="ri-stack-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Ce sur quoi je travaille</h2>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center text-slate-300 mb-3">
            <i className="ri-check-double-line text-xl"></i>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tout est à jour !</p>
          <p className="text-xs text-slate-400 mt-1">Aucune ressource n&apos;attend votre action.</p>
          <button
            onClick={() => navigate('/ressources/ajouter')}
            className="mt-4 text-xs font-medium text-sharek-600 hover:text-sharek-700 flex items-center gap-1"
          >
            <i className="ri-add-line"></i>
            Créer une nouvelle ressource
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sharek-50 flex items-center justify-center text-sharek-600">
            <i className="ri-stack-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Ce sur quoi je travaille</h2>
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-sharek-100 text-sharek-700 text-xs font-bold">
            {activeResources.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        {activeResources.map((r) => {
          const cfg = statusConfig[r.status] || statusConfig.not_evaluated;
          return (
            <div key={r.id} className="p-4 hover:bg-slate-50 dark:bg-slate-700/30/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <i className="ri-file-text-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 dark:text-slate-100 truncate">{r.title}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <ResourceTypeBadge type={r.type} label={r.type_label || undefined} />
                    <span className="text-xs text-slate-400">· {r.school_level}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => navigate(`/ressources/${r.id}`)}
                      className={`text-xs font-medium flex items-center gap-1 ${cfg.actionColor}`}
                    >
                      {cfg.action}
                      <i className="ri-arrow-right-line text-[10px]"></i>
                    </button>
                    {r.status === 'needs_revision' && (
                      <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                        <i className="ri-error-warning-line text-[10px]"></i>
                        Relecture demandée
                      </span>
                    )}
                    {r.status === 'pending_reviewers' && (
                      <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                        <i className="ri-time-line text-[10px]"></i>
                        En attente de pairs
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
          onClick={() => navigate('/mes-ressources')}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 flex items-center gap-1"
        >
          Voir toutes mes ressources
          <i className="ri-arrow-right-line text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}
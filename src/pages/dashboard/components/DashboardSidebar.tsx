import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { NotificationItem } from '@/mocks/data';

interface DashboardSidebarProps {
  stats: {
    totalResources: number;
    activeReviews: number;
    validated: number;
    unreadNotifs: number;
  };
  notifications: NotificationItem[];
  loading: boolean;
  onMarkAllRead: () => void;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'review': return 'ri-user-follow-line';
    case 'comment': return 'ri-message-3-line';
    case 'resource': return 'ri-folder-open-line';
    case 'recommendation': return 'ri-file-list-3-line';
    default: return 'ri-notification-3-line';
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'review': return 'bg-blue-50 text-blue-600';
    case 'comment': return 'bg-amber-50 text-amber-600';
    case 'resource': return 'bg-emerald-50 text-emerald-600';
    case 'recommendation': return 'bg-violet-50 text-violet-600';
    default: return 'bg-slate-100 text-slate-600 dark:text-slate-300';
  }
}

export default function DashboardSidebar({ stats, notifications, loading, onMarkAllRead }: DashboardSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* Quick actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 dark:text-slate-100 mb-3">Actions rapides</h3>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/ressources/ajouter')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-sharek-600 text-white text-sm font-medium hover:bg-sharek-700 transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line"></i>
            </div>
            Ajouter une ressource
          </button>
          <button
            onClick={() => navigate('/ressources')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 transition-colors border border-slate-100"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-search-line"></i>
            </div>
            Explorer les ressources
          </button>
          <button
            onClick={() => navigate('/peer-review')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-100"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-team-line"></i>
            </div>
            Espace peer review
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 dark:text-slate-100 mb-3">En chiffres</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="w-6 h-6 rounded bg-sharek-50 flex items-center justify-center text-sharek-600">
                <i className="ri-folder-line text-xs"></i>
              </div>
              Ressources
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.totalResources}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                <i className="ri-team-line text-xs"></i>
              </div>
              Reviews actives
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.activeReviews}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">
                <i className="ri-shield-check-line text-xs"></i>
              </div>
              Validées
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.validated}</span>
          </div>
        </div>
      </div>

      {/* Notifications mini */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <i className="ri-notification-3-line text-sm"></i>
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 dark:text-slate-100">Notifications</h3>
            {stats.unreadNotifs > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                {stats.unreadNotifs}
              </span>
            )}
          </div>
          {stats.unreadNotifs > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] text-violet-600 hover:text-violet-700 font-medium"
            >
              Tout lire
            </button>
          )}
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
              <i className="ri-notification-off-line"></i>
            </div>
            <p className="text-xs text-slate-400">Aucune notification</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className={`flex gap-2.5 p-3 ${n.read ? 'bg-white' : 'bg-violet-50/30'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationColor(n.type)}`}
                >
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className={getNotificationIcon(n.type)}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${n.read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
                    {n.message}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{n.time}</p>
                </div>
                {!n.read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
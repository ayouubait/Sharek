import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AvatarImage from '@/components/AvatarImage';
import type { ProfileData } from './types';

interface PlatformStats {
  totalUsers: number;
  totalTeachers: number;
  totalResources: number;
  peerReviewedResources: number;
  pendingReviews: number;
  pendingAssignments: number;
  newResources: number;
  revisionNeeded: number;
  totalComments: number;
}

interface PendingTask {
  id: string;
  type: 'resource' | 'review' | 'user' | 'comment';
  title: string;
  subtitle: string;
  date: string;
  severity: 'high' | 'medium' | 'low';
  actionLink: string;
}

interface ActivityItem {
  id: string;
  type: 'resource' | 'user' | 'comment' | 'review';
  title: string;
  description: string;
  date: string;
  actorName?: string;
  actorInitials?: string;
  actorColor?: string;
}

interface RecentResource {
  id: string;
  title: string;
  author_name: string;
  status: string;
  status_label: string;
  created_at: string;
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateFull(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const severityConfig = {
  high: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'ri-alert-line', iconBg: 'bg-rose-100' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'ri-time-line', iconBg: 'bg-amber-100' },
  low: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', icon: 'ri-information-line', iconBg: 'bg-sky-100' },
};

const activityConfig: Record<string, { icon: string; bg: string; color: string }> = {
  resource: { icon: 'ri-file-text-line', bg: 'bg-sharek-50', color: 'text-sharek-600' },
  user: { icon: 'ri-user-add-line', bg: 'bg-slate-100 dark:bg-slate-700/50', color: 'text-slate-600 dark:text-slate-300' },
  comment: { icon: 'ri-message-3-line', bg: 'bg-ocean-50', color: 'text-ocean-600' },
  review: { icon: 'ri-check-double-line', bg: 'bg-emerald-50', color: 'text-emerald-600' },
};

export default function AdminProfileDashboard({ profile }: { profile: ProfileData }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'resources' | 'users' | 'reviews'>('all');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel stats queries
      const [
        { count: totalUsers },
        { count: totalTeachers },
        { count: totalResources },
        { count: peerReviewed },
        { count: pendingReviews },
        { count: newResources },
        { count: revisionNeeded },
        { count: totalComments },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('resources').select('*', { count: 'exact', head: true }),
        supabase.from('resources').select('*', { count: 'exact', head: true }).eq('status', 'peer_reviewed'),
        supabase.from('peer_reviews').select('*', { count: 'exact', head: true }).in('status', ['reading', 'accepted']),
        supabase.from('resources').select('*', { count: 'exact', head: true }).eq('status', 'not_evaluated'),
        supabase.from('resources').select('*', { count: 'exact', head: true }).eq('status', 'needs_revision'),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        totalTeachers: totalTeachers || 0,
        totalResources: totalResources || 0,
        peerReviewedResources: peerReviewed || 0,
        pendingReviews: pendingReviews || 0,
        pendingAssignments: 0,
        newResources: newResources || 0,
        revisionNeeded: revisionNeeded || 0,
        totalComments: totalComments || 0,
      });

      // Pending tasks
      const { data: pendingRes } = await supabase
        .from('resources')
        .select('id, title, status, status_label, created_at, author_id')
        .in('status', ['not_evaluated', 'needs_revision'])
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: pendingReviewsData } = await supabase
        .from('peer_reviews')
        .select('id, resource_id, status, status_label, joined_at')
        .in('status', ['reading', 'accepted'])
        .order('joined_at', { ascending: false })
        .limit(10);

      const { data: recentComments } = await supabase
        .from('comments')
        .select('id, content, type_label, created_at, author_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('id, name, initials, color, role, created_at')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .limit(5);

      // Build tasks
      const builtTasks: PendingTask[] = [];

      if (pendingRes && pendingRes.length > 0) {
        pendingRes.forEach((r) => {
          builtTasks.push({
            id: `res-${r.id}`,
            type: 'resource',
            title: r.title || 'Ressource sans titre',
            subtitle: r.status === 'not_evaluated' ? 'Nouvelle ressource à modérer' : 'Révision demandée par les reviewers',
            date: r.created_at,
            severity: r.status === 'not_evaluated' ? 'medium' : 'high',
            actionLink: `/ressources/${r.id}`,
          });
        });
      }

      if (pendingReviewsData && pendingReviewsData.length > 0) {
        pendingReviewsData.forEach((r) => {
          builtTasks.push({
            id: `rev-${r.id}`,
            type: 'review',
            title: `Review #${r.id.slice(0, 8)}`,
            subtitle: `Statut : ${r.status_label || r.status}`,
            date: r.joined_at,
            severity: 'low',
            actionLink: `/ressources/${r.resource_id}`,
          });
        });
      }

      // Also check if there are resources with pending_reviewers status
      const { data: unassignedRes } = await supabase
        .from('resources')
        .select('id, title, created_at')
        .eq('status', 'pending_reviewers')
        .order('created_at', { ascending: false })
        .limit(5);

      if (unassignedRes && unassignedRes.length > 0) {
        unassignedRes.forEach((r) => {
          builtTasks.push({
            id: `un-${r.id}`,
            type: 'review',
            title: r.title || 'Ressource sans titre',
            subtitle: 'En attente d\'assignation de reviewers',
            date: r.created_at,
            severity: 'medium',
            actionLink: `/admin`,
          });
        });
      }

      setTasks(builtTasks.slice(0, 8));

      // Build activity feed
      const builtActivity: ActivityItem[] = [];

      if (recentUsers) {
        recentUsers.forEach((u) => {
          builtActivity.push({
            id: `user-${u.id}`,
            type: 'user',
            title: u.name || 'Nouvel utilisateur',
            description: u.role === 'teacher' ? 'Enseignant inscrit' : 'Nouveau membre',
            date: u.created_at,
            actorName: u.name,
            actorInitials: u.initials || u.name?.slice(0, 2).toUpperCase() || '??',
            actorColor: u.color || '#0d9488',
          });
        });
      }

      if (pendingRes) {
        pendingRes.slice(0, 5).forEach((r) => {
          builtActivity.push({
            id: `res-act-${r.id}`,
            type: 'resource',
            title: r.title || 'Nouvelle ressource',
            description: r.status === 'not_evaluated' ? 'En attente de modération' : 'Révision demandée',
            date: r.created_at,
          });
        });
      }

      if (recentComments) {
        recentComments.forEach((c) => {
          builtActivity.push({
            id: `com-${c.id}`,
            type: 'comment',
            title: c.type_label || 'Commentaire',
            description: c.content?.slice(0, 80) + (c.content && c.content.length > 80 ? '...' : '') || '',
            date: c.created_at,
          });
        });
      }

      // Sort by date desc
      builtActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(builtActivity.slice(0, 10));
    } catch (err) {
      console.error('Admin dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const filteredActivities = activeTab === 'all'
    ? activities
    : activities.filter((a) => {
        if (activeTab === 'resources') return a.type === 'resource';
        if (activeTab === 'users') return a.type === 'user';
        if (activeTab === 'reviews') return a.type === 'review';
        return true;
      });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
          <div className="h-64 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Utilisateurs', value: stats?.totalUsers ?? 0, sub: `${stats?.totalTeachers ?? 0} enseignants`, icon: 'ri-user-line', color: 'text-slate-700 dark:text-slate-200', bg: 'bg-slate-50 dark:bg-slate-700/30', border: 'border-slate-200 dark:border-slate-700' },
    { label: 'Ressources', value: stats?.totalResources ?? 0, sub: `${stats?.peerReviewedResources ?? 0} validées`, icon: 'ri-file-text-line', color: 'text-sharek-600', bg: 'bg-sharek-50', border: 'border-sharek-100' },
    { label: 'Reviews en cours', value: stats?.pendingReviews ?? 0, sub: `${stats?.newResources ?? 0} nouvelles res.`, icon: 'ri-team-line', color: 'text-ocean-600', bg: 'bg-ocean-50', border: 'border-ocean-100' },
    { label: 'Commentaires', value: stats?.totalComments ?? 0, sub: `${stats?.revisionNeeded ?? 0} à réviser`, icon: 'ri-message-3-line', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ];

  return (
    <div className="space-y-6">
      {/* ===== HEADER ADMIN — clean, no cover ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-md overflow-hidden bg-white mx-auto sm:mx-0 flex-shrink-0">
            <AvatarImage
              src={profile.avatar_url}
              initials={profile.initials}
              color={profile.color}
              alt={profile.name}
              className="w-full h-full"
            />
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
                {profile.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 mx-auto sm:mx-0 w-fit">
                <i className="ri-shield-keyhole-line text-[11px]"></i>
                Administrateur
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 min-w-0">
                <i className="ri-mail-line text-[11px] flex-shrink-0"></i>
                <span className="truncate">{profile.email}</span>
              </span>
              <span className="flex items-center gap-1">
                <i className="ri-calendar-line text-[11px]"></i>
                Membre depuis {formatDateFull(profile.joined_at)}
              </span>
            </div>

            <div className="mt-3 sm:mt-4">
              <button
                onClick={() => navigate('/parametres')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                <i className="ri-settings-4-line text-[11px]"></i>
                Paramètres
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATS ROW ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-5 shadow-soft`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`${card.icon} text-sm`}></i>
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ===== PRIORITÉS + ACTIVITÉ ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Priorités — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center text-amber-500">
                <i className="ri-flag-line text-sm"></i>
              </div>
              À traiter
            </h2>
            <span className="text-xs text-slate-400">{tasks.length} élément{tasks.length > 1 ? 's' : ''}</span>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 shadow-soft text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-3">
                <div className="w-6 h-6 flex items-center justify-center"><i className="ri-check-line text-xl"></i></div>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tout est à jour</p>
              <p className="text-xs text-slate-400 mt-1">Aucune tâche prioritaire en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const cfg = severityConfig[task.severity];
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(task.actionLink)}
                    className={`bg-white rounded-xl border ${cfg.border} p-4 shadow-soft cursor-pointer hover:shadow-card transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center ${cfg.text} flex-shrink-0`}>
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={`${cfg.icon} text-sm`}></i>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{task.subtitle}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{formatDateShort(task.date)}</p>
                      </div>
                      <div className="w-5 h-5 flex items-center justify-center text-slate-300 flex-shrink-0">
                        <i className="ri-arrow-right-s-line text-sm"></i>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mini quick actions below tasks */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-soft">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
              <div className="w-3 h-3 flex items-center justify-center"><i className="ri-dashboard-line text-[10px]"></i></div>
              Accès rapide
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Vue d\'ensemble', path: '/admin', icon: 'ri-dashboard-line', color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200' },
                { label: 'Utilisateurs', path: '/admin', icon: 'ri-user-settings-line', color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200' },
                { label: 'Ressources', path: '/admin', icon: 'ri-file-list-3-line', color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200' },
                { label: 'Messages', path: '/messages', icon: 'ri-message-3-line', color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-all text-left"
                >
                  <div className={`w-7 h-7 rounded-md ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${item.icon} text-xs`}></i></div>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activité — 3 cols */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <i className="ri-pulse-line text-sm"></i>
              </div>
              Activité de la plateforme
            </h2>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 overflow-x-auto max-w-full">
              {[
                { key: 'all', label: 'Tout' },
                { key: 'resources', label: 'Ressources' },
                { key: 'users', label: 'Utilisateurs' },
                { key: 'reviews', label: 'Reviews' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-sharek-600 text-white dark:bg-sharek-500'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center text-slate-400 mb-3">
                  <div className="w-6 h-6 flex items-center justify-center"><i className="ri-time-line text-xl"></i></div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucune activité récente</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filteredActivities.map((act, idx) => {
                  const cfg = activityConfig[act.type];
                  const isFirst = idx === 0;
                  return (
                    <div key={act.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30/50 transition-colors">
                      {/* Timeline dot + line */}
                      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                        <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.color}`}>
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className={`${cfg.icon} text-sm`}></i>
                          </div>
                        </div>
                        {!isFirst && (
                          <div className="w-px flex-1 bg-slate-100 dark:bg-slate-700/50 my-1 min-h-[16px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{act.title}</p>
                          <span className="text-[11px] text-slate-400">{formatDateShort(act.date)}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{act.description}</p>
                        {act.actorName && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: act.actorColor }}
                            >
                              {act.actorInitials}
                            </div>
                            <span className="text-[11px] text-slate-400">{act.actorName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== PLATEFORME HEALTH ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft p-6">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center text-emerald-500">
            <i className="ri-heart-pulse-line text-sm"></i>
          </div>
          Santé de la plateforme
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Resource health */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Ressources</span>
              <span className="text-xs text-slate-400">
                {stats?.peerReviewedResources ?? 0} / {stats?.totalResources ?? 0} validées
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-sharek-500 rounded-full transition-all"
                style={{
                  width: `${stats && stats.totalResources > 0 ? (stats.peerReviewedResources / stats.totalResources) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Review health */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Reviews</span>
              <span className="text-xs text-slate-400">
                {stats?.pendingReviews ?? 0} en cours
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-ocean-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (stats?.pendingReviews ?? 0) * 10)}%` }}
              />
            </div>
          </div>

          {/* User health */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Utilisateurs</span>
              <span className="text-xs text-slate-400">
                {stats?.totalTeachers ?? 0} enseignants
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${stats && stats.totalUsers > 0 ? (stats.totalTeachers / stats.totalUsers) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';
import AdminStats from './components/AdminStats';
import AdminUsers from './components/AdminUsers';
import AdminResources from './components/AdminResources';
import AdminComments from './components/AdminComments';
import AdminPendingReviews from './components/AdminPendingReviews';

const tabs = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: 'ri-dashboard-line' },
  { key: 'users', label: 'Utilisateurs', icon: 'ri-user-settings-line' },
  { key: 'resources', label: 'Ressources', icon: 'ri-folder-shield-line' },
  { key: 'comments', label: 'Commentaires', icon: 'ri-chat-delete-line' },
  { key: 'reviews', label: 'Peer reviews', icon: 'ri-team-line' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [counts, setCounts] = useState({
    users: 0,
    resources: 0,
    comments: 0,
    reviews: 0,
    bannedUsers: 0,
    newUsers7d: 0,
    newResources7d: 0,
    pendingResources: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: usersCount },
        { count: resourcesCount },
        { count: commentsCount },
        { count: reviewsCount },
        { count: bannedCount },
        { count: newUsersCount },
        { count: newResourcesCount },
        { count: pendingCount },
      ] = await Promise.all([
        withTimeout(supabase.from('profiles').select('*', { count: 'exact', head: true }), 8000),
        withTimeout(supabase.from('resources').select('*', { count: 'exact', head: true }), 8000),
        withTimeout(supabase.from('comments').select('*', { count: 'exact', head: true }), 8000),
        withTimeout(supabase.from('peer_reviews').select('*', { count: 'exact', head: true }), 8000),
        withTimeout(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true), 8000),
        withTimeout(supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo), 8000),
        withTimeout(supabase.from('resources').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo), 8000),
        withTimeout(supabase.from('resources').select('*', { count: 'exact', head: true }).eq('status', 'pending_reviewers'), 8000),
      ]);

      setCounts({
        users: usersCount || 0,
        resources: resourcesCount || 0,
        comments: commentsCount || 0,
        reviews: reviewsCount || 0,
        bannedUsers: bannedCount || 0,
        newUsers7d: newUsersCount || 0,
        newResources7d: newResourcesCount || 0,
        pendingResources: pendingCount || 0,
      });
    } catch (err) {
      logger.error('Admin counts fetch error:', err);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-slate-100">Administration</h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm mt-1">Gérez les utilisateurs, modérez les ressources et surveillez l'activité de la plateforme.</p>
      </div>

      {/* Quick link to admin settings */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          to="/admin/parametres"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 whitespace-nowrap"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center">
            <i className="ri-settings-3-line"></i>
          </div>
          Paramètres de la plateforme
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-sharek-600 text-white dark:bg-sharek-500'
                  : 'bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={tab.icon}></i>
              </div>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && <AdminStats counts={counts} loading={loadingCounts} />}
      {activeTab === 'users' && <AdminUsers onCountsRefresh={fetchCounts} />}
      {activeTab === 'resources' && <AdminResources onCountsRefresh={fetchCounts} />}
      {activeTab === 'comments' && <AdminComments onCountsRefresh={fetchCounts} />}
      {activeTab === 'reviews' && <AdminPendingReviews onCountsRefresh={fetchCounts} />}
    </MainLayout>
  );
}
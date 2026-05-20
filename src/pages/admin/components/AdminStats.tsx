import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import GrowthChart from './GrowthChart';
import ResourceDistribution from './ResourceDistribution';
import TopPerformers from './TopPerformers';
import ActivityTimeline from './ActivityTimeline';
import EngagementCards from './EngagementCards';

interface AdminStatsProps {
  counts: {
    users: number;
    resources: number;
    comments: number;
    reviews: number;
    bannedUsers: number;
    newUsers7d: number;
    newResources7d: number;
    pendingResources: number;
  };
  loading: boolean;
}

interface GrowthDataPoint {
  date: string;
  users: number;
  resources: number;
}

interface DistributionItem {
  name: string;
  value: number;
}

interface TopAuthor {
  name: string;
  count: number;
}

interface TopResource {
  id: string;
  title: string;
  authorName: string;
  commentCount: number;
}

interface ActivityEvent {
  id: string;
  type: 'user' | 'resource' | 'comment' | 'review' | 'message' | 'recommendation';
  description: string;
  time: string;
}

interface RawEvent {
  id: string;
  type: ActivityEvent['type'];
  description: string;
  timestamp: string;
}

interface EngagementMetric {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}

const dateRanges = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
];

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  not_evaluated: 'Non évalué',
  pending_reviewers: 'En attente de reviewers',
  in_review: 'En révision',
  needs_revision: 'À réviser',
  published: 'Publié',
  archived: 'Archivé',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
  if (diffHour < 24) return `Il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
  if (diffDay < 30) return `Il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export default function AdminStats({ counts, loading: countsLoading }: AdminStatsProps) {
  const [dateRange, setDateRange] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [typeData, setTypeData] = useState<DistributionItem[]>([]);
  const [statusData, setStatusData] = useState<DistributionItem[]>([]);
  const [topAuthors, setTopAuthors] = useState<TopAuthor[]>([]);
  const [topResources, setTopResources] = useState<TopResource[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetric[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const rangeAgo = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: profilesInRange },
        { data: allResources },
        { data: allComments },
        { data: recentReviews },
        { data: recentMessages },
        { data: recentRecommendations },
      ] = await Promise.all([
        withTimeout(
          supabase.from('profiles').select('id, name, created_at').gte('created_at', rangeAgo).order('created_at', { ascending: true }),
          10000
        ),
        withTimeout(
          supabase.from('resources').select('id, title, type, status, author_id, created_at').order('created_at', { ascending: false }).limit(500),
          10000
        ),
        withTimeout(
          supabase.from('comments').select('id, resource_id, created_at').order('created_at', { ascending: false }).limit(300),
          10000
        ),
        withTimeout(
          supabase.from('peer_reviews').select('id, created_at').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(100),
          10000
        ),
        withTimeout(
          supabase.from('messages').select('id, created_at').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(100),
          10000
        ),
        withTimeout(
          supabase.from('recommendations').select('id, created_at').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(100),
          10000
        ),
      ]);

      // --- Growth Chart Data ---
      const growthMap = new Map<string, GrowthDataPoint>();
      for (let i = dateRange - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        growthMap.set(key, { date: label, users: 0, resources: 0 });
      }

      (profilesInRange || []).forEach((p) => {
        const key = p.created_at.split('T')[0];
        if (growthMap.has(key)) {
          const entry = growthMap.get(key)!;
          entry.users += 1;
        }
      });

      (allResources || []).forEach((r) => {
        const key = r.created_at.split('T')[0];
        if (growthMap.has(key)) {
          const entry = growthMap.get(key)!;
          entry.resources += 1;
        }
      });

      const sortedGrowth = Array.from(growthMap.values());
      setGrowthData(sortedGrowth);

      // --- Resource Type Distribution ---
      const typeCounts: Record<string, number> = {};
      (allResources || []).forEach((r) => {
        const type = r.type || 'Non catégorisé';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      setTypeData(Object.entries(typeCounts).map(([name, value]) => ({ name, value })));

      // --- Resource Status Distribution ---
      const statusCounts: Record<string, number> = {};
      (allResources || []).forEach((r) => {
        const label = statusLabels[r.status || 'draft'] || r.status || 'Brouillon';
        statusCounts[label] = (statusCounts[label] || 0) + 1;
      });
      setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // --- Top Authors ---
      const authorIds = [...new Set((allResources || []).map((r) => r.author_id).filter(Boolean))];
      let profileMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: authorProfiles } = await withTimeout(
          supabase.from('profiles').select('id, name').in('id', authorIds.slice(0, 100)),
          8000
        );
        profileMap = new Map((authorProfiles || []).map((p) => [p.id, p.name || 'Inconnu']));
      }

      const authorCounts: Record<string, number> = {};
      (allResources || []).forEach((r) => {
        if (r.author_id) authorCounts[r.author_id] = (authorCounts[r.author_id] || 0) + 1;
      });

      const authorsList = Object.entries(authorCounts)
        .map(([id, count]) => ({
          name: profileMap.get(id) || 'Inconnu',
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setTopAuthors(authorsList);

      // --- Top Resources by Comments ---
      const commentCounts: Record<string, number> = {};
      (allComments || []).forEach((c) => {
        if (c.resource_id) commentCounts[c.resource_id] = (commentCounts[c.resource_id] || 0) + 1;
      });

      const resourceMap = new Map(
        (allResources || []).map((r) => [r.id, { title: r.title, author_id: r.author_id }])
      );

      const resourcesList = Object.entries(commentCounts)
        .map(([id, count]) => ({
          id,
          title: resourceMap.get(id)?.title || 'Ressource inconnue',
          authorName: profileMap.get(resourceMap.get(id)?.author_id || '') || 'Inconnu',
          commentCount: count,
        }))
        .sort((a, b) => b.commentCount - a.commentCount)
        .slice(0, 10);
      setTopResources(resourcesList);

      // --- Engagement Metrics ---
      const totalResources = (allResources || []).length;
      const totalComments = (allComments || []).length;
      const totalReviews = (recentReviews || []).length;
      const totalMessages = (recentMessages || []).length;
      const totalRecommendations = (recentRecommendations || []).length;

      setEngagementMetrics([
        {
          label: 'Commentaires/ressource',
          value: totalResources > 0 ? (totalComments / totalResources).toFixed(1) : '0',
          icon: 'ri-chat-poll-line',
          color: 'text-amber-600',
          bg: 'bg-amber-50',
        },
        {
          label: 'Reviews (7j)',
          value: String(totalReviews),
          icon: 'ri-team-line',
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          label: 'Messages (7j)',
          value: String(totalMessages),
          icon: 'ri-mail-line',
          color: 'text-slate-600 dark:text-slate-300',
          bg: 'bg-slate-100 dark:bg-slate-700/50',
        },
        {
          label: 'Recommandations (7j)',
          value: String(totalRecommendations),
          icon: 'ri-thumb-up-line',
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
      ]);

      // --- Activity Timeline ---
      const rawEvents: RawEvent[] = [];
      (profilesInRange || []).forEach((p) =>
        rawEvents.push({
          id: `u-${p.id}`,
          type: 'user',
          description: `Nouvel utilisateur inscrit : ${p.name || 'Inconnu'}`,
          timestamp: p.created_at,
        })
      );
      (allResources || []).slice(0, 10).forEach((r) =>
        rawEvents.push({
          id: `r-${r.id}`,
          type: 'resource',
          description: `Nouvelle ressource publiée : ${r.title}`,
          timestamp: r.created_at,
        })
      );
      (allComments || []).slice(0, 10).forEach((c) =>
        rawEvents.push({
          id: `c-${c.id}`,
          type: 'comment',
          description: 'Nouveau commentaire sur une ressource',
          timestamp: c.created_at,
        })
      );
      (recentReviews || []).forEach((r) =>
        rawEvents.push({
          id: `rev-${r.id}`,
          type: 'review',
          description: 'Nouvelle peer review soumise',
          timestamp: r.created_at,
        })
      );
      (recentMessages || []).forEach((m) =>
        rawEvents.push({
          id: `m-${m.id}`,
          type: 'message',
          description: 'Nouveau message échangé',
          timestamp: m.created_at,
        })
      );
      (recentRecommendations || []).forEach((r) =>
        rawEvents.push({
          id: `rec-${r.id}`,
          type: 'recommendation',
          description: 'Nouvelle recommandation publiée',
          timestamp: r.created_at,
        })
      );

      rawEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const recentEvents = rawEvents.slice(0, 15).map((e) => ({
        ...e,
        time: formatRelativeTime(e.timestamp),
      }));
      setEvents(recentEvents);
    } catch (err) {
      logger.error('Analytics fetch error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const kpiCards = [
    { label: 'Utilisateurs', value: counts.users, icon: 'ri-user-line', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Ressources', value: counts.resources, icon: 'ri-folder-open-line', color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Commentaires', value: counts.comments, icon: 'ri-message-3-line', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Peer reviews', value: counts.reviews, icon: 'ri-team-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'En attente de reviewers', value: counts.pendingResources, icon: 'ri-time-line', color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Utilisateurs bannis', value: counts.bannedUsers, icon: 'ri-user-forbid-line', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/50' },
    { label: 'Nouveaux (7j)', value: counts.newUsers7d, icon: 'ri-user-add-line', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Ressources (7j)', value: counts.newResources7d, icon: 'ri-file-add-line', color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={card.icon}></i>
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {countsLoading ? <div className="h-8 w-16 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" /> : card.value}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-white rounded-lg border border-slate-200 dark:border-slate-700 p-1">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setDateRange(range.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                dateRange === range.value
                  ? 'bg-sharek-600 text-white dark:bg-sharek-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={analyticsLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors disabled:opacity-50"
        >
          <div className={`w-4 h-4 flex items-center justify-center ${analyticsLoading ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line"></i>
          </div>
          Actualiser
        </button>
      </div>

      {/* Growth Chart */}
      <GrowthChart data={growthData} />

      {/* Engagement Metrics */}
      <EngagementCards metrics={engagementMetrics} loading={analyticsLoading} />

      {/* Resource Distribution */}
      <ResourceDistribution typeData={typeData} statusData={statusData} />

      {/* Top Performers */}
      <TopPerformers topAuthors={topAuthors} topResources={topResources} />

      {/* Activity Timeline */}
      <ActivityTimeline events={events} />
    </div>
  );
}
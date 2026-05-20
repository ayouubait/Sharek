import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { getTypeConfig } from '@/lib/typeConfig';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Resource, PeerReview } from '@/mocks/data';

interface ActivityItem {
  id: string;
  type: 'resource' | 'review' | 'recommendation' | 'sent_comment' | 'received_comment';
  title: string;
  description: string;
  date: string;
  actorName?: string;
  actorInitials?: string;
  actorColor?: string;
  link?: string;
}

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  resource_id: string;
  author_id: string;
}

interface ProfileRow {
  id: string;
  name: string;
  initials: string;
  color: string;
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

const activityConfig: Record<string, { icon: string; bg: string; color: string }> = {
  resource: { icon: 'ri-file-text-line', bg: 'bg-sharek-50', color: 'text-sharek-600' },
  review: { icon: 'ri-book-open-line', bg: 'bg-ocean-50', color: 'text-ocean-600' },
  recommendation: { icon: 'ri-check-double-line', bg: 'bg-emerald-50', color: 'text-emerald-600' },
  sent_comment: { icon: 'ri-message-2-line', bg: 'bg-slate-100 dark:bg-slate-700/50', color: 'text-slate-600 dark:text-slate-300' },
  received_comment: { icon: 'ri-message-3-line', bg: 'bg-amber-50', color: 'text-amber-600' },
};

interface TeacherActivityFeedProps {
  userId: string;
  resources: Resource[];
  reviews: PeerReview[];
}

export default function TeacherActivityFeed({ userId, resources, reviews }: TeacherActivityFeedProps) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const resourceIds = resources.map((r) => r.id);

      // Sent comments
      const { data: sentData } = await supabase
        .from('comments')
        .select('id, content, created_at, resource_id')
        .eq('author_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      // Received comments on my resources
      let receivedData: CommentRow[] = [];
      if (resourceIds.length > 0) {
        const { data } = await supabase
          .from('comments')
          .select('id, content, created_at, resource_id, author_id')
          .in('resource_id', resourceIds)
          .eq('is_deleted', false)
          .neq('author_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        receivedData = (data as CommentRow[] | null) || [];
      }

      // Fetch authors of received comments
      const authorIds = [...new Set(receivedData.map((c) => c.author_id))];
      let authorsMap: Record<string, ProfileRow> = {};
      if (authorIds.length > 0) {
        const { data: authorsData } = await supabase
          .from('profiles')
          .select('id, name, initials, color')
          .in('id', authorIds);
        (authorsData as ProfileRow[] | null)?.forEach((a) => {
          authorsMap[a.id] = a;
        });
      }

      // Fetch resource titles for reviews
      const reviewResourceIds = [...new Set(reviews.map((r) => r.resource_id))];
      let reviewResourceTitles: Record<string, string> = {};
      if (reviewResourceIds.length > 0) {
        const { data: resData } = await supabase
          .from('resources')
          .select('id, title')
          .in('id', reviewResourceIds);
        (resData as { id: string; title: string }[] | null)?.forEach((r) => {
          reviewResourceTitles[r.id] = r.title;
        });
      }

      const built: ActivityItem[] = [];

      // Resources published
      resources.forEach((r) => {
        built.push({
          id: `res-${r.id}`,
          type: 'resource',
          title: 'Ressource publiée',
          description: `"${r.title}" · ${getTypeConfig(r.type, r.type_label).label} · ${r.school_level}`,
          date: r.created_at,
          link: `/ressources/${r.id}`,
        });
      });

      // Reviews
      reviews.forEach((r) => {
        const resTitle = reviewResourceTitles[r.resource_id] || `Ressource #${r.resource_id.slice(0, 8)}`;
        if (r.recommendation_submitted) {
          built.push({
            id: `rec-${r.id}`,
            type: 'recommendation',
            title: 'Recommandation envoyée',
            description: `Pour "${resTitle}"`,
            date: r.joined_at,
            link: `/ressources/${r.resource_id}`,
          });
        } else {
          built.push({
            id: `rev-${r.id}`,
            type: 'review',
            title: 'Review en cours',
            description: `"${resTitle}" · ${r.status_label || r.status}`,
            date: r.joined_at,
            link: `/ressources/${r.resource_id}`,
          });
        }
      });

      // Sent comments
      (sentData as CommentRow[] | null)?.forEach((c) => {
        const res = resources.find((r) => r.id === c.resource_id);
        built.push({
          id: `sc-${c.id}`,
          type: 'sent_comment',
          title: 'Commentaire envoyé',
          description: `Sur "${res?.title || 'une ressource'}" : ${c.content.slice(0, 70)}${c.content.length > 70 ? '…' : ''}`,
          date: c.created_at,
          link: `/ressources/${c.resource_id}`,
        });
      });

      // Received comments
      receivedData.forEach((c) => {
        const res = resources.find((r) => r.id === c.resource_id);
        const author = authorsMap[c.author_id];
        built.push({
          id: `rc-${c.id}`,
          type: 'received_comment',
          title: `${author?.name || 'Quelqu\'un'} a commenté votre ressource`,
          description: `Sur "${res?.title || 'une ressource'}" : ${c.content.slice(0, 70)}${c.content.length > 70 ? '…' : ''}`,
          date: c.created_at,
          actorName: author?.name,
          actorInitials: author?.initials,
          actorColor: author?.color,
          link: `/ressources/${c.resource_id}`,
        });
      });

      // Sort by date desc
      built.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(built.slice(0, 25));
    } catch (err) {
      logger.error('Activity feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, resources, reviews]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/50 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-1/3" />
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700/50 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center">
          <div className="w-6 h-6 flex items-center justify-center text-slate-400">
            <i className="ri-time-line text-xl"></i>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Aucune activité récente</p>
        <p className="text-xs text-slate-400 mt-1">
          Publiez une ressource ou commentez pour faire vivre votre profil.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
      {activities.map((act, idx) => {
        const cfg = activityConfig[act.type];
        const isLast = idx === activities.length - 1;
        return (
          <div
            key={act.id}
            className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30/50 transition-colors cursor-pointer"
            onClick={() => act.link && navigate(act.link)}
          >
            <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
              <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.color}`}>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`${cfg.icon} text-sm`}></i>
                </div>
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-100 dark:bg-slate-700/50 my-1 min-h-[16px]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{act.title}</p>
                <span className="text-[11px] text-slate-400">{formatDateShort(act.date)}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{act.description}</p>
              {act.actorName && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: act.actorColor || '#94a3b8' }}
                  >
                    {act.actorInitials || '??'}
                  </div>
                  <span className="text-[11px] text-slate-400">{act.actorName}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
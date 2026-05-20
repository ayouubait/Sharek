import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import {
  type Resource,
  type PeerReview,
  type Comment,
  type NotificationItem,
} from '@/mocks/data';
import { withTimeout } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';
import AuthorTasks from './components/AuthorTasks';
import ReviewerTasks from './components/ReviewerTasks';
import CommunityInbox from './components/CommunityInbox';
import DashboardSidebar from './components/DashboardSidebar';
import DashboardStats from './components/DashboardStats';

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [myResources, setMyResources] = useState<Resource[]>([]);
  const [myReviews, setMyReviews] = useState<PeerReview[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userName, setUserName] = useState('');
  const [contributionScore, setContributionScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get profile name + score
      const { data: profileData } = await withTimeout(supabase
        .from('profiles')
        .select('name, contribution_score')
        .eq('id', user.id)
        .maybeSingle(), 8000);

      const displayName = profileData?.name || user.name || user.email?.split('@')[0] || 'Utilisateur';
      setUserName(displayName);
      setContributionScore(profileData?.contribution_score || 0);

      // Resources
      const { data: resourcesData, error: resourcesErr } = await withTimeout(supabase
        .from('resources')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false }), 8000);

      if (resourcesErr) throw resourcesErr;

      const supaResources: Resource[] = (resourcesData || []).map((r) => ({
        id: r.id,
        title: r.title,
        school_level: r.school_level,
        unit: r.unit,
        type: r.type,
        type_label: r.type_label,
        file_url: r.file_url || '',
        file_type: r.file_type || '',
        objectives: r.objectives,
        competencies: r.competencies,
        duration: r.duration,
        keywords: r.keywords || [],
        status: r.status || 'not_evaluated',
        status_label: r.status_label || 'Non évalué',
        author_id: r.author_id,
        created_at: r.created_at,
        views: r.views || 0,
        downloads: r.downloads || 0,
        comments_count: r.comments_count || 0,
      }));

      // Peer reviews
      const { data: reviewsData, error: reviewsErr } = await withTimeout(supabase
        .from('peer_reviews')
        .select('*')
        .eq('reviewer_id', user.id)
        .order('joined_at', { ascending: false }), 8000);

      if (reviewsErr) throw reviewsErr;

      const supaReviews: PeerReview[] = (reviewsData || []).map((r) => ({
        id: r.id,
        resource_id: r.resource_id,
        reviewer_id: r.reviewer_id,
        status: r.status,
        status_label: r.status_label,
        joined_at: r.joined_at,
        recommendation_submitted: r.recommendation_submitted,
      }));

      // Comments on my resources (need resource IDs first)
      const myResourceIds = supaResources.map((r) => r.id);
      let supaComments: Comment[] = [];
      if (myResourceIds.length > 0) {
        const { data: commentsData, error: commentsErr } = await withTimeout(supabase
          .from('comments')
          .select('*')
          .in('resource_id', myResourceIds)
          .order('created_at', { ascending: false })
          .limit(20), 8000);

        if (!commentsErr) {
          supaComments = (commentsData || []).map((c) => ({
            id: c.id,
            resource_id: c.resource_id,
            author_id: c.author_id,
            type: c.type,
            type_label: c.type_label,
            content: c.content,
            created_at: c.created_at,
            likes_count: c.likes_count || 0,
          }));
        }
      }

      // Try notifications from Supabase
      let supaNotifs: NotificationItem[] = [];
      try {
        const { data: notifsData } = await withTimeout(supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10), 8000);

        if (notifsData && notifsData.length > 0) {
          supaNotifs = notifsData.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title || n.type,
            message: n.message,
            time: formatRelativeTime(n.created_at),
            read: n.read,
            resource_id: n.resource_id,
            created_at: n.created_at,
          }));
        }
      } catch (err) {
        logger.warn('Notifications fetch failed', err);
      }

      setMyResources(supaResources);
      setMyReviews(supaReviews);
      setComments(supaComments);
      setNotifications(supaNotifs);
    } catch (err) {
      logger.error('Dashboard data fetch failed', err);
      toast.error('Impossible de charger le tableau de bord. Réessayez plus tard.');
      setUserName(user.name || 'Utilisateur');
      setContributionScore(0);
      setMyResources([]);
      setMyReviews([]);
      setComments([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const myResourceIds = useMemo(() => myResources.map((r) => r.id), [myResources]);

  const stats = useMemo(() => {
    const validated = myResources.filter((r) => r.status === 'peer_reviewed').length;
    const activeReviews = myReviews.filter((r) => !r.recommendation_submitted).length;
    const unreadNotifs = notifications.filter((n) => !n.read).length;
    return {
      totalResources: myResources.length,
      activeReviews,
      validated,
      unreadNotifs,
    };
  }, [myResources, myReviews, notifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    } catch (err) {
      logger.warn('Mark notifications as read failed', err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user]);

  const greetingName = userName.split(' ')[0] || 'Utilisateur';

  // Gather all resource IDs from reviews for title lookup
  const reviewResourceIds = useMemo(() => myReviews.map((r) => r.resource_id), [myReviews]);
  const allNeededResourceIds = useMemo(() => {
    const set = new Set([...myResourceIds, ...reviewResourceIds]);
    return Array.from(set);
  }, [myResourceIds, reviewResourceIds]);

  // Fetch resource titles for reviews if not already in myResources
  const [reviewResources, setReviewResources] = useState<Resource[]>([]);
  useEffect(() => {
    if (allNeededResourceIds.length === 0) return;
    const missingIds = allNeededResourceIds.filter((id) => !myResources.find((r) => r.id === id));
    if (missingIds.length === 0) {
      setReviewResources(myResources);
      return;
    }
    supabase
      .from('resources')
      .select('*')
      .in('id', missingIds)
      .then(({ data }) => {
        const mapped = (data || []).map((r) => ({
          id: r.id,
          title: r.title,
          school_level: r.school_level,
          unit: r.unit,
          type: r.type,
          type_label: r.type_label,
          file_url: r.file_url || '',
          file_type: r.file_type || '',
          objectives: r.objectives,
          competencies: r.competencies,
          duration: r.duration,
          keywords: r.keywords || [],
          status: r.status || 'not_evaluated',
          status_label: r.status_label || 'Non évalué',
          author_id: r.author_id,
          created_at: r.created_at,
          views: r.views || 0,
          downloads: r.downloads || 0,
          comments_count: r.comments_count || 0,
        }));
        setReviewResources([...myResources, ...mapped]);
      });
  }, [allNeededResourceIds.join(','), myResources]);

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-500">Veuillez vous connecter pour accéder au tableau de bord.</p>
          <button
            onClick={() => navigate('/connexion')}
            className="mt-4 px-4 py-2 bg-sharek-600 text-white rounded-lg text-sm font-medium hover:bg-sharek-700"
          >
            Se connecter
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header - single user mention only */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {loading ? 'Chargement...' : `Bonjour, ${greetingName} !`}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Voici ce qui demande votre attention aujourd&apos;hui.
        </p>
      </div>

      {/* Stats KPI */}
      <DashboardStats
        resources={myResources}
        reviews={myReviews}
        comments={comments}
        contributionScore={contributionScore}
        loading={loading}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - actionable content */}
        <div className="lg:col-span-2 space-y-6">
          <AuthorTasks resources={myResources} loading={loading} />
          <ReviewerTasks
            reviews={myReviews}
            resources={reviewResources.length > 0 ? reviewResources : myResources}
            loading={loading}
          />
          <CommunityInbox
            comments={comments}
            myResourceIds={myResourceIds}
            userName={userName}
            loading={loading}
          />
        </div>

        {/* Right column - quick actions + stats + notifications */}
        <div className="lg:col-span-1">
          <DashboardSidebar
            stats={stats}
            notifications={notifications}
            loading={loading}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      </div>
    </MainLayout>
  );
}
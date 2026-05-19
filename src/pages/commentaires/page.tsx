import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/utils';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import MainLayout from '@/components/layout/MainLayout';
import MentionText from '@/components/MentionText';
import AvatarImage from '@/components/AvatarImage';
import type { Comment, Resource } from '@/mocks/data';

interface CommentWithAvatar extends Comment {
  author_avatar_url?: string | null;
}

interface EnrichedComment extends CommentWithAvatar {
  resource_title: string;
  author_name: string;
  author_initials: string;
  author_color: string;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pedagogical: { label: 'Pédagogique', color: 'text-blue-700', bg: 'bg-blue-50', icon: 'ri-lightbulb-line' },
  scientific: { label: 'Scientifique', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'ri-flask-line' },
  technical: { label: 'Technique', color: 'text-slate-700', bg: 'bg-slate-100', icon: 'ri-tools-line' },
  general: { label: 'Général', color: 'text-amber-700', bg: 'bg-amber-50', icon: 'ri-message-3-line' },
};

const tabFilters = [
  { key: 'all', label: 'Tous les commentaires' },
  { key: 'received', label: 'Reçus sur mes ressources' },
  { key: 'sent', label: 'Envoyés par moi' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  return formatDate(dateStr);
}

function enrichComments(
  rawComments: CommentWithAvatar[],
  resources: Resource[],
  profilesMap: Record<string, import('@/lib/profiles').ProfileInfo>
): EnrichedComment[] {
  return rawComments.map((c) => {
    const resource = resources.find((r) => r.id === c.resource_id);
    const profile = profilesMap[c.author_id];
    return {
      ...c,
      resource_title: resource?.title || 'Ressource inconnue',
      author_name: profile?.name || 'Utilisateur',
      author_initials: profile?.initials || '??',
      author_color: profile?.color || '#64748b',
    };
  });
}

export default function Commentaires() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commentsData, setCommentsData] = useState<EnrichedComment[]>([]);
  const [resourcesData, setResourcesData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [authorAvatars, setAuthorAvatars] = useState<Record<string, string | null>>();
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();

  // Charger les avatars des auteurs depuis Supabase profiles
  const loadAuthorAvatars = useCallback(async (authorIds: string[]) => {
    if (authorIds.length === 0) return;
    try {
      const { data, error } = await withTimeout(supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', authorIds), 8000);

      if (!error && data) {
        const map: Record<string, string | null> = {};
        data.forEach((p) => {
          map[p.id] = p.avatar_url;
        });
        setAuthorAvatars((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // Silencieux
    }
  }, []);

  // Charger les likes de l'utilisateur courant
  const loadUserLikes = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const { data, error } = await withTimeout(supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id), 8000);

      if (!error && data) {
        setLikedIds(new Set(data.map((l) => l.comment_id)));
      }
    } catch {
      // Silencieux
    }
  }, [user]);

  // Charger les données initiales
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [commentsRes, resourcesRes] = await Promise.all([
        withTimeout(supabase.from('comments').select('*').order('created_at', { ascending: false }), 8000),
        withTimeout(supabase.from('resources').select('*'), 8000),
      ]);

      const allComments: CommentWithAvatar[] = [];
      const allResources: Resource[] = [];

      if (!commentsRes.error && commentsRes.data) {
        const supaComments = commentsRes.data.map((c) => ({
          id: c.id,
          resource_id: c.resource_id,
          author_id: c.author_id,
          type: c.type,
          type_label: c.type_label,
          content: c.content,
          created_at: c.created_at,
          likes_count: c.likes_count || 0,
          author_avatar_url: null,
        }));
        allComments.push(...supaComments);
      }

      if (!resourcesRes.error && resourcesRes.data) {
        const supaResources = resourcesRes.data.map((r) => ({
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
        allResources.push(...supaResources);
        setResourcesData(allResources);
      }

      // Charger les avatars des auteurs
      const authorIds = [...new Set(allComments.map((c) => c.author_id))];
      await Promise.all([loadAuthorAvatars(authorIds), loadUserLikes()]);
      const profiles = await fetchProfilesMap(authorIds);
      setAuthorProfiles(profiles);

      setCommentsData(enrichComments(allComments, allResources, profiles));
    } catch {
      setCommentsData([]);
    } finally {
      setLoading(false);
    }
  }, [user, loadAuthorAvatars, loadUserLikes]);

  useEffect(() => {
    fetchData();
    loadUserLikes();
  }, [fetchData, loadUserLikes]);

  // Temps réel : écouter les nouveaux commentaires globaux
  useEffect(() => {
    const channel = supabase
      .channel('comments-global-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const newComment = payload.new as Comment;
          // Charger l'avatar de l'auteur si nouveau
          loadAuthorAvatars([newComment.author_id]);
          const resource = resourcesData.find((r) => r.id === newComment.resource_id);
          const profile = authorProfiles[newComment.author_id];
          const enriched: EnrichedComment = {
            ...newComment,
            likes_count: newComment.likes_count || 0,
            resource_title: resource?.title || 'Ressource inconnue',
            author_name: profile?.name || 'Utilisateur',
            author_initials: profile?.initials || '??',
            author_color: profile?.color || '#64748b',
            author_avatar_url: null,
          };
          setCommentsData((prev) => {
            const exists = prev.some((c) => c.id === newComment.id);
            if (exists) return prev;
            return [enriched, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const updated = payload.new as Comment;
          setCommentsData((prev) =>
            prev.map((c) =>
              c.id === updated.id ? { ...c, likes_count: updated.likes_count || 0 } : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resourcesData, loadAuthorAvatars]);

  // Temps réel : écouter les likes
  useEffect(() => {
    const channel = supabase
      .channel('comment-likes-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_likes',
        },
        () => {
          loadUserLikes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_likes',
        },
        () => {
          loadUserLikes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUserLikes]);

  const toggleLike = async (commentId: string) => {
    if (!user) return;
    const isLiked = likedIds.has(commentId);

    if (isLiked) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setCommentsData((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) - 1) } : c
        )
      );
    } else {
      setLikedIds((prev) => new Set(prev).add(commentId));
      setCommentsData((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c
        )
      );
    }

    try {
      if (isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        await supabase
          .from('comments')
          .update({ likes_count: Math.max(0, (commentsData.find((c) => c.id === commentId)?.likes_count || 0) - 1) })
          .eq('id', commentId);
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: user.id,
        });
        await supabase
          .from('comments')
          .update({ likes_count: (commentsData.find((c) => c.id === commentId)?.likes_count || 0) + 1 })
          .eq('id', commentId);
      }
    } catch {
      // Silencieux
    }
  };

  const myResourceIds = useMemo(
    () => new Set(resourcesData.filter((r) => r.author_id === user?.id).map((r) => r.id)),
    [resourcesData, user?.id]
  );

  const filteredComments = useMemo(() => {
    let filtered = [...commentsData];

    // Tab filter
    if (activeTab === 'received') {
      filtered = filtered.filter((c) => myResourceIds.has(c.resource_id));
    } else if (activeTab === 'sent') {
      filtered = filtered.filter((c) => c.author_id === user?.id);
    }

    // Type filter
    if (activeType) {
      filtered = filtered.filter((c) => c.type === activeType);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.content.toLowerCase().includes(q) ||
          c.resource_title.toLowerCase().includes(q) ||
          c.author_name.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [commentsData, activeTab, activeType, searchQuery, myResourceIds, user?.id]);

  const stats = useMemo(() => {
    const total = commentsData.length;
    const received = commentsData.filter((c) => myResourceIds.has(c.resource_id)).length;
    const sent = commentsData.filter((c) => c.author_id === user?.id).length;
    const pedagogical = commentsData.filter((c) => c.type === 'pedagogical').length;
    const scientific = commentsData.filter((c) => c.type === 'scientific').length;
    return { total, received, sent, pedagogical, scientific };
  }, [commentsData, myResourceIds, user?.id]);

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Commentaires</h1>
        <p className="text-slate-500 mt-1">
          Consultez les commentaires reçus sur vos ressources et ceux que vous avez envoyés
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-soft">
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-sm text-slate-500 mt-1">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-soft">
          <div className="text-2xl font-bold text-emerald-700">{stats.received}</div>
          <div className="text-sm text-slate-500 mt-1">Reçus</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-soft">
          <div className="text-2xl font-bold text-blue-700">{stats.sent}</div>
          <div className="text-sm text-slate-500 mt-1">Envoyés</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-soft">
          <div className="text-2xl font-bold text-amber-700">
            {stats.pedagogical + stats.scientific}
          </div>
          <div className="text-sm text-slate-500 mt-1">Expert</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-soft mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabFilters.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-sharek-600 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type chips + search */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setActiveType(activeType === key ? null : key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeType === key
                    ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className={cfg.icon}></i>
                </div>
                {cfg.label}
              </button>
            ))}

            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 w-full sm:w-auto">
              <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                <i className="ri-search-line text-xs"></i>
              </div>
              <input
                type="text"
                placeholder="Rechercher..."
                className="bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 w-full sm:w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <i className="ri-close-line text-xs"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-soft text-center">
          <div className="w-5 h-5 flex items-center justify-center mx-auto mb-2 text-slate-400">
            <i className="ri-loader-4-line animate-spin"></i>
          </div>
          <p className="text-sm text-slate-400">Chargement des commentaires...</p>
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-soft text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 flex items-center justify-center text-slate-400">
              <i className="ri-message-3-line text-2xl"></i>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">Aucun commentaire</h3>
          <p className="text-slate-500 mt-2 text-sm">
            {activeTab === 'received'
              ? "Personne n'a encore commenté vos ressources."
              : activeTab === 'sent'
              ? "Vous n'avez pas encore envoyé de commentaire."
              : 'Aucun commentaire ne correspond à vos filtres.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComments.map((comment) => {
            const tCfg = typeConfig[comment.type] || typeConfig.general;
            const isMyComment = comment.author_id === user?.id;
            const isLiked = likedIds.has(comment.id);
            const likeCount = comment.likes_count || 0;

            return (
              <div
                key={comment.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-soft hover:border-sharek-200 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <AvatarImage
                    src={authorAvatars?.[comment.author_id] || (authorProfiles?.[comment.author_id]?.avatar_url || null)}
                    initials={comment.author_initials}
                    color={comment.author_color}
                    alt={comment.author_name}
                    className="w-10 h-10"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-800 text-sm">
                        {comment.author_name}
                      </span>
                      {isMyComment && (
                        <span className="px-2 py-0.5 rounded-full bg-sharek-50 text-sharek-700 text-[11px] font-medium">
                          Vous
                        </span>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{formatTimeAgo(comment.created_at)}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${tCfg.bg} ${tCfg.color}`}
                      >
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className={`${tCfg.icon} text-[10px]`}></i>
                        </div>
                        {tCfg.label}
                      </span>
                    </div>

                    {/* Resource link */}
                    <Link
                      to={`/ressources/${comment.resource_id}`}
                      className="text-sm text-sharek-600 hover:text-sharek-700 font-medium mb-2 block truncate"
                    >
                      <div className="w-3 h-3 inline-flex items-center justify-center mr-1">
                        <i className="ri-link text-[10px]"></i>
                      </div>
                      {comment.resource_title}
                    </Link>

                    {/* Content with mentions */}
                    <div className="text-sm text-slate-600 leading-relaxed">
                      <MentionText text={comment.content} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        onClick={() => toggleLike(comment.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          isLiked
                            ? 'text-red-500 hover:text-red-600'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i
                            className={
                              isLiked ? 'ri-heart-fill text-sm' : 'ri-heart-line text-sm'
                            }
                          ></i>
                        </div>
                        {likeCount > 0 && <span>{likeCount}</span>}
                        <span>J&apos;aime</span>
                      </button>
                      <Link
                        to={`/ressources/${comment.resource_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-reply-line text-sm"></i>
                        </div>
                        Répondre
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
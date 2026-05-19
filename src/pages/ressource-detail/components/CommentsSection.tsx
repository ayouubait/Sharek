import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Comment as MockComment } from '@/mocks/data';
import { supabase } from '@/lib/supabase';
import MentionText from '@/components/MentionText';
import MentionInput, { MentionUser, extractMentions } from '@/components/MentionInput';
import AvatarImage from '@/components/AvatarImage';

interface CommentsSectionProps {
  resourceId: string;
  resourceAuthorId?: string;
  resourceType?: string;
  resourceTypeLabel?: string;
}

interface SupaComment {
  id: string;
  resource_id: string;
  author_id: string;
  type: string;
  type_label: string;
  content: string;
  created_at: string;
  likes_count: number;
}

interface AuthorProfile {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar_url: string | null;
}

const commentTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  pedagogical: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Pédagogique' },
  scientific: { bg: 'bg-ocean-50', text: 'text-ocean-700', label: 'Scientifique' },
  technical: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Technique' },
  general: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Général' },
};

export default function CommentsSection({ resourceId, resourceAuthorId, resourceType, resourceTypeLabel }: CommentsSectionProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const currentUserId = user?.id || 't1';
  const currentUserName = user?.name || 'Fatima Zahra';
  const currentUserInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'FA';

  const [localComments, setLocalComments] = useState<(MockComment | SupaComment)[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newType, setNewType] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, AuthorProfile>>({});
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  // Charger l'avatar de l'utilisateur courant
  const loadCurrentUserAvatar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setCurrentUserAvatar(data.avatar_url);
      }
    } catch {
      // Silencieux
    }
  }, [user?.id]);

  // Charger tous les profils d'auteurs depuis Supabase
  const loadAuthorProfiles = useCallback(async (authorIds: string[]) => {
    if (authorIds.length === 0) return;
    const uniqueIds = [...new Set(authorIds)];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, initials, color, avatar_url')
        .in('id', uniqueIds);

      if (!error && data) {
        const map: Record<string, AuthorProfile> = {};
        data.forEach((p) => {
          map[p.id] = {
            id: p.id,
            name: p.name || 'Utilisateur',
            initials: p.initials || 'U',
            color: p.color || '#64748b',
            avatar_url: p.avatar_url || null,
          };
        });
        setAuthorProfiles(map);
      }
    } catch {
      // Silencieux
    }
  }, []);

  // Charger tous les utilisateurs pour les @mentions
  const loadMentionUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, initials, color, avatar_url');

      if (!error && data && data.length > 0) {
        setMentionUsers(
          data.map((p) => ({
            id: p.id,
            name: p.name || 'Utilisateur',
            initials: p.initials || '??',
            color: p.color || '#64748b',
            avatar_url: p.avatar_url || null,
          }))
        );
      }
    } catch {
      setMentionUsers([]);
    }
  }, []);

  // Charger les likes de l'utilisateur courant
  const loadUserLikes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId);

      if (!error && data) {
        setLikedIds(new Set(data.map((l) => l.comment_id)));
      }
    } catch {
      // Silencieux
    }
  }, [currentUserId]);

  // Charger les commentaires depuis Supabase + mocks en fallback
  const loadComments = useCallback(async () => {
    setIsLoading(true);
    let allComments: (MockComment | SupaComment)[] = [];

    // Commentaires Supabase
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const supaComments = data.map((c) => ({
          id: c.id,
          resource_id: c.resource_id,
          author_id: c.author_id,
          type: c.type,
          type_label: c.type_label,
          content: c.content,
          created_at: c.created_at,
          likes_count: c.likes_count || 0,
        })) as SupaComment[];
        allComments = supaComments;
      }
    } catch {
      // Silencieux
    }

    // Charger les profils des auteurs
    const authorIds = [...new Set(allComments.map((c) => c.author_id))];
    await Promise.all([loadAuthorProfiles(authorIds), loadMentionUsers(), loadCurrentUserAvatar()]);

    // Trier par date décroissante
    allComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setLocalComments(allComments);
    setIsLoading(false);
  }, [resourceId, loadAuthorProfiles, loadMentionUsers, loadCurrentUserAvatar]);

  useEffect(() => {
    loadComments();
    loadUserLikes();
  }, [loadComments, loadUserLikes]);

  // Temps réel : écouter les nouveaux commentaires et les updates de likes sur cette ressource
  useEffect(() => {
    const channel = supabase
      .channel(`comments-resource-${resourceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `resource_id=eq.${resourceId}`,
        },
        (payload) => {
          const newComment = payload.new as SupaComment;
          loadAuthorProfiles([newComment.author_id]);
          setLocalComments((prev) => {
            const exists = prev.some((c) => c.id === newComment.id);
            if (exists) return prev;
            return [
              { ...newComment, likes_count: newComment.likes_count || 0 },
              ...prev,
            ].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `resource_id=eq.${resourceId}`,
        },
        (payload) => {
          const updated = payload.new as SupaComment;
          setLocalComments((prev) =>
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
  }, [resourceId, loadAuthorProfiles]);

  // Temps réel : écouter les likes sur les commentaires de cette ressource
  useEffect(() => {
    const channel = supabase
      .channel(`comment-likes-${resourceId}`)
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
  }, [resourceId, loadUserLikes]);

  // Fallback local like update if RPC not available
  const toggleLikeLocal = async (commentId: string) => {
    const isLiked = likedIds.has(commentId);

    if (isLiked) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) - 1) } : c
        )
      );
    } else {
      setLikedIds((prev) => new Set(prev).add(commentId));
      setLocalComments((prev) =>
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
          .eq('user_id', currentUserId);
        await supabase
          .from('comments')
          .update({
            likes_count: Math.max(
              0,
              (localComments.find((c) => c.id === commentId)?.likes_count || 0) - 1
            ),
          })
          .eq('id', commentId);
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: currentUserId,
        });
        await supabase
          .from('comments')
          .update({
            likes_count:
              (localComments.find((c) => c.id === commentId)?.likes_count || 0) + 1,
          })
          .eq('id', commentId);
      }
    } catch {
      // Silencieux
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);

    const content = newComment.trim();
    const typeConfig = commentTypeColors[newType] || commentTypeColors.general;

    // Essayer d'insérer dans Supabase d'abord
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          resource_id: resourceId,
          author_id: currentUserId,
          type: newType,
          type_label: typeConfig.label,
          content,
          likes_count: 0,
        })
        .select()
        .single();

      if (!error && data) {
        // Optimistic: ajouter immédiatement au state local pour ne pas dépendre
        // du realtime echo (qui peut être absent si la réplication n'est pas
        // activée sur la table `comments`). Le channel INSERT dédupe par id.
        setLocalComments((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev;
          return [data as MockComment, ...prev];
        });
        setNewComment('');
        setNewType('general');
        setIsSubmitting(false);

        // Envoyer des notifications aux utilisateurs mentionnés
        const mentionedNames = extractMentions(content);
        const notifiedIds = new Set<string>();
        if (resourceAuthorId && resourceAuthorId !== currentUserId) {
          notifiedIds.add(resourceAuthorId);
        }

        for (const mentionName of mentionedNames) {
          const mentionedUser = mentionUsers.find(
            (u) => u.name.toLowerCase() === mentionName.toLowerCase()
          );
          if (
            mentionedUser &&
            mentionedUser.id !== currentUserId &&
            !notifiedIds.has(mentionedUser.id)
          ) {
            try {
              await supabase.from('notifications').insert({
                user_id: mentionedUser.id,
                type: 'mention',
                title: 'Vous avez été mentionné',
                message: `${currentUserName} vous a mentionné dans un commentaire sur ${resourceTypeLabel ? `une ${resourceTypeLabel.toLowerCase()}` : 'une ressource'}.`,
                resource_id: resourceId,
              });
              notifiedIds.add(mentionedUser.id);
            } catch {
              // Silencieux
            }
          }
        }
        return;
      }
    } catch {
      // Fallback local
    }

    // Fallback local si Supabase échoue (mock ID par exemple)
    const comment: MockComment = {
      id: `c-new-${Date.now()}`,
      resource_id: resourceId,
      author_id: currentUserId,
      type: newType,
      type_label: typeConfig.label,
      content,
      created_at: new Date().toISOString(),
      likes_count: 0,
    };
    setLocalComments((prev) => [comment, ...prev]);
    setNewComment('');
    setNewType('general');
    setIsSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderAuthor = (authorId: string) => {
    const profile = authorProfiles[authorId];
    if (profile) {
      return {
        name: profile.name,
        initials: profile.initials,
        color: profile.color,
        avatar: profile.avatar_url,
      };
    }

    if (authorId === currentUserId) {
      return {
        name: currentUserName,
        initials: currentUserInitials,
        color: '#0d9488',
        avatar: currentUserAvatar,
      };
    }

    return { name: 'Utilisateur', initials: '?', color: '#64748b', avatar: null };
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center rounded bg-ocean-50 text-ocean-500">
            <i className="ri-message-3-line text-lg" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Commentaires et évaluation</h3>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
          {localComments.length}
        </span>
      </div>

      {/* Add comment form */}
      {isAuthenticated ? (
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <AvatarImage
              src={currentUserAvatar}
              initials={currentUserInitials}
              color="#0d9488"
              className="w-9 h-9"
            />
            <div className="flex-1 min-w-0">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                users={mentionUsers}
                placeholder="Ajouter un commentaire ou une suggestion d'amélioration... Mentionnez un collègue avec @"
                maxLength={500}
                rows={3}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ocean-200 focus:border-ocean-300"
                  >
                    <option value="general">Général</option>
                    <option value="pedagogical">Pédagogique</option>
                    <option value="scientific">Scientifique</option>
                    <option value="technical">Technique</option>
                  </select>
                  <span className="text-[11px] text-slate-400">{newComment.length}/500</span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-1.5 bg-ocean-600 hover:bg-ocean-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <i className="ri-loader-4-line animate-spin" />
                      Envoi...
                    </span>
                  ) : (
                    'Commenter'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
              <i className="ri-user-line text-lg" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                <Link to="/connexion" className="text-sharek-600 font-medium hover:underline">
                  Connectez-vous
                </Link>{' '}
                pour ajouter un commentaire ou participer à l'évaluation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="divide-y divide-slate-100">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="w-8 h-8 flex items-center justify-center mx-auto mb-3">
              <i className="ri-loader-4-line animate-spin text-ocean-500 text-2xl" />
            </div>
            <p className="text-sm text-slate-400">Chargement des commentaires...</p>
          </div>
        ) : localComments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 text-slate-300 mx-auto mb-3">
              <i className="ri-message-3-line text-2xl" />
            </div>
            <p className="text-sm text-slate-400">Aucun commentaire pour le moment.</p>
            <p className="text-xs text-slate-400 mt-1">Soyez le premier à évaluer cette ressource.</p>
          </div>
        ) : (
          localComments.map((comment) => {
            const author = renderAuthor(comment.author_id);
            const typeConfig = commentTypeColors[comment.type] || commentTypeColors.general;
            const isLiked = likedIds.has(comment.id);
            const likeCount = comment.likes_count || 0;

            return (
              <div key={comment.id} className="p-5 flex items-start gap-3">
                <AvatarImage
                  src={author.avatar}
                  initials={author.initials}
                  color={author.color}
                  alt={author.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                    <span className="text-sm font-semibold text-slate-800">{author.name}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeConfig.bg} ${typeConfig.text} w-fit`}
                    >
                      {typeConfig.label}
                    </span>
                    <span className="text-xs text-slate-400 sm:ml-auto">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                    <MentionText text={comment.content} />
                  </div>

                  {/* Actions row */}
                  {isAuthenticated && (
                    <div className="flex items-center gap-4 mt-2.5">
                      <button
                        onClick={() => toggleLikeLocal(comment.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          isLiked
                            ? 'text-red-500 hover:text-red-600'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i
                            className={isLiked ? 'ri-heart-fill text-sm' : 'ri-heart-line text-sm'}
                          />
                        </div>
                        {likeCount > 0 && <span>{likeCount}</span>}
                        <span>J&apos;aime</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 cursor-not-allowed opacity-50"
                        title="Bientôt disponible"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-reply-line text-sm" />
                        </div>
                        Répondre
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
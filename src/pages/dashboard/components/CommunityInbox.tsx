import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { Comment, Resource } from '@/mocks/data';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';

interface CommunityInboxProps {
  comments: Comment[];
  myResourceIds: string[];
  userName: string;
  loading: boolean;
}

export default function CommunityInbox({ comments, myResourceIds, userName, loading }: CommunityInboxProps) {
  const navigate = useNavigate();
  const [profilesMap, setProfilesMap] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>({});

  useEffect(() => {
    const ids = [...new Set(comments.map((c) => c.author_id))];
    if (ids.length > 0) {
      fetchProfilesMap(ids).then(setProfilesMap);
    }
  }, [comments]);

  // Comments on my resources OR comments mentioning me
  const relevantComments = comments.filter((c) => {
    const onMyResource = myResourceIds.includes(c.resource_id);
    const mentionsMe = userName && c.content.toLowerCase().includes(userName.toLowerCase().split(' ')[0].toLowerCase());
    return onMyResource || mentionsMe;
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <i className="ri-message-3-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Messages de la communauté</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (relevantComments.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <i className="ri-message-3-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Messages de la communauté</h2>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center text-slate-300 mb-3">
            <i className="ri-chat-3-line text-xl"></i>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Boîte de réception vide</p>
          <p className="text-xs text-slate-400 mt-1">
            Aucun commentaire sur vos ressources pour le moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <i className="ri-message-3-line text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Messages de la communauté</h2>
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
            {relevantComments.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        {relevantComments.slice(0, 6).map((comment) => {
          const isMention = userName && comment.content.toLowerCase().includes(userName.toLowerCase().split(' ')[0].toLowerCase());
          const author = getDisplayProfile(comment.author_id, profilesMap);
          return (
            <div key={comment.id} className="p-4 hover:bg-slate-50 dark:bg-slate-700/30/50 transition-colors">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: author.color }}
                >
                  {author.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {author.name}
                    </span>
                    <span className="text-xs text-slate-400">· {formatDate(comment.created_at)}</span>
                    {isMention && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                        <i className="ri-at-line text-[10px]"></i>
                        Mention
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 dark:text-slate-300 mt-1 line-clamp-2">{comment.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => navigate(`/ressources/${comment.resource_id}`)}
                      className="text-xs font-medium text-sharek-600 hover:text-sharek-700 flex items-center gap-1"
                    >
                      Répondre
                      <i className="ri-arrow-right-line text-[10px]"></i>
                    </button>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <i className="ri-heart-line text-[10px]"></i>
                      {comment.likes_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {relevantComments.length > 6 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30/50 dark:bg-slate-700/30">
          <button
            onClick={() => navigate('/commentaires')}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 flex items-center gap-1"
          >
            Voir tous les commentaires
            <i className="ri-arrow-right-line text-[10px]"></i>
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}
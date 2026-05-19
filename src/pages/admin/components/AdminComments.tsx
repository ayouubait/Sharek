import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';

interface AdminCommentsProps {
  onCountsRefresh: () => void;
}

interface CommentRow {
  id: string;
  resource_id: string;
  author_id: string;
  type: string;
  type_label: string | null;
  content: string;
  created_at: string;
  is_deleted: boolean | null;
  likes_count: number | null;
}

export default function AdminComments({ onCountsRefresh }: AdminCommentsProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [authorsMap, setAuthorsMap] = useState<Record<string, string>>();
  const [resourcesMap, setResourcesMap] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('comments')
        .select('id, resource_id, author_id, type, type_label, content, created_at, is_deleted, likes_count')
        .order('created_at', { ascending: false }), 8000);

      if (error) throw error;

      let filtered = data || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (c: CommentRow) =>
            c.content.toLowerCase().includes(q) ||
            (c.type_label || '').toLowerCase().includes(q)
        );
      }

      setComments(filtered);

      // Fetch authors and resources names
      const authorIds = [...new Set(filtered.map((c) => c.author_id))];
      const resourceIds = [...new Set(filtered.map((c) => c.resource_id))];

      if (authorIds.length > 0) {
        const { data: profiles } = await withTimeout(supabase.from('profiles').select('id, name').in('id', authorIds), 8000);
        const aMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { aMap[p.id] = p.name || 'Inconnu'; });
        setAuthorsMap(aMap);
      }

      if (resourceIds.length > 0) {
        const { data: resources } = await withTimeout(supabase.from('resources').select('id, title').in('id', resourceIds), 8000);
        const rMap: Record<string, string> = {};
        (resources || []).forEach((r: any) => { rMap[r.id] = r.title || 'Inconnu'; });
        setResourcesMap(rMap);
      }
    } catch (err) {
      console.error('Comments fetch error:', err);
      setToast({ type: 'error', message: 'Erreur lors du chargement des commentaires.' });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleToggleDelete = async (comment: CommentRow) => {
    setActionLoading(true);
    try {
      const { error } = await withTimeout(supabase
        .from('comments')
        .update({ is_deleted: !comment.is_deleted, deleted_at: !comment.is_deleted ? new Date().toISOString() : null })
        .eq('id', comment.id), 8000);
      if (error) throw error;
      setToast({ type: 'success', message: comment.is_deleted ? 'Commentaire restauré.' : 'Commentaire masqué.' });
      fetchComments();
      onCountsRefresh();
    } catch (err) {
      console.error('Toggle delete error:', err);
      setToast({ type: 'error', message: 'Erreur lors de l\'action.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (commentId: string) => {
    if (!window.confirm('Supprimer définitivement ce commentaire ?')) return;
    setActionLoading(true);
    try {
      // Delete comment likes first
      await withTimeout(supabase.from('comment_likes').delete().eq('comment_id', commentId), 8000);
      const { error } = await withTimeout(supabase.from('comments').delete().eq('id', commentId), 8000);
      if (error) throw error;
      setToast({ type: 'success', message: 'Commentaire supprimé définitivement.' });
      fetchComments();
      onCountsRefresh();
    } catch (err) {
      console.error('Permanent delete error:', err);
      setToast({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setActionLoading(false);
    }
  };

  // auto dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="w-5 h-5 flex items-center justify-center text-slate-400">
          <i className="ri-search-line"></i>
        </div>
        <input
          type="text"
          placeholder="Rechercher dans les commentaires..."
          className="flex-1 bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Comments list */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {comments.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                Aucun commentaire trouvé.
              </div>
            )}
            {comments.map((c) => (
              <div key={c.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors ${c.is_deleted ? 'bg-red-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link to={`/enseignant/${c.author_id}`} className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600">
                        {authorsMap[c.author_id] || 'Inconnu'}
                      </Link>
                      <span className="text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        c.type === 'pedagogical' ? 'bg-sharek-50 text-sharek-600 border-sharek-100' :
                        c.type === 'scientific' ? 'bg-ocean-50 text-ocean-600 border-ocean-100' :
                        c.type === 'technical' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700/50'
                      }`}>
                        {c.type_label || c.type}
                      </span>
                      {c.is_deleted && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                          Masqué
                        </span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${c.is_deleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                      {c.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <Link
                        to={`/ressources/${c.resource_id}`}
                        className="text-xs text-sharek-600 hover:underline"
                      >
                        {resourcesMap[c.resource_id] || 'Ressource'}
                      </Link>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <i className="ri-heart-line"></i> {c.likes_count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleDelete(c)}
                      disabled={actionLoading}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                        c.is_deleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className={c.is_deleted ? 'ri-eye-line' : 'ri-eye-off-line'}></i>
                      </div>
                      {c.is_deleted ? 'Restaurer' : 'Masquer'}
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(c.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-delete-bin-line"></i>
                      </div>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
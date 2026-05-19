import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';


interface ResourceData {
  id: string;
  title: string;
  views: number;
  downloads: number;
  comments_count: number;
  created_at: string;
  status: string;
  status_label: string | null;
  type: string;
  type_label: string | null;
  author_id: string;
  file_url: string | null;
}

interface CommentRow {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
}

interface ReviewRow {
  id: string;
  reviewer_id: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
}

interface RecommendationRow {
  id: string;
  reviewer_id: string;
  score: number;
  status: string;
  created_at: string;
}

interface VersionRow {
  id: string;
  version_number: number;
  created_at: string;
  status: string;
  created_by: string;
}

interface AuthorInfo {
  name: string;
  initials: string;
  color: string;
}

interface ActivityEvent {
  id: string;
  type: 'comment' | 'review' | 'recommendation' | 'version';
  label: string;
  description: string;
  date: string;
  icon: string;
  color: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  not_evaluated: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'ri-draft-line', label: 'Brouillon' },
  pending_reviewers: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'ri-user-search-line', label: 'En attente' },
  under_review: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'ri-eye-line', label: 'En révision' },
  needs_revision: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'ri-edit-line', label: 'À réviser' },
  peer_reviewed: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'ri-check-double-line', label: 'Publié' },
};

const typeColors: Record<string, string> = {
  course: '#14b8a6',
  worksheet: '#f59e0b',
  evaluation: '#ef4444',
  practical: '#0ea5e9',
  simulation: '#8b5cf6',
  slides: '#ec4899',
};

export default function ResourceAnalytics() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30');

  const [resource, setResource] = useState<ResourceData | null>(null);
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch resource + all related analytics data
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchAll() {
      try {
        // 1. Resource
        const { data: resData, error: resErr } = await withTimeout(
          supabase.from('resources').select('*').eq('id', id).single(),
          10000
        );
        if (cancelled) return;
        if (resErr || !resData) {
          setError('Ressource introuvable.');
          setLoading(false);
          return;
        }
        setResource(resData as unknown as ResourceData);

        // 2. Author profile
        const { data: profileData } = await withTimeout(
          supabase.from('profiles').select('name, initials, color').eq('id', resData.author_id).maybeSingle(),
          8000
        );
        if (!cancelled && profileData) {
          setAuthor({
            name: profileData.name || 'Auteur',
            initials: profileData.initials || 'A',
            color: profileData.color || '#94a3b8',
          });
        }

        // 3. Comments (all time — filter client-side by range)
        const { data: commData } = await withTimeout(
          supabase.from('comments').select('id, content, author_id, created_at').eq('resource_id', id).order('created_at', { ascending: true }),
          10000
        );
        if (!cancelled) setComments((commData as CommentRow[]) || []);

        // 4. Peer reviews
        const { data: reviewData } = await withTimeout(
          supabase.from('peer_reviews').select('id, reviewer_id, status, assigned_at, completed_at').eq('resource_id', id).order('assigned_at', { ascending: true }),
          10000
        );
        if (!cancelled) setReviews((reviewData as ReviewRow[]) || []);

        // 5. Recommendations
        const { data: recData } = await withTimeout(
          supabase.from('recommendations').select('id, reviewer_id, score, status, created_at').eq('resource_id', id).order('created_at', { ascending: true }),
          10000
        );
        if (!cancelled) setRecommendations((recData as RecommendationRow[]) || []);

        // 6. Versions
        const { data: verData } = await withTimeout(
          supabase.from('resource_versions').select('id, version_number, created_at, status, created_by').eq('resource_id', id).order('version_number', { ascending: true }),
          10000
        );
        if (!cancelled) setVersions((verData as VersionRow[]) || []);
      } catch (err) {
        console.error('Analytics fetch error:', err);
        if (!cancelled) setError('Erreur lors du chargement des données analytiques.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 flex items-center justify-center">
            <i className="ri-loader-4-line animate-spin text-ocean-500 text-3xl" />
          </div>
          <p className="text-sm text-slate-400 mt-4">Chargement des analytics...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !resource) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <i className="ri-bar-chart-box-line text-2xl" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">{error || 'Ressource introuvable'}</h2>
          <Link to="/ressources" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium rounded-md transition-colors">
            <i className="ri-arrow-left-line" />
            Voir les ressources
          </Link>
        </div>
      </MainLayout>
    );
  }

  // ---- Data processing ----

  const cutoffDate = range === 'all' ? new Date(0) : new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000);

  const filteredComments = comments.filter((c) => new Date(c.created_at) >= cutoffDate);
  const filteredReviews = reviews.filter((r) => new Date(r.assigned_at) >= cutoffDate);
  const filteredRecs = recommendations.filter((r) => new Date(r.created_at) >= cutoffDate);
  const filteredVersions = versions.filter((v) => new Date(v.created_at) >= cutoffDate);

  // Build comment trend chart data
  const dateMap = new Map<string, number>();
  const startDate = range === 'all'
    ? new Date(Math.min(...comments.map(c => new Date(c.created_at).getTime()), Date.now() - 30 * 86400000))
    : new Date(Date.now() - parseInt(range) * 86400000);

  const daysToFill = range === 'all'
    ? Math.max(30, Math.ceil((Date.now() - startDate.getTime()) / 86400000))
    : parseInt(range);

  for (let i = 0; i < daysToFill; i++) {
    const d = new Date(Date.now() - (daysToFill - 1 - i) * 86400000);
    const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    dateMap.set(key, 0);
  }

  filteredComments.forEach((c) => {
    const key = new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    if (dateMap.has(key)) {
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    }
  });

  const commentTrendData = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));

  // Build activity timeline
  const events: ActivityEvent[] = [
    ...filteredComments.map((c) => ({
      id: `c-${c.id}`,
      type: 'comment' as const,
      label: 'Nouveau commentaire',
      description: c.content.slice(0, 80) + (c.content.length > 80 ? '...' : ''),
      date: c.created_at,
      icon: 'ri-message-3-line',
      color: 'bg-teal-50 text-teal-600',
    })),
    ...filteredReviews.map((r) => ({
      id: `r-${r.id}`,
      type: 'review' as const,
      label: r.status === 'completed' ? 'Peer review terminé' : 'Peer review assigné',
      description: r.status === 'completed' ? 'L\'évaluateur a soumis sa revue.' : 'En attente d\'évaluation.',
      date: r.completed_at || r.assigned_at,
      icon: r.status === 'completed' ? 'ri-check-double-line' : 'ri-user-search-line',
      color: r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
    })),
    ...filteredRecs.map((rec) => ({
      id: `rec-${rec.id}`,
      type: 'recommendation' as const,
      label: `Recommandation (${rec.score}/10)`,
      description: `Score de recommandation enregistré.`,
      date: rec.created_at,
      icon: 'ri-star-line',
      color: 'bg-violet-50 text-violet-600',
    })),
    ...filteredVersions.map((v) => ({
      id: `v-${v.id}`,
      type: 'version' as const,
      label: `Version ${v.version_number} publiée`,
      description: v.status === 'active' ? 'Version actuelle' : 'Version archivée',
      date: v.created_at,
      icon: 'ri-git-branch-line',
      color: 'bg-blue-50 text-blue-600',
    })),
  ];

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Score distribution for recommendations
  const scoreDistribution = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  recommendations.forEach((r) => {
    if (r.score >= 1 && r.score <= 10) scoreDistribution[r.score - 1]++;
  });
  const scoreChartData = scoreDistribution.map((count, i) => ({ score: `${i + 1}`, count }));

  // Type color
  const typeColor = typeColors[resource.type] || '#94a3b8';
  const statusCfg = statusColors[resource.status] || statusColors.not_evaluated;

  // Computed stats
  const avgCommentsPerDay = daysToFill > 0 ? (filteredComments.length / daysToFill).toFixed(1) : '0';
  const reviewCompletionRate = reviews.length > 0
    ? Math.round((reviews.filter(r => r.status === 'completed').length / reviews.length) * 100)
    : 0;
  const avgScore = recommendations.length > 0
    ? (recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length).toFixed(1)
    : '—';

  return (
    <MainLayout>
      <div className="pb-8">
        {/* Header */}
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Link to="/ressources" className="hover:text-ocean-600 transition-colors">Ressources</Link>
            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line" /></div>
            <Link to={`/ressources/${resource.id}`} className="hover:text-ocean-600 transition-colors truncate max-w-xs">{resource.title}</Link>
            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line" /></div>
            <span className="text-slate-500">Analytics</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-ocean-50 text-ocean-500">
                <i className="ri-bar-chart-box-line text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Analytics de la ressource</h1>
                <p className="text-sm text-slate-500">{resource.title}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Range toggle */}
              <div className="inline-flex bg-slate-100 rounded-lg p-1">
                {(['7', '30', '90', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      range === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {r === 'all' ? 'Tout' : `${r}j`}
                  </button>
                ))}
              </div>
              <Link
                to={`/ressources/${resource.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                <i className="ri-eye-line" />
                Voir la ressource
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <KpiCard
            icon="ri-eye-line"
            iconColor="text-ocean-500"
            iconBg="bg-ocean-50"
            label="Vues totales"
            value={resource.views.toLocaleString('fr-FR')}
            sub="Depuis la publication"
          />
          <KpiCard
            icon="ri-download-line"
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50"
            label="Téléchargements"
            value={resource.downloads.toLocaleString('fr-FR')}
            sub="Fichiers téléchargés"
          />
          <KpiCard
            icon="ri-message-3-line"
            iconColor="text-teal-500"
            iconBg="bg-teal-50"
            label="Commentaires"
            value={filteredComments.length.toString()}
            sub={range === 'all' ? 'Total' : `Sur ${range}j`}
          />
          <KpiCard
            icon="ri-user-search-line"
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
            label="Peer Reviews"
            value={filteredReviews.length.toString()}
            sub={`${reviewCompletionRate}% complétés`}
          />
          <KpiCard
            icon="ri-git-branch-line"
            iconColor="text-blue-500"
            iconBg="bg-blue-50"
            label="Versions"
            value={versions.length.toString()}
            sub="Révisions publiées"
          />
        </div>

        {/* Engagement mini row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MiniMetric label="Commentaires/jour" value={avgCommentsPerDay} icon="ri-chat-1-line" color="border-teal-200" />
          <MiniMetric label="Score moyen" value={avgScore} icon="ri-star-line" color="border-violet-200" />
          <MiniMetric label="Taux de complétion" value={`${reviewCompletionRate}%`} icon="ri-check-double-line" color="border-emerald-200" />
          <MiniMetric
            label="Âge de la ressource"
            value={Math.ceil((Date.now() - new Date(resource.created_at).getTime()) / 86400000) + 'j'}
            icon="ri-time-line"
            color="border-slate-200"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Comment trend chart */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Tendance des commentaires</h3>
                <p className="text-xs text-slate-400">Nombre de commentaires par jour</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                {filteredComments.length} au total
              </span>
            </div>
            <div className="h-72">
              {commentTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={commentTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorComments" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={typeColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={typeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', fontSize: '12px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={typeColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: typeColor, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      name="Commentaires"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <i className="ri-chat-off-line text-3xl mb-2" />
                  <p className="text-sm">Aucun commentaire sur cette période</p>
                </div>
              )}
            </div>
          </div>

          {/* Score distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Distribution des scores</h3>
            <p className="text-xs text-slate-400 mb-4">Scores des recommandations (1-10)</p>
            <div className="h-72">
              {recommendations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="score" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" fill={typeColor} radius={[4, 4, 0, 0]} name="Recommandations" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <i className="ri-star-off-line text-3xl mb-2" />
                  <p className="text-sm">Aucune recommandation</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Second row: Versions + Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Version timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Historique des versions</h3>
            <p className="text-xs text-slate-400 mb-4">Révisions et itérations de la ressource</p>
            {versions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Aucune version enregistrée</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex-shrink-0">
                      v{v.version_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">Version {v.version_number}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {v.status === 'active' ? 'Active' : 'Archivée'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peer review status */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">État des peer reviews</h3>
            <p className="text-xs text-slate-400 mb-4">Avancement des évaluations</p>
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Aucune peer review assignée</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {reviews.map((r) => {
                  const isDone = r.status === 'completed';
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        <i className={isDone ? 'ri-check-line' : 'ri-time-line'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">Reviewer</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isDone
                            ? `Terminé le ${new Date(r.completed_at!).toLocaleDateString('fr-FR')}`
                            : `Assigné le ${new Date(r.assigned_at).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isDone ? 'Terminé' : 'En cours'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Fil d'activité</h3>
              <p className="text-xs text-slate-400">Tous les événements liés à cette ressource</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-600">
              {events.length} événements
            </span>
          </div>
          {events.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Aucune activité sur cette période</div>
          ) : (
            <div className="relative pl-6 space-y-4 max-h-96 overflow-y-auto pr-1">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-200" />
              {events.slice(0, 50).map((e) => (
                <div key={e.id} className="relative flex items-start gap-3">
                  <div className={`absolute -left-4 top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${e.color}`}>
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className={`${e.icon} text-[10px]`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{e.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatRelativeDate(e.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function KpiCard({ icon, iconColor, iconBg, label, value, sub }: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`${icon} text-sm`} />
          </div>
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function MiniMetric({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${color} p-4 flex items-center gap-3`}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`${icon} text-sm`} />
        </div>
      </div>
      <div>
        <p className="text-lg font-bold text-slate-800">{value}</p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
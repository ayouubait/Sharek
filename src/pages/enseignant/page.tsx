import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getTypeConfig } from '@/lib/typeConfig';
import { computeKIndex, type KIndexBreakdown } from '@/lib/kindex';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import MainLayout from '@/components/layout/MainLayout';
import type { Resource } from '@/mocks/data';



const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  peer_reviewed: { label: 'Peer reviewed', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  not_evaluated: { label: 'Non évalué', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
  under_review: { label: 'En cours de peer reviewing', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending_reviewers: { label: 'En attente de reviewers', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  needs_revision: { label: 'À réviser', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const typeChartColors: Record<string, string> = {
  course: '#14b8a6',
  worksheet: '#f59e0b',
  evaluation: '#ef4444',
  practical: '#0ea5e9',
  simulation: '#8b5cf6',
  slides: '#ec4899',
};

const coverImages: Record<string, string> = {
  course: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20an%20open%20science%20textbook%20with%20molecular%20structures%20floating%20above%2C%20soft%20teal%20and%20sage%20green%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20educational%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=course-cover&orientation=landscape',
  worksheet: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20a%20worksheet%20with%20checkboxes%20and%20pencil%20marks%2C%20soft%20amber%20and%20warm%20orange%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20educational%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=worksheet-cover&orientation=landscape',
  evaluation: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20a%20clipboard%20with%20a%20checklist%2C%20soft%20red%20and%20coral%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20educational%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=eval-cover&orientation=landscape',
  practical: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20a%20laboratory%20flask%20with%20bubbles%2C%20soft%20teal%20and%20ocean%20blue%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20science%20education%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=practical-cover&orientation=landscape',
  simulation: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20a%20computer%20screen%20displaying%20a%20scientific%20model%2C%20soft%20indigo%20and%20violet%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20digital%20education%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=sim-cover&orientation=landscape',
  slides: 'https://readdy.ai/api/search-image?query=Minimalist%20abstract%20illustration%20of%20stacked%20presentation%20slides%20with%20a%20projector%20beam%2C%20soft%20violet%20and%20lavender%20tones%20on%20a%20clean%20white%20background%2C%20modern%20flat%20design%20style%2C%20educational%20theme%2C%20subtle%20grain%20texture%2C%20no%20text%20or%20letters&width=800&height=320&seq=slides-cover&orientation=landscape',
};

function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <Link to="/accueil" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sharek-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SK</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">ShareK</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 leading-tight">شارك</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/accueil" className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">Accueil</Link>
          <Link to="/ressources" className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">Ressources</Link>
          <Link to="/connexion" className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">Connexion</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/connexion" className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap">
            Connexion
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}></i>
            </div>
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-1">
          <Link to="/accueil" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Accueil</Link>
          <Link to="/ressources" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Ressources</Link>
          <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg text-center">Connexion</Link>
        </div>
      )}
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sharek-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">SK</span>
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">ShareK</span>
            <span className="text-slate-400 dark:text-slate-500 text-sm ml-2">شارك</span>
          </div>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500">Plateforme collaborative pour les enseignants de SVT au Maroc</p>
      </div>
    </footer>
  );
}

interface ReviewerProfile {
  reviewer_id: string;
  name: string;
  initials: string;
  color: string;
}

// La logique computeKIndex est désormais centralisée dans @/lib/kindex.ts
// pour éviter la duplication avec /profil et garantir une cohérence entre
// les vues d'auteur et de visiteur. Voir src/lib/kindex.ts.

export default function EnseignantProfil() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<{ id: string; name: string; initials: string; color: string; institution: string; city: string; specialty: string; level: string; bio: string; role: string; avatar: string | null; } | null>(null);
  const [activeTab, setActiveTab] = useState<'profil' | 'analytics'>('analytics');

  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [peerReviewCount, setPeerReviewCount] = useState(0);
  const [assignedReviews, setAssignedReviews] = useState<{
    resourceTitle: string;
    status: string;
    assigned_at: string;
    completed_at: string | null;
  }[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<Record<string, ReviewerProfile>>();
  const [commentsWritten, setCommentsWritten] = useState(0);
  const [reactionsGiven, setReactionsGiven] = useState(0);
  const [reactionsReceived, setReactionsReceived] = useState(0);
  const [kIndexBreakdown, setKIndexBreakdown] = useState<KIndexBreakdown | null>(null);
  const [showKIndexInfo, setShowKIndexInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Try real profile from Supabase first
    let foundTeacher = null;
    try {
      const { data: profile, error } = await withTimeout(
        supabase.from('profiles').select('id, name, initials, color, institution, city, specialty, level, bio, role, avatar_url').eq('id', id).maybeSingle(),
        8000
      );
      if (!error && profile) {
        foundTeacher = {
          id: profile.id,
          name: profile.name || 'Enseignant',
          initials: profile.initials || 'E',
          color: profile.color || '#0d9488',
          institution: profile.institution || '',
          city: profile.city || '',
          specialty: profile.specialty || 'SVT',
          level: profile.level || 'Collège & Lycée',
          bio: profile.bio || '',
          role: profile.role || 'teacher',
          avatar: profile.avatar_url || null,
        };
      }
    } catch {
      // ignore, fallback to mocks below
    }

    setTeacher(foundTeacher);
    if (!foundTeacher) {
      setLoading(false);
      return;
    }

    // 3. Load resources
    let merged: Resource[] = [];
    try {
      const { data, error } = await withTimeout(
        supabase.from('resources').select('*').eq('author_id', id).order('created_at', { ascending: false }),
        8000
      );
      if (!error && data) {
        const supaRes = data as unknown as Resource[];
        merged = supaRes;
      }
    } catch {
      // ignore
    }
    setAllResources(merged);

    // 4. Peer reviews done BY this teacher
    let reviewCount = 0;
    let reviewRows: any[] = [];
    try {
      const { data, error } = await withTimeout(
        supabase.from('peer_reviews').select('id, resource_id, status, assigned_at, completed_at').eq('reviewer_id', id).order('assigned_at', { ascending: false }),
        8000
      );
      if (!error && data) {
        reviewCount = data.length;
        reviewRows = data;
      }
    } catch {
      // ignore
    }

    // 5. Peer reviews ON this teacher's resources
    let resourceReviewRows: any[] = [];
    try {
      const { data, error } = await withTimeout(
        supabase.from('peer_reviews').select('id, reviewer_id, resource_id, status, assigned_at, completed_at').in('resource_id', merged.map((r) => r.id)).order('assigned_at', { ascending: false }),
        8000
      );
      if (!error && data) {
        resourceReviewRows = data;
      }
    } catch {
      // ignore
    }

    // 6. Comments written by this teacher
    let writtenCount = 0;
    try {
      const { data, error } = await withTimeout(
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('author_id', id),
        8000
      );
      if (!error && data !== null) {
        writtenCount = (data as any).count || 0;
      }
    } catch {
      // ignore
    }
    if (writtenCount === 0) {
      // fallback proxy from mock using the locally computed reviewCount
      writtenCount = Math.floor(reviewCount * 0.8 + merged.length * 1.2);
    }
    setCommentsWritten(writtenCount);

    // 7. Reactions given by this teacher
    let givenCount = 0;
    try {
      const { data, error } = await withTimeout(
        supabase.from('comment_likes').select('id', { count: 'exact', head: true }).eq('user_id', id),
        8000
      );
      if (!error && data !== null) {
        givenCount = (data as any).count || 0;
      }
    } catch {
      // ignore
    }
    if (givenCount === 0) {
      givenCount = Math.floor(writtenCount * 0.6 + reviewCount * 0.4);
    }
    setReactionsGiven(givenCount);

    // 8. Reactions received (on comments under their resources)
    let receivedCount = 0;
    try {
      const resourceIds = merged.map((r) => r.id);
      if (resourceIds.length > 0) {
        const { data: commentIds } = await withTimeout(
          supabase.from('comments').select('id').in('resource_id', resourceIds),
          8000
        );
        if (commentIds && commentIds.length > 0) {
          const { data, error } = await withTimeout(
            supabase.from('comment_likes').select('id', { count: 'exact', head: true }).in('comment_id', commentIds.map((c: any) => c.id)),
            8000
          );
          if (!error && data !== null) {
            receivedCount = (data as any).count || 0;
          }
        }
      }
    } catch {
      // ignore
    }
    if (receivedCount === 0) {
      const fallbackComments = merged.reduce((acc, r) => acc + (r.comments_count || 0), 0);
      const fallbackDownloads = merged.reduce((acc, r) => acc + (r.downloads || 0), 0);
      receivedCount = Math.floor(fallbackComments * 0.5 + fallbackDownloads * 0.1);
    }
    setReactionsReceived(receivedCount);

    // Fetch reviewer profiles
    const reviewerIds = [...new Set(resourceReviewRows.map((r) => r.reviewer_id).filter(Boolean))];
    if (reviewerIds.length > 0) {
      try {
        const { data: profs } = await withTimeout(
          supabase.from('profiles').select('id, name, initials, color').in('id', reviewerIds),
          8000
        );
        const map: Record<string, ReviewerProfile> = {};
        (profs || []).forEach((p: any) => {
          map[p.id] = {
            reviewer_id: p.id,
            name: p.name || 'Inconnu',
            initials: p.initials || '?',
            color: p.color || '#94a3b8',
          };
        });
        setReviewerProfiles(map);
      } catch {
        // ignore
      }
    }

    // Build assigned reviews list
    const reviewList = reviewRows.map((r) => {
      const res = merged.find((m) => m.id === r.resource_id);
      return {
        resourceTitle: res?.title || 'Ressource inconnue',
        status: r.status,
        assigned_at: r.assigned_at,
        completed_at: r.completed_at,
      };
    });
    setAssignedReviews(reviewList);


    setPeerReviewCount(reviewCount);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalculate K-index whenever dependent data changes
  useEffect(() => {
    if (!teacher || loading) return;

    const totalViews = allResources.reduce((acc, r) => acc + (r.views || 0), 0);
    const totalDownloads = allResources.reduce((acc, r) => acc + (r.downloads || 0), 0);
    const totalComments = allResources.reduce((acc, r) => acc + (r.comments_count || 0), 0);
    const avgViews = allResources.length > 0 ? Math.round(totalViews / allResources.length) : 0;
    const completed = assignedReviews.filter((r) => r.status === 'completed').length;
    const pending = assignedReviews.filter((r) => r.status !== 'completed').length;

    const breakdown = computeKIndex({
      allResources,
      totalViews,
      totalDownloads,
      totalComments,
      avgViews,
      peerReviewCount,
      completedReviews: completed,
      pendingReviews: pending,
      assignedReviews: assignedReviews.length,
      commentsWritten,
      reactionsGiven,
      reactionsReceived,
    });
    setKIndexBreakdown(breakdown);
  }, [allResources, peerReviewCount, assignedReviews, commentsWritten, reactionsGiven, reactionsReceived, teacher, loading]);

  if (!teacher) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
            <i className="ri-user-unfollow-line text-2xl text-slate-400 dark:text-slate-500"></i>
          </div>
          <h1 className="text-lg font-semibold text-slate-700">Enseignant non trouvé</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2">
            Cet enseignant n&apos;existe pas dans notre base de données.
          </p>
          <Link
            to="/accueil"
            className="mt-4 inline-flex items-center gap-1 text-sm text-sharek-600 hover:underline"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line"></i>
            </div>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const totalViews = allResources.reduce((acc, r) => acc + (r.views || 0), 0);
  const totalDownloads = allResources.reduce((acc, r) => acc + (r.downloads || 0), 0);
  const totalComments = allResources.reduce((acc, r) => acc + (r.comments_count || 0), 0);
  const avgViews = allResources.length > 0 ? Math.round(totalViews / allResources.length) : 0;

  const contributionScore = Math.round(
    allResources.length * 1.5 +
    totalViews * 0.01 +
    totalDownloads * 0.02 +
    peerReviewCount * 1.2
  );

  // Resources by type for pie chart
  const typeDistribution = Object.entries(
    allResources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({
    name: getTypeConfig(type).label,
    value: count,
    color: typeChartColors[type] || '#94a3b8',
  }));

  // Resources performance bar chart
  const resourcePerformance = allResources
    .map((r) => ({
      name: r.title.length > 20 ? r.title.slice(0, 20) + '...' : r.title,
      fullName: r.title,
      views: r.views || 0,
      downloads: r.downloads || 0,
      comments: r.comments_count || 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const completedReviews = assignedReviews.filter((r) => r.status === 'completed');
  const pendingReviews = assignedReviews.filter((r) => r.status !== 'completed');

  const pageContent = (
    <>
      {/* Teacher Hero */}
      <section className="bg-white dark:bg-slate-900 pt-6 pb-4">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <Link
            to={user ? '/dashboard' : '/accueil'}
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-sharek-600 mb-6 transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line"></i>
            </div>
            {user ? 'Retour au tableau de bord' : 'Retour à l\'accueil'}
          </Link>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: teacher.color }}
            >
              {teacher.initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{teacher.name}</h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                {teacher.institution}, {teacher.city}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sharek-50 text-sharek-700 text-sm font-medium">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-graduation-cap-line text-xs"></i>
                  </div>
                  {teacher.specialty}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ocean-50 text-ocean-700 text-sm font-medium">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-school-line text-xs"></i>
                  </div>
                  {teacher.level}
                </span>
                {teacher.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-shield-star-line text-xs"></i>
                    </div>
                    Administrateur
                  </span>
                )}
                {teacher.role === 'reviewer' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium">
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-team-line text-xs"></i>
                    </div>
                    Peer reviewer
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">{teacher.bio}</p>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {user ? (
                  <Link
                    to={`/messages/${teacher.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-ocean-600 rounded-lg hover:bg-ocean-700 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <i className="ri-mail-send-line"></i>
                    Contacter
                  </Link>
                ) : (
                  <Link
                    to="/connexion"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ocean-700 bg-ocean-50 border border-ocean-200 rounded-lg hover:bg-ocean-100 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-login-box-line"></i>
                    Se connecter pour contacter
                  </Link>
                )}
                <Link
                  to={`/ressources?author=${teacher.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ocean-700 bg-ocean-50 border border-ocean-200 rounded-lg hover:bg-ocean-100 transition-colors whitespace-nowrap"
                >
                  <i className="ri-folder-open-line"></i>
                  Voir les ressources
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-ocean-600 shadow-sm">
                    <i className="ri-folder-line text-lg"></i>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {loading ? (
                        <i className="ri-loader-4-line animate-spin text-slate-400 dark:text-slate-500 text-base"></i>
                      ) : (
                        allResources.length
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Ressources</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-emerald-600 shadow-sm">
                    <i className="ri-team-line text-lg"></i>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {loading ? (
                        <i className="ri-loader-4-line animate-spin text-slate-400 dark:text-slate-500 text-base"></i>
                      ) : (
                        peerReviewCount
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Peer reviews</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-amber-600 shadow-sm">
                    <i className="ri-award-line text-lg"></i>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {loading ? (
                        <i className="ri-loader-4-line animate-spin text-slate-400 dark:text-slate-500 text-base"></i>
                      ) : (
                        contributionScore
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Score de contribution</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowKIndexInfo(true)}
                  className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-left hover:bg-rose-50 transition-colors group"
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-rose-600 shadow-sm group-hover:shadow">
                    <i className="ri-pulse-line text-lg"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {loading || !kIndexBreakdown ? (
                        <i className="ri-loader-4-line animate-spin text-slate-400 dark:text-slate-500 text-base"></i>
                      ) : (
                        kIndexBreakdown.kIndex.toFixed(1)
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      K-index
                      <i className="ri-information-line text-slate-400 dark:text-slate-500 group-hover:text-rose-500 transition-colors"></i>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* K-index Info Modal */}
      {showKIndexInfo && kIndexBreakdown && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowKIndexInfo(false)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <i className="ri-pulse-line text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">K-index</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Indice d&apos;impact communautaire</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKIndexInfo(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <i className="ri-close-line text-lg"></i>
                </button>
              </div>

              <div className="bg-rose-50 rounded-xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-rose-600 font-medium uppercase tracking-wide">Score final</p>
                  <p className="text-3xl font-bold text-rose-700">{kIndexBreakdown.kIndex.toFixed(1)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-rose-500">Score pondéré brut</p>
                  <p className="text-lg font-semibold text-rose-600">{kIndexBreakdown.weightedScore.toFixed(2)}</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Le <strong>K-index</strong> s'inspire du <strong>H-index</strong> des chercheurs.
                Il mesure à la fois la <strong>quantité</strong> et la <strong>qualité</strong> de l'impact :
                un enseignant avec un K-index de 3 a au moins 3 ressources dont chacune a accumulé
                au moins 3 points d'impact (vues, téléchargements, commentaires).
                Les peer reviews et l'engagement communautaire ajoutent un petit bonus décimal.
              </p>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-2">Comment lire le K-index :</p>
                <ul className="space-y-1.5 list-disc list-inside text-xs">
                  <li><strong>0.0 – 0.5</strong> : Nouveau sur la plateforme, premières contributions</li>
                  <li><strong>0.6 – 1.5</strong> : Contributeur actif avec quelques ressources impactantes</li>
                  <li><strong>1.6 – 3.0</strong> : Auteur établi, ressources régulièrement consultées</li>
                  <li><strong>3.1 – 5.0</strong> : Contributeur majeur, forte influence sur la communauté</li>
                  <li><strong>5.0+</strong> : Référence ShareK, impact significatif et durable</li>
                </ul>
              </div>

              <div className="space-y-3 mb-5">
                <DimensionRow
                  label="Publishing Impact (H-index)"
                  weight={65}
                  value={kIndexBreakdown.publishingDim}
                  icon="ri-file-upload-line"
                  color="bg-ocean-50 text-ocean-600"
                  desc="H-index des ressources : max k tel que k ressources aient chacune ≥ k points d'impact (vues + DL×2 + comm.×3)"
                />
                <DimensionRow
                  label="Peer Review Activity"
                  weight={20}
                  value={kIndexBreakdown.reviewDim}
                  icon="ri-team-line"
                  color="bg-emerald-50 text-emerald-600"
                  desc="Bonus : reviews complétés ×0.1 + en cours ×0.03"
                />
                <DimensionRow
                  label="Community Engagement"
                  weight={10}
                  value={kIndexBreakdown.engagementDim}
                  icon="ri-heart-3-line"
                  color="bg-rose-50 text-rose-600"
                  desc="Bonus : (commentaires écrits + réactions données + reçues) ×0.008"
                />
                <DimensionRow
                  label="Content Reach"
                  weight={3}
                  value={kIndexBreakdown.reachDim}
                  icon="ri-eye-line"
                  color="bg-violet-50 text-violet-600"
                  desc="Vues moyennes par ressource (plafonné à 1)"
                />
                <DimensionRow
                  label="Consistency & Presence"
                  weight={2}
                  value={kIndexBreakdown.consistencyDim}
                  icon="ri-time-line"
                  color="bg-amber-50 text-amber-600"
                  desc="Régularité : 8+ ressources = 0.3pts, 5+ = 0.2pts, 2+ = 0.1pts"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed font-mono">
                <p className="font-semibold text-slate-700 mb-1">Formule complète :</p>
                <p>K = H_index + (reviews_complétés × 0.1) + (reviews_en_cours × 0.03) + ((comm + réactions) × 0.008)</p>
                <p className="mt-1 text-slate-400 dark:text-slate-500">ou H_index = max (k | score_k &gt;= k) avec score = vues + DLx2 + comm.x3</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 lg:px-6 mb-6">
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="ri-bar-chart-box-line mr-1.5"></i>
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('profil')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'profil' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="ri-user-line mr-1.5"></i>
            Profil & Ressources
          </button>
        </div>
      </div>

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <section className="max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <KpiCard icon="ri-eye-line" iconColor="text-ocean-500" iconBg="bg-ocean-50" label="Vues totales" value={totalViews.toLocaleString('fr-FR')} sub="Toutes les ressources" />
            <KpiCard icon="ri-download-line" iconColor="text-emerald-500" iconBg="bg-emerald-50" label="Téléchargements" value={totalDownloads.toLocaleString('fr-FR')} sub="Fichiers téléchargés" />
            <KpiCard icon="ri-message-3-line" iconColor="text-teal-500" iconBg="bg-teal-50" label="Commentaires" value={totalComments.toLocaleString('fr-FR')} sub="Interactions reçues" />
            <KpiCard icon="ri-bar-chart-line" iconColor="text-violet-500" iconBg="bg-violet-50" label="Vues moyennes" value={avgViews.toLocaleString('fr-FR')} sub="Par ressource" />
          </div>

          {/* K-index Breakdown Card */}
          {kIndexBreakdown && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Décomposition du K-index</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Les 5 dimensions qui composent l&apos;indice d&apos;impact</p>
                </div>
                <button
                  onClick={() => setShowKIndexInfo(true)}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                >
                  <i className="ri-information-line"></i>
                  Voir la formule
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <MiniDimBar
                  label="Publishing (H-index)"
                  weight={65}
                  value={kIndexBreakdown.publishingDim}
                  max={5}
                  color="bg-ocean-500"
                />
                <MiniDimBar
                  label="Reviews"
                  weight={20}
                  value={kIndexBreakdown.reviewDim}
                  max={1.5}
                  color="bg-emerald-500"
                />
                <MiniDimBar
                  label="Engagement"
                  weight={10}
                  value={kIndexBreakdown.engagementDim}
                  max={1}
                  color="bg-rose-500"
                />
                <MiniDimBar
                  label="Reach"
                  weight={3}
                  value={kIndexBreakdown.reachDim}
                  max={1}
                  color="bg-violet-500"
                />
                <MiniDimBar
                  label="Consistency"
                  weight={2}
                  value={kIndexBreakdown.consistencyDim}
                  max={0.5}
                  color="bg-amber-500"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <i className="ri-pulse-line text-rose-500"></i>
                  K-index final
                </div>
                <div className="text-2xl font-bold text-rose-600">{kIndexBreakdown.kIndex.toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Type Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Types de ressources</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Répartition par catégorie</p>
              <div className="h-64">
                {typeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {typeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number, name: string) => [`${value} ressource${value > 1 ? 's' : ''}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <i className="ri-pie-chart-line text-3xl mb-2"></i>
                    <p className="text-sm">Aucune ressource</p>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2">
                {typeDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resource Performance */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Performance des ressources</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Vues par ressource (top 10)</p>
              <div className="h-64">
                {resourcePerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resourcePerformance} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = { views: 'Vues', downloads: 'Téléchargements', comments: 'Commentaires' };
                          return [`${value}`, labels[name] || name];
                        }}
                        labelFormatter={(label: string) => {
                          const item = resourcePerformance.find((r) => r.name === label);
                          return item?.fullName || label;
                        }}
                      />
                      <Bar dataKey="views" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="views" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <i className="ri-bar-chart-grouped-line text-3xl mb-2"></i>
                    <p className="text-sm">Aucune donnée de performance</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Peer Review Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Reviews done by this teacher */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Peer reviews effectués</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Évaluations que cet enseignant a réalisées</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {assignedReviews.length} au total
                </span>
              </div>
              {assignedReviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Aucun peer review assigné</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {assignedReviews.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        <i className={r.status === 'completed' ? 'ri-check-line' : 'ri-time-line'}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{r.resourceTitle}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {r.status === 'completed'
                            ? `Terminé le ${new Date(r.completed_at!).toLocaleDateString('fr-FR')}`
                            : `Assigné le ${new Date(r.assigned_at).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {r.status === 'completed' ? 'Terminé' : 'En cours'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Review completion stats */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Productivité d'évaluation</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Résumé de l'activité de peer review</p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <i className="ri-check-double-line text-xl"></i>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{completedReviews.length}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Reviews complétés</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <i className="ri-time-line text-xl"></i>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{pendingReviews.length}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">En attente</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <i className="ri-percent-line text-xl"></i>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {assignedReviews.length > 0 ? Math.round((completedReviews.length / assignedReviews.length) * 100) : 0}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Taux de complétion</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${assignedReviews.length > 0 ? (completedReviews.length / assignedReviews.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resources detail table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Détail par ressource</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Performance individuelle de chaque ressource</p>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Ressource</th>
                    <th className="text-left px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Type</th>
                    <th className="text-left px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Statut</th>
                    <th className="text-right px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Vues</th>
                    <th className="text-right px-3 py-3 font-medium text-slate-600 dark:text-slate-300">DL</th>
                    <th className="text-right px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Comm.</th>
                    <th className="text-right px-3 py-3 font-medium text-slate-600 dark:text-slate-300">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allResources.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                        Aucune ressource trouvée.
                      </td>
                    </tr>
                  )}
                  {allResources.map((r) => {

                    const sInfo = statusConfig[r.status] || statusConfig.not_evaluated;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-3 py-3">
                          <Link to={`/ressources/${r.id}`} className="font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600 transition-colors block truncate max-w-xs">
                            {r.title}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <ResourceTypeBadge type={r.type} label={r.type_label} className="rounded-md" iconClassName="w-3 h-3" />
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sInfo.bg} ${sInfo.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sInfo.dot}`}></span>
                            {sInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300 font-medium">{r.views || 0}</td>
                        <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">{r.downloads || 0}</td>
                        <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">{r.comments_count || 0}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                            <i className="ri-star-line text-[10px]"></i>
                            —
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tab: Profil */}
      {activeTab === 'profil' && (
        <section className="max-w-5xl mx-auto px-4 lg:px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">
            Ressources partagées ({allResources.length})
          </h2>

          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="w-10 h-10 flex items-center justify-center mx-auto mb-4">
                <i className="ri-loader-4-line animate-spin text-ocean-500 text-3xl"></i>
              </div>
              <p className="text-sm text-slate-400 dark:text-slate-500">Chargement des ressources...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {allResources.map((resource) => {

                const statusInfo = statusConfig[resource.status] || statusConfig.not_evaluated;
                const cover = coverImages[resource.type] || coverImages.course;

                return (
                  <div
                    key={resource.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-sharek-300 transition-all group"
                  >
                    {/* Cover image */}
                    <div className="relative h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={cover}
                        alt=""
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <ResourceTypeBadge type={resource.type} label={resource.type_label} className="rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-slate-700 shadow-sm px-2 py-1" iconClassName="w-3 h-3" />
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <Link to={`/ressources/${resource.id}`} className="block">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 line-clamp-2 hover:text-sharek-600 transition-colors">
                          {resource.title}
                        </h3>
                      </Link>

                      <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-3 line-clamp-2">{resource.objectives}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-building-line"></i>
                            </div>
                            {resource.school_level}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-time-line"></i>
                            </div>
                            {resource.duration}
                          </span>
                        </div>
                        <Link
                          to={`/ressources/${resource.id}`}
                          className="text-xs font-medium text-sharek-600 hover:text-sharek-700 flex items-center gap-1 transition-colors"
                        >
                          Voir
                          <i className="ri-arrow-right-line"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && allResources.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <i className="ri-folder-open-line text-xl text-slate-400 dark:text-slate-500"></i>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Cet enseignant n&apos;a pas encore partagé de ressources.</p>
            </div>
          )}
        </section>
      )}
    </>
  );

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950">
        <PublicHeader />
        <main className="pt-16 flex-1">{pageContent}</main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <MainLayout>
      {pageContent}
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`${icon} text-sm`}></i>
          </div>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function DimensionRow({ label, weight, value, icon, color, desc }: {
  label: string;
  weight: number;
  value: number;
  icon: string;
  color: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${color}`}>
        <i className={`${icon} text-sm`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">{value.toFixed(2)} pts</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-current"
              style={{ width: `${Math.min(100, weight * 2.5)}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{weight}%</span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function MiniDimBar({ label, weight, value, max, color }: {
  label: string;
  weight: number;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-400 dark:text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">{weight}%</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{value.toFixed(2)}</span>
    </div>
  );
}
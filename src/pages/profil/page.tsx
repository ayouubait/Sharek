import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useToast } from '@/lib/toast';
import { computeKIndex, aggregateResourceStats, type KIndexBreakdown } from '@/lib/kindex';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import AvatarImage from '@/components/AvatarImage';
import AdminProfileDashboard from './components/AdminProfileDashboard';
import TeacherActivityFeed from './components/TeacherActivityFeed';
import {
  ProfileData,
  AdminStats,
  roleConfig,
  statusConfig,
  formatDate,
  resolveName,
} from './components/types';
import type { Resource, PeerReview } from '@/mocks/data';

export default function Profil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [myResources, setMyResources] = useState<Resource[]>([]);
  const [myReviews, setMyReviews] = useState<PeerReview[]>([]);
  const [, setSentCommentsCount] = useState(0);
  const [, setReceivedCommentsCount] = useState(0);
  const [kIndexBreakdown, setKIndexBreakdown] = useState<KIndexBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'resources' | 'reviews' | 'activity'>('resources');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Admin stats - robust role check (trim + lowercase)
  const normalizedRole = (profile?.role || '').toString().trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: 0,
    bannedUsers: 0,
    totalResources: 0,
    pendingReviews: 0,
    totalComments: 0,
    featuredResources: 0,
  });

  const fetchAdminStats = useCallback(async () => {
    if (!user) return;
    const safeCount = async (q: PromiseLike<{ count: number | null }>) => {
      try {
        const { count } = await withTimeout(q as Promise<{ count: number | null }>, 8000);
        return count ?? 0;
      } catch {
        return 0;
      }
    };

    const [totalUsers, bannedUsers, totalResources, pendingReviews, totalComments, featuredResources] = await Promise.all([
      safeCount(supabase.from('profiles').select('id', { count: 'exact', head: true })),
      safeCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true)),
      safeCount(supabase.from('resources').select('id', { count: 'exact', head: true })),
      safeCount(supabase.from('peer_reviews').select('id', { count: 'exact', head: true }).in('status', ['reading', 'accepted'])),
      safeCount(supabase.from('comments').select('id', { count: 'exact', head: true })),
      safeCount(supabase.from('resources').select('id', { count: 'exact', head: true }).eq('status', 'peer_reviewed')),
    ]);

    setAdminStats({ totalUsers, bannedUsers, totalResources, pendingReviews, totalComments, featuredResources });
  }, [user]);

  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data: profileData, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        10000
      );

      const resolvedName = resolveName(
        profileData?.name,
        undefined,
        user.name,
        user.email
      );

      const rawAvatar = profileData?.avatar_url || null;
      const rawCover = profileData?.cover_url || null;
      // Ignore huge data URLs that were stored as fallback - they are unreliable
      const avatar_url = rawAvatar && rawAvatar.startsWith('data:') ? null : rawAvatar;
      const cover_url = rawCover && rawCover.startsWith('data:') ? null : rawCover;

      let baseProfile: ProfileData;

      if (!profileError && profileData) {
        baseProfile = {
          id: user.id,
          name: resolvedName,
          email: profileData.email || user.email || '',
          initials: profileData.initials || resolvedName.slice(0, 2).toUpperCase(),
          avatar_url,
          cover_url,
          institution: profileData.institution || '',
          city: profileData.city || '',
          specialty: profileData.specialty || 'Sciences de la Vie et de la Terre',
          level: profileData.level || '',
          bio: profileData.bio || '',
          role: profileData.role || 'teacher',
          color: profileData.color || '#0d9488',
          resources_count: 0,
          reviews_count: 0,
          contribution_score: profileData.contribution_score || 0,
          k_index: profileData.k_index || 0,
          joined_at: profileData.created_at || new Date().toISOString(),
        };
      } else {
        baseProfile = {
          id: user.id,
          name: resolvedName,
          email: user.email || '',
          initials: resolvedName.slice(0, 2).toUpperCase(),
          avatar_url: rawAvatar,
          cover_url: rawCover,
          institution: '',
          city: '',
          specialty: 'Sciences de la Vie et de la Terre',
          level: '',
          bio: '',
          role: 'teacher',
          color: '#0d9488',
          resources_count: 0,
          reviews_count: 0,
          contribution_score: 0,
          k_index: 0,
          joined_at: new Date().toISOString(),
        };
      }

      // If admin, fetch admin stats and skip teacher data
      if (baseProfile.role === 'admin') {
        await fetchAdminStats();
        setProfile(baseProfile);
        setLoading(false);
        return;
      }

      // Resources (teacher only)
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      let allResources: Resource[] = [];
      if (!resourcesError && resourcesData) {
        allResources = resourcesData.map((r) => ({
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
      }
      setMyResources(allResources);

      // Reviews (teacher only)
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('reviewer_id', user.id)
        .order('joined_at', { ascending: false });

      let allReviews: PeerReview[] = [];
      if (!reviewsError && reviewsData) {
        allReviews = reviewsData.map((r) => ({
          id: r.id,
          resource_id: r.resource_id,
          reviewer_id: r.reviewer_id,
          status: r.status,
          status_label: r.status_label,
          joined_at: r.joined_at,
          recommendation_submitted: r.recommendation_submitted,
        }));
      }
      setMyReviews(allReviews);

      // Comments counts (teacher only)
      let sentC = 0;
      let receivedC = 0;
      const { data: sentComments, error: sentErr } = await supabase
        .from('comments')
        .select('id')
        .eq('author_id', user.id);
      if (!sentErr && sentComments) sentC = sentComments.length;

      const resourceIds = allResources.map((r) => r.id);
      if (resourceIds.length > 0) {
        const { data: recComments, error: recErr } = await supabase
          .from('comments')
          .select('id')
          .in('resource_id', resourceIds);
        if (!recErr && recComments) receivedC = recComments.length;
      }
      setSentCommentsCount(sentC);
      setReceivedCommentsCount(receivedC);

      // Reactions données et reçues (pour le bonus engagement du K-index).
      let reactionsGiven = 0;
      let reactionsReceived = 0;
      try {
        const { count: rg } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        reactionsGiven = rg || 0;
      } catch {
        // best-effort, le K-index s'en passe
      }
      if (resourceIds.length > 0) {
        try {
          const { data: ownComments } = await supabase
            .from('comments')
            .select('id')
            .in('resource_id', resourceIds);
          const ownCommentIds = (ownComments || []).map((c) => c.id);
          if (ownCommentIds.length > 0) {
            const { count: rr } = await supabase
              .from('comment_likes')
              .select('*', { count: 'exact', head: true })
              .in('comment_id', ownCommentIds);
            reactionsReceived = rr || 0;
          }
        } catch {
          // best-effort
        }
      }

      // === K-INDEX : formule H-index inspirée des chercheurs (5 dimensions) ===
      const completedReviews = allReviews.filter((r) => r.recommendation_submitted).length;
      const pendingReviews = allReviews.filter((r) => !r.recommendation_submitted).length;
      const { avgViews } = aggregateResourceStats(allResources);

      const breakdown = computeKIndex({
        allResources,
        completedReviews,
        pendingReviews,
        commentsWritten: sentC,
        reactionsGiven,
        reactionsReceived,
        avgViews,
      });

      baseProfile.resources_count = allResources.length;
      baseProfile.reviews_count = allReviews.length;
      baseProfile.k_index = breakdown.kIndex;
      setKIndexBreakdown(breakdown);

      // Persist k_index to Supabase if changed (entier pour la colonne int).
      const kIndexRounded = Math.round(breakdown.kIndex);
      if (profileData && kIndexRounded !== (profileData.k_index || 0)) {
        await supabase.from('profiles').update({ k_index: kIndexRounded }).eq('id', user.id);
      }

      setProfile(baseProfile);
    } catch (err) {
      logger.error('Profile fetch error:', err);
      setMyResources([]);
      setMyReviews([]);
    } finally {
      setLoading(false);
    }
  }, [user, fetchAdminStats]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde. Maximum 5 Mo.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const timestamp = Date.now();
      const filePath = `${user.id}/avatar_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('bucket')) {
          throw new Error('Le stockage de photos de profil est indisponible. Contacte un admin.');
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: publicUrl }, { onConflict: 'id' });
      if (dbError) throw dbError;

      // Verify persistence by re-fetching from DB
      const { data: verifyData, error: verifyErr } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (verifyErr || !verifyData?.avatar_url) {
        throw new Error("L'URL de l'avatar n'a pas été persistée en base.");
      }

      setProfile({ ...profile, avatar_url: verifyData.avatar_url });
      toast.success('Photo de profil mise à jour avec succès !');
    } catch (err: any) {
      logger.error('Avatar upload error:', err);
      toast.error(err?.message || "Erreur lors de l'upload de l'avatar.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAvatarError = () => {
    setProfile((prev) => (prev ? { ...prev, avatar_url: null } : prev));
  };

  const roleInfo = roleConfig[profile?.role || 'teacher'];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 flex items-center justify-center text-slate-400 dark:text-slate-500 mr-2">
            <i className="ri-loader-4-line animate-spin"></i>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du profil...</p>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-user-line text-2xl"></i>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200">Profil non disponible</h2>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2">Connectez-vous pour voir votre profil.</p>
        </div>
      </MainLayout>
    );
  }

  const avatarImage = profile.avatar_url;

  return (
    <MainLayout>
      {/* ===== ADMIN: delegate to pure dashboard ===== */}
      {isAdmin ? (
        <AdminProfileDashboard profile={profile} />
      ) : (
        <>
          {/* Profile Header - clean, no cover */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
              {/* Avatar - centered on mobile, left on desktop */}
              <div className="relative group mx-auto sm:mx-0 flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-md overflow-hidden bg-white">
                  <AvatarImage
                    src={avatarImage}
                    initials={profile.initials}
                    color={profile.color}
                    alt={profile.name}
                    className="w-full h-full"
                    onImageError={handleAvatarError}
                  />
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Modifier la photo de profil"
                  className="absolute bottom-1 right-1 w-8 h-8 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-full shadow-md flex items-center justify-center text-slate-600 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-600"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-camera-line text-xs"></i>
                  </div>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* Identity column */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                {/* Name + status badge */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
                    {profile.name}
                  </h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mx-auto sm:mx-0 ${roleInfo?.bg} ${roleInfo?.color} w-fit`}>
                    {roleInfo?.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 break-words">
                  {profile.specialty}
                  {profile.institution ? ` · ${profile.institution}` : ''}
                  {profile.city ? ` · ${profile.city}` : ''}
                </p>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-3 max-w-3xl">
                    {profile.bio}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1 max-w-full truncate">
                    <i className="ri-mail-line text-[11px]"></i>
                    <span className="truncate">{profile.email}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line text-[11px]"></i>
                    Membre depuis {formatDate(profile.joined_at)}
                  </span>
                  {profile.level && (
                    <span className="flex items-center gap-1">
                      <i className="ri-graduation-cap-line text-[11px]"></i>
                      {profile.level}
                    </span>
                  )}
                </div>

                {/* Action buttons - full row on mobile, inline right on desktop */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Link
                    to="/messages"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-ocean-600 bg-white dark:bg-slate-700 border border-ocean-200 dark:border-slate-600 rounded-lg hover:bg-ocean-50 dark:hover:bg-slate-600 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <i className="ri-mail-send-line"></i>
                    Messages
                  </Link>
                  <button
                    onClick={() => navigate('/parametres')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <i className="ri-edit-line text-[11px]"></i>
                    Modifier le profil
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ========== TEACHER PROFILE ========== */}
          {/* K-INDEX hero card - formule H-index pondérée */}
          <div className="bg-gradient-to-br from-sharek-600 to-ocean-600 dark:from-sharek-700 dark:to-ocean-700 rounded-xl p-5 sm:p-6 mb-6 shadow-card text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <i className="ri-award-line text-3xl"></i>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">K-Index</p>
                  <p className="text-3xl sm:text-4xl font-bold leading-none mt-1">
                    {kIndexBreakdown ? kIndexBreakdown.kIndex.toFixed(1) : '0.0'}
                  </p>
                  <p className="text-xs text-white/80 mt-1.5">
                    Indice d'impact basé sur 5 dimensions pondérées
                  </p>
                </div>
              </div>
              {kIndexBreakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 sm:text-right text-[11px] min-w-[160px]">
                  <div className="flex sm:justify-end items-center gap-1.5 text-white/90">
                    <i className="ri-file-text-line"></i>
                    <span>Publishing : {kIndexBreakdown.publishingDim.toFixed(2)}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-1.5 text-white/90">
                    <i className="ri-team-line"></i>
                    <span>Reviews : {kIndexBreakdown.reviewDim.toFixed(2)}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-1.5 text-white/90">
                    <i className="ri-chat-3-line"></i>
                    <span>Engagement : {kIndexBreakdown.engagementDim.toFixed(2)}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-1.5 text-white/90">
                    <i className="ri-broadcast-line"></i>
                    <span>Reach : {kIndexBreakdown.reachDim.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats row - clean and simple */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-9 h-9 rounded-lg bg-sharek-50 flex items-center justify-center text-sharek-600">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-file-text-line text-sm"></i>
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{profile.resources_count}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Ressources</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-9 h-9 rounded-lg bg-ocean-50 flex items-center justify-center text-ocean-600">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-team-line text-sm"></i>
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{profile.reviews_count}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Reviews</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-download-line text-sm"></i>
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {myResources.reduce((s, r) => s + r.downloads, 0)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Téléchargements</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-eye-line text-sm"></i>
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {myResources.reduce((s, r) => s + r.views, 0)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Vues totales</div>
            </div>
          </div>

          {/* Décomposition du K-index - 5 dimensions pondérées */}
          {kIndexBreakdown && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft mb-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Décomposition du K-index
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Les 5 dimensions qui composent l'indice d'impact
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                {[
                  { label: 'Publication', value: kIndexBreakdown.publishingDim, weight: 65, color: '#0d9488', icon: 'ri-file-text-line', desc: 'Score des ressources (vues + DL×2 + comm.×3)' },
                  { label: 'Reviews', value: kIndexBreakdown.reviewDim, weight: 20, color: '#2563eb', icon: 'ri-team-line', desc: 'Peer reviews complétées + en cours' },
                  { label: 'Engagement', value: kIndexBreakdown.engagementDim, weight: 10, color: '#7c3aed', icon: 'ri-chat-3-line', desc: 'Commentaires + likes donnés / reçus' },
                  { label: 'Reach', value: kIndexBreakdown.reachDim, weight: 3, color: '#f59e0b', icon: 'ri-broadcast-line', desc: 'Vues moyennes par ressource' },
                  { label: 'Consistency', value: kIndexBreakdown.consistencyDim, weight: 2, color: '#e11d48', icon: 'ri-calendar-check-line', desc: 'Régularité de publication' },
                ].map((dim) => (
                  <div
                    key={dim.label}
                    className="rounded-lg border border-slate-100 dark:border-slate-700/50 p-3"
                    title={dim.desc}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        <i className={`${dim.icon} text-xs`} style={{ color: dim.color }} />
                        <span>{dim.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{dim.weight}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, dim.value * 100)}%`,
                          backgroundColor: dim.color,
                        }}
                      />
                    </div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {dim.value.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  K-index final
                </span>
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {kIndexBreakdown.kIndex.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Section tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto">
              {[
                { key: 'resources', label: 'Mes ressources', icon: 'ri-folder-open-line', count: myResources.length },
                { key: 'reviews', label: 'Mes reviews', icon: 'ri-team-line', count: myReviews.length },
                { key: 'activity', label: 'Activité récente', icon: 'ri-time-line', count: 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key as typeof activeSection)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeSection === tab.key
                      ? 'bg-sharek-50 text-sharek-700 dark:bg-sharek-900/30 dark:text-sharek-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={tab.icon}></i>
                  </div>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeSection === 'resources' && (
                <div>
                  {myResources.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center">
                        <div className="w-6 h-6 flex items-center justify-center text-slate-400 dark:text-slate-500">
                          <i className="ri-folder-open-line text-xl"></i>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Aucune ressource publiée</p>
                      <button
                        onClick={() => navigate('/ressources/ajouter')}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors"
                      >
                        <i className="ri-add-line"></i>
                        Publier une ressource
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {myResources.map((resource) => {
                        const sCfg = statusConfig[resource.status] || statusConfig.not_evaluated;
                        return (
                          <div
                            key={resource.id}
                            className="py-4 flex items-start gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors -mx-5 px-5"
                            onClick={() => navigate(`/ressources/${resource.id}`)}
                          >
                            <div className="w-10 h-10 rounded-lg bg-sharek-50 flex items-center justify-center text-sharek-600 flex-shrink-0">
                              <div className="w-5 h-5 flex items-center justify-center">
                                <i className="ri-file-text-line"></i>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                {resource.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <ResourceTypeBadge type={resource.type} label={resource.type_label || undefined} className="rounded-md" />
                                <span className="text-slate-300">·</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{resource.school_level}</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{formatDate(resource.created_at)}</span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.text} flex-shrink-0`}>
                              {sCfg.label}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-eye-line text-[10px]"></i>
                                </div>
                                {resource.views}
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-message-3-line text-[10px]"></i>
                                </div>
                                {resource.comments_count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'reviews' && (
                <div>
                  {myReviews.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center">
                        <div className="w-6 h-6 flex items-center justify-center text-slate-400 dark:text-slate-500">
                          <i className="ri-team-line text-xl"></i>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Aucune review en cours</p>
                      <Link
                        to="/ressources"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-sharek-600 hover:text-sharek-700 font-medium"
                      >
                        Parcourir les ressources à reviewer
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-arrow-right-line text-xs"></i>
                        </div>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {myReviews.map((review) => {
                        const resource = myResources.find((r) => r.id === review.resource_id);
                        return (
                          <div
                            key={review.id}
                            className="py-4 flex items-start gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors -mx-5 px-5"
                            onClick={() => navigate(`/ressources/${review.resource_id}`)}
                          >
                            <div className="w-10 h-10 rounded-lg bg-ocean-50 flex items-center justify-center text-ocean-600 flex-shrink-0">
                              <div className="w-5 h-5 flex items-center justify-center">
                                <i className="ri-book-open-line"></i>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                {resource?.title || `Ressource #${review.resource_id.slice(0, 8)}`}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    review.status === 'reading'
                                      ? 'bg-blue-50 text-blue-700'
                                      : review.status === 'accepted'
                                      ? 'bg-sharek-50 text-sharek-700 dark:bg-sharek-900/30 dark:text-sharek-300'
                                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <div className="w-3 h-3 flex items-center justify-center">
                                    <i
                                      className={
                                        review.status === 'reading'
                                          ? 'ri-book-open-line text-[10px]'
                                          : 'ri-check-line text-[10px]'
                                      }
                                    ></i>
                                  </div>
                                  {review.status_label}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  Depuis {formatDate(review.joined_at)}
                                </span>
                              </div>
                            </div>
                            {review.recommendation_submitted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 flex-shrink-0">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-file-list-3-line text-[10px]"></i>
                                </div>
                                Recommandation envoyée
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'activity' && (
                <TeacherActivityFeed
                  userId={user.id}
                  resources={myResources}
                  reviews={myReviews}
                />
              )}
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
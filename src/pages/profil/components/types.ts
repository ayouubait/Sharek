export interface ProfileData {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatar_url: string | null;
  cover_url: string | null;
  institution: string;
  city: string;
  specialty: string;
  level: string;
  bio: string;
  role: string;
  color: string;
  resources_count: number;
  reviews_count: number;
  contribution_score: number;
  k_index: number;
  joined_at: string;
}

export interface AdminStats {
  totalUsers: number;
  bannedUsers: number;
  totalResources: number;
  pendingReviews: number;
  totalComments: number;
  featuredResources: number;
}

export const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Administrateur', color: 'text-violet-700', bg: 'bg-violet-50' },
  reviewer: { label: 'Reviewer', color: 'text-ocean-700', bg: 'bg-ocean-50' },
  teacher: { label: 'Enseignant', color: 'text-sharek-700', bg: 'bg-sharek-50' },
};

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  peer_reviewed: { label: 'Peer reviewed', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  not_evaluated: { label: 'Non évalué', bg: 'bg-slate-100', text: 'text-slate-600' },
  under_review: { label: 'En cours', bg: 'bg-amber-50', text: 'text-amber-700' },
  pending_reviewers: { label: 'En attente', bg: 'bg-sky-50', text: 'text-sky-700' },
  needs_revision: { label: 'À réviser', bg: 'bg-rose-50', text: 'text-rose-700' },
};

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function resolveName(
  profileName: string | null | undefined,
  mockName: string | null | undefined,
  authName: string | null | undefined,
  email: string | null | undefined
): string {
  const candidates = [profileName, mockName, authName, email?.split('@')[0]];
  for (const c of candidates) {
    if (c && c.trim().length > 0 && c.trim().toLowerCase() !== 'utilisateur') return c.trim();
  }
  return 'Utilisateur';
}


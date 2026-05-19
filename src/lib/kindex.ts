import type { Resource } from '@/mocks/data';

export interface KIndexBreakdown {
  publishingDim: number;
  reviewDim: number;
  engagementDim: number;
  reachDim: number;
  consistencyDim: number;
  weightedScore: number;
  kIndex: number;
}

export interface KIndexInput {
  allResources: Resource[];
  totalViews?: number;
  totalDownloads?: number;
  totalComments?: number;
  avgViews?: number;
  peerReviewCount?: number;
  completedReviews?: number;
  pendingReviews?: number;
  assignedReviews?: number;
  commentsWritten?: number;
  reactionsGiven?: number;
  reactionsReceived?: number;
}

/**
 * Calcule le K-index inspiré du H-index académique.
 *
 * Logique :
 *  - Pour chaque ressource, un score d'impact = vues + (DL × 2) + (comm. × 3).
 *  - On trie ces scores décroissants, le H-index est le plus grand k tel que
 *    la k-ème ressource a un score ≥ k.
 *  - Bonus pour les activités hors ressources : peer reviews + engagement.
 *  - K-index final = H-index + bonus, arrondi à 1 décimale.
 *
 * Retourne aussi les 5 dimensions séparées pour l'affichage du breakdown :
 *  - Publishing (H-index)  : 65 %
 *  - Reviews               : 20 %
 *  - Engagement            : 10 %
 *  - Reach (audience)      : 3 %
 *  - Consistency           : 2 %
 */
export function computeKIndex({
  allResources,
  completedReviews = 0,
  pendingReviews = 0,
  commentsWritten = 0,
  reactionsGiven = 0,
  reactionsReceived = 0,
  avgViews = 0,
}: KIndexInput): KIndexBreakdown {
  const resourceScores = allResources
    .map((r) => (r.views || 0) + (r.downloads || 0) * 2 + (r.comments_count || 0) * 3)
    .sort((a, b) => b - a);

  let hIndex = 0;
  for (let i = 0; i < resourceScores.length; i++) {
    if (resourceScores[i] >= i + 1) {
      hIndex = i + 1;
    } else {
      break;
    }
  }

  const reviewBonus = completedReviews * 0.1 + pendingReviews * 0.03;
  const communityBonus = (commentsWritten + reactionsGiven + reactionsReceived) * 0.008;

  const rawK = hIndex + reviewBonus + communityBonus;
  const kIndex = Math.max(0, Math.round(rawK * 10) / 10);

  const publishingDim = hIndex;
  const reviewDim = Math.round(reviewBonus * 100) / 100;
  const engagementDim = Math.round(communityBonus * 100) / 100;
  const reachDim =
    avgViews > 0 ? Math.min(1, Math.round(avgViews * 0.003 * 100) / 100) : 0;
  const consistencyDim =
    allResources.length >= 8
      ? 0.3
      : allResources.length >= 5
        ? 0.2
        : allResources.length >= 2
          ? 0.1
          : Math.round(allResources.length * 0.05 * 100) / 100;

  const weightedScore = Math.round(rawK * 100) / 100;

  return {
    publishingDim: Math.round(publishingDim * 100) / 100,
    reviewDim,
    engagementDim,
    reachDim,
    consistencyDim,
    weightedScore,
    kIndex,
  };
}

/**
 * Helper qui calcule les agrégats à partir d'une liste de ressources.
 */
export function aggregateResourceStats(resources: Resource[]) {
  const totalViews = resources.reduce((s, r) => s + (r.views || 0), 0);
  const totalDownloads = resources.reduce((s, r) => s + (r.downloads || 0), 0);
  const totalComments = resources.reduce((s, r) => s + (r.comments_count || 0), 0);
  const avgViews = resources.length > 0 ? totalViews / resources.length : 0;
  return { totalViews, totalDownloads, totalComments, avgViews };
}

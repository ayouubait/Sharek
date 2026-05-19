import type { Resource } from '@/mocks/data';

interface StatusBadgeProps {
  resource: Resource;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ resource, size = 'md' }: StatusBadgeProps) {
  const configs: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
    not_evaluated: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      icon: 'ri-time-line',
      label: 'Non évalué',
    },
    pending_reviewers: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: 'ri-user-search-line',
      label: 'En attente de reviewers',
    },
    under_review: {
      bg: 'bg-ocean-50',
      text: 'text-ocean-700',
      border: 'border-ocean-200',
      icon: 'ri-loader-4-line',
      label: 'En cours de peer reviewing',
    },
    needs_revision: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      icon: 'ri-refresh-line',
      label: 'À réviser',
    },
    peer_reviewed: {
      bg: 'bg-sharek-50',
      text: 'text-sharek-700',
      border: 'border-sharek-200',
      icon: 'ri-shield-check-line',
      label: 'Peer reviewed',
    },
  };

  const config = configs[resource.status] || configs.not_evaluated;

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3.5 py-1.5 text-sm gap-1.5',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
    >
      <div className={`w-4 h-4 flex items-center justify-center ${iconSizes[size]}`}>
        <i className={config.icon}></i>
      </div>
      <span>{config.label}</span>
    </div>
  );
}
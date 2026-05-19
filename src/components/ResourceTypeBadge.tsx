import { getTypeConfig } from '@/lib/typeConfig';

interface ResourceTypeBadgeProps {
  type: string;
  label?: string;
  bordered?: boolean;
  className?: string;
  iconClassName?: string;
}

export default function ResourceTypeBadge({
  type,
  label,
  bordered,
  className,
  iconClassName,
}: ResourceTypeBadgeProps) {
  const config = getTypeConfig(type, label);

  const baseClasses = [
    'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium',
    config.bg,
    config.text,
    bordered ? `border ${config.border}` : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={baseClasses}>
      <span className={`inline-flex items-center justify-center ${iconClassName || 'w-3 h-3'}`}>
        <i className={`${config.icon} ${iconClassName ? '' : 'text-[10px]'}`} />
      </span>
      {config.label}
    </span>
  );
}
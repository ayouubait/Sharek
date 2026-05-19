export interface TypeConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: string;
}

const TYPE_CONFIG_MAP: Record<string, TypeConfig> = {
  course: {
    label: 'Cours',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'ri-book-open-line',
  },
  worksheet: {
    label: 'Fiche de travail',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'ri-file-list-3-line',
  },
  evaluation: {
    label: 'Évaluation',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'ri-clipboard-line',
  },
  practical: {
    label: 'Activité pratique',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: 'ri-flask-line',
  },
  simulation: {
    label: 'Simulation',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    icon: 'ri-computer-line',
  },
  slides: {
    label: 'Diaporama',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    icon: 'ri-slideshow-line',
  },
};

export function getTypeConfig(typeSlug: string, typeName?: string): TypeConfig {
  const config = TYPE_CONFIG_MAP[typeSlug];
  if (config) return config;
  // Fallback for unknown types
  return {
    label: typeName || typeSlug,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: 'ri-folder-line',
  };
}

export function getTypeConfigsMap(): Record<string, TypeConfig> {
  return { ...TYPE_CONFIG_MAP };
}
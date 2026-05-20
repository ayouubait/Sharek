import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
}

interface PlatformSettingsProps {
  settings: PlatformSetting[];
  onChange: () => void;
}

const settingGroups = [
  {
    label: 'Général',
    keys: ['platform_name', 'platform_tagline', 'home_hero_title', 'home_hero_subtitle', 'contact_email'],
  },
  {
    label: 'Fonctionnalités',
    keys: ['enable_signups', 'enable_peer_review', 'enable_comments', 'enable_messages', 'auto_assign_reviewers', 'maintenance_mode'],
  },
  {
    label: 'Limites',
    keys: ['max_upload_size_mb', 'max_reviewers_per_resource', 'min_reviewers_required', 'resources_per_page', 'comments_per_page', 'analytics_retention_days'],
  },
  {
    label: 'Affichage',
    keys: ['default_language'],
  },
];

const keyLabels: Record<string, string> = {
  platform_name: 'Nom de la plateforme',
  platform_tagline: 'Slogan',
  home_hero_title: 'Titre bannière accueil',
  home_hero_subtitle: 'Sous-titre bannière accueil',
  contact_email: 'Email de contact',
  max_upload_size_mb: 'Taille max upload (Mo)',
  max_reviewers_per_resource: 'Reviewers max par ressource',
  min_reviewers_required: 'Reviewers min requis',
  resources_per_page: 'Ressources par page',
  comments_per_page: 'Commentaires par page',
  analytics_retention_days: 'Rétention analytics (jours)',
  default_language: 'Langue par défaut',
  enable_signups: 'Autoriser les inscriptions',
  enable_peer_review: 'Activer le peer review',
  enable_comments: 'Activer les commentaires',
  enable_messages: 'Activer la messagerie',
  auto_assign_reviewers: 'Assignation auto des reviewers',
  maintenance_mode: 'Mode maintenance',
};

export default function PlatformSettings({ settings, onChange }: PlatformSettingsProps) {
  const { t } = useTranslation('common');
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateEdit = useCallback((key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = settings
        .filter((s) => edits[s.key] !== undefined && edits[s.key] !== s.value)
        .map((s) => ({
          id: s.id,
          value: edits[s.key],
          updated_at: new Date().toISOString(),
        }));

      if (updates.length > 0) {
        for (const u of updates) {
          await supabase.from('platform_settings').update({ value: u.value, updated_at: u.updated_at }).eq('id', u.id);
        }
      }
      setSaved(true);
      onChange();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      logger.error('Save platform settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) return;
    setSaving(true);
    try {
      const defaults: Record<string, string> = {
        platform_name: 'ShareK',
        platform_tagline: 'Plateforme collaborative pour enseignants SVT',
        home_hero_title: 'Partagez vos ressources SVT',
        home_hero_subtitle: 'Collaborez, évaluez et enrichissez ensemble les ressources pédagogiques pour les sciences de la vie et de la terre.',
        contact_email: 'contact@sharek.ma',
        max_upload_size_mb: '50',
        max_reviewers_per_resource: '3',
        min_reviewers_required: '2',
        enable_signups: 'true',
        enable_peer_review: 'true',
        enable_comments: 'true',
        enable_messages: 'true',
        auto_assign_reviewers: 'false',
        maintenance_mode: 'false',
        default_language: 'fr',
        resources_per_page: '12',
        comments_per_page: '20',
        analytics_retention_days: '90',
      };
      for (const [key, value] of Object.entries(defaults)) {
        const setting = settings.find((s) => s.key === key);
        if (setting) {
          await supabase.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', setting.id);
        }
      }
      setEdits(defaults);
      setSaved(true);
      onChange();
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getSetting = (key: string) => settings.find((s) => s.key === key);

  const renderInput = (s: PlatformSetting) => {
    const val = edits[s.key] ?? s.value;
    if (s.type === 'boolean') {
      const isOn = val === 'true';
      return (
        <button
          onClick={() => updateEdit(s.key, isOn ? 'false' : 'true')}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-violet-400 ${isOn ? 'bg-violet-600' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`}
          ></span>
        </button>
      );
    }
    if (s.type === 'number') {
      return (
        <input
          type="number"
          value={val}
          onChange={(e) => updateEdit(s.key, e.target.value)}
          className="w-full sm:w-32 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      );
    }
    if (s.key === 'default_language') {
      return (
        <select
          value={val}
          onChange={(e) => updateEdit(s.key, e.target.value)}
          className="w-full sm:w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      );
    }
    return (
      <input
        type="text"
        value={val}
        onChange={(e) => updateEdit(s.key, e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
      />
    );
  };

  return (
    <div className="space-y-6">
      {settingGroups.map((group) => {
        const groupSettings = group.keys.map((k) => getSetting(k)).filter(Boolean) as PlatformSetting[];
        if (groupSettings.length === 0) return null;
        return (
          <div key={group.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {groupSettings.map((s) => (
                <div key={s.key} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {keyLabels[s.key] || s.key}
                    </p>
                    {s.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                    )}
                  </div>
                  <div className="sm:w-auto w-full">
                    {renderInput(s)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Save bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <i className="ri-check-line"></i>
              {t('admin_settings_saved')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            {t('admin_settings_reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap disabled:opacity-50 flex-1 sm:flex-none text-center"
          >
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin"></i>
                {t('admin_settings_saving')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <i className="ri-save-line"></i>
                {t('admin_settings_save')}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
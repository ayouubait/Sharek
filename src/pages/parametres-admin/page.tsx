import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';
import CategoriesManager from './components/CategoriesManager';
import PlatformSettings from './components/PlatformSettings';

interface Category {
  id: string;
  name: string;
  slug: string;
  type: 'level' | 'type' | 'unit' | 'specialty';
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
}

const tabs = [
  { key: 'categories' as const, label: 'Catégories', icon: 'ri-folder-settings-line' },
  { key: 'platform' as const, label: 'Paramètres globaux', icon: 'ri-settings-3-line' },
];

export default function ParametresAdminPage() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('categories').select('*').order('type').order('sort_order'),
        8000
      );
      if (!error && data) {
        setCategories(data as Category[]);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  }, []);

  const fetchPlatformSettings = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('platform_settings').select('*').order('key'),
        8000
      );
      if (!error && data) {
        setPlatformSettings(data as PlatformSetting[]);
      }
    } catch (err) {
      console.error('Fetch platform settings error:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchPlatformSettings()]);
    setLoading(false);
  }, [fetchCategories, fetchPlatformSettings]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 flex items-center justify-center text-slate-400 mr-2">
            <i className="ri-loader-4-line animate-spin"></i>
          </div>
          <p className="text-sm text-slate-400">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramètres de la plateforme</h1>
            <p className="text-slate-500 text-sm mt-1">Gérez les catégories de ressources et les paramètres globaux de ShareK</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={tab.icon}></i>
              </div>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="mb-6">
        {activeTab === 'categories' && (
          <p className="text-sm text-slate-500">Organisez les niveaux scolaires, types de ressources, unités pédagogiques et spécialités disponibles sur la plateforme.</p>
        )}
        {activeTab === 'platform' && (
          <p className="text-sm text-slate-500">Configurez le nom de la plateforme, les limites d&apos;upload, les fonctionnalités activées et les textes publics.</p>
        )}
      </div>

      {/* Content */}
      {activeTab === 'categories' && (
        <CategoriesManager
          categories={categories}
          onChange={fetchCategories}
          saving={saving}
        />
      )}
      {activeTab === 'platform' && (
        <PlatformSettings
          settings={platformSettings}
          onChange={fetchPlatformSettings}
        />
      )}
    </MainLayout>
  );
}
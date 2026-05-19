import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface Category {
  id: string;
  name: string;
  slug: string;
  type: 'level' | 'type' | 'unit' | 'specialty';
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

interface CategoriesManagerProps {
  categories: Category[];
  onChange: () => void;
  saving: boolean;
}

const categoryTypes: { key: Category['type']; icon: string }[] = [
  { key: 'level', icon: 'ri-graduation-cap-line' },
  { key: 'type', icon: 'ri-file-list-3-line' },
  { key: 'unit', icon: 'ri-book-open-line' },
  { key: 'specialty', icon: 'ri-flask-line' },
];

export default function CategoriesManager({ categories, onChange, saving }: CategoriesManagerProps) {
  const { t } = useTranslation('common');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Category>>();
  const [showAddFor, setShowAddFor] = useState<Category['type'] | null>(null);
  const [addForm, setAddForm] = useState<Partial<Category>>({ name: '', slug: '', sort_order: 0, is_active: true });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [localSaving, setLocalSaving] = useState(false);

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditForm({ ...cat });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.name || !editForm.slug) return;
    setLocalSaving(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editForm.name,
          slug: editForm.slug,
          sort_order: editForm.sort_order ?? 0,
          is_active: editForm.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (!error) {
        setEditingId(null);
        onChange();
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const toggleActive = async (cat: Category) => {
    setLocalSaving(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !cat.is_active, updated_at: new Date().toISOString() })
        .eq('id', cat.id);
      if (!error) onChange();
    } finally {
      setLocalSaving(false);
    }
  };

  const confirmDelete = async (id: string) => {
    setLocalSaving(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (!error) {
        setDeleteConfirmId(null);
        onChange();
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const saveAdd = async (type: Category['type']) => {
    if (!addForm.name || !addForm.slug) return;
    setLocalSaving(true);
    try {
      const { error } = await supabase.from('categories').insert({
        name: addForm.name,
        slug: addForm.slug,
        type,
        sort_order: addForm.sort_order ?? 0,
        is_active: addForm.is_active ?? true,
      });
      if (!error) {
        setShowAddFor(null);
        setAddForm({ name: '', slug: '', sort_order: 0, is_active: true });
        onChange();
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const moveOrder = async (cat: Category, direction: 'up' | 'down') => {
    const typeCats = categories.filter((c) => c.type === cat.type).sort((a, b) => a.sort_order - b.sort_order);
    const idx = typeCats.findIndex((c) => c.id === cat.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= typeCats.length) return;
    const swapCat = typeCats[swapIdx];
    setLocalSaving(true);
    try {
      await Promise.all([
        supabase.from('categories').update({ sort_order: swapCat.sort_order }).eq('id', cat.id),
        supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', swapCat.id),
      ]);
      onChange();
    } finally {
      setLocalSaving(false);
    }
  };

  const getTypeLabel = (type: Category['type']) => {
    const map: Record<Category['type'], string> = {
      level: 'Niveaux scolaires',
      type: 'Types de ressources',
      unit: 'Unités pédagogiques',
      specialty: 'Spécialités',
    };
    return map[type];
  };

  return (
    <div className="space-y-6">
      {categoryTypes.map((typeInfo) => {
        const typeCats = categories
          .filter((c) => c.type === typeInfo.key)
          .sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div key={typeInfo.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header carte */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                  <i className={typeInfo.icon}></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{getTypeLabel(typeInfo.key)}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {typeCats.length} catégorie{typeCats.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddFor(typeInfo.key)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-violet-700 bg-violet-50 rounded-xl hover:bg-violet-100 transition-colors whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Catégorie
              </button>
            </div>

            {/* Formulaire d'ajout */}
            {showAddFor === typeInfo.key && (
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-1">
                    <input
                      type="text"
                      value={addForm.name || ''}
                      onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      placeholder="Nom (ex: Collège)"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addForm.slug || ''}
                      onChange={(e) => setAddForm((p) => ({ ...p, slug: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-mono"
                      placeholder="Identifiant (college)"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={addForm.sort_order ?? 0}
                      onChange={(e) => setAddForm((p) => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      placeholder="Ordre"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveAdd(typeInfo.key)}
                      disabled={localSaving || !addForm.name || !addForm.slug}
                      className="px-4 py-2.5 text-xs font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors disabled:bg-slate-300 whitespace-nowrap"
                    >
                      {localSaving ? <i className="ri-loader-4-line animate-spin"></i> : t('admin_settings_cat_save')}
                    </button>
                    <button
                      onClick={() => { setShowAddFor(null); setAddForm({ name: '', slug: '', sort_order: 0, is_active: true }); }}
                      className="px-4 py-2.5 text-xs font-medium text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors whitespace-nowrap"
                    >
                      {t('admin_settings_cat_cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Liste des catégories */}
            <div>
              {typeCats.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center text-slate-300">
                    <i className="ri-folder-open-line text-lg"></i>
                  </div>
                  {t('admin_settings_no_categories')}
                  <button
                    onClick={() => setShowAddFor(typeInfo.key)}
                    className="ml-1 text-violet-600 hover:underline"
                  >
                    {t('admin_settings_add_first_category')}
                  </button>
                </div>
              ) : (
                typeCats.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className={`px-5 py-4 flex items-center gap-4 group transition-colors ${
                      idx !== typeCats.length - 1 ? 'border-b border-slate-50' : ''
                    } hover:bg-slate-50/50`}
                  >
                    {editingId === cat.id ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div className="sm:col-span-1">
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            placeholder="Nom"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={editForm.slug || ''}
                            onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-mono"
                            placeholder="Identifiant"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={editForm.sort_order ?? 0}
                            onChange={(e) => setEditForm((p) => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            placeholder="Ordre"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={localSaving}
                            className="px-4 py-2 text-xs font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors disabled:bg-slate-300 whitespace-nowrap"
                          >
                            {localSaving ? <i className="ri-loader-4-line animate-spin"></i> : t('save')}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors whitespace-nowrap"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Gauche : handle + nom */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Handle drag + flèches ordre */}
                          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => moveOrder(cat, 'up')}
                              disabled={localSaving}
                              className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              title="Monter"
                            >
                              <i className="ri-arrow-up-s-line text-[10px]"></i>
                            </button>
                            <div className="text-slate-300">
                              <i className="ri-drag-move-line text-xs"></i>
                            </div>
                            <button
                              onClick={() => moveOrder(cat, 'down')}
                              disabled={localSaving}
                              className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              title="Descendre"
                            >
                              <i className="ri-arrow-down-s-line text-[10px]"></i>
                            </button>
                          </div>

                          {/* Nom + meta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{cat.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {cat.slug} · ordre {cat.sort_order}
                            </p>
                          </div>
                        </div>

                        {/* Droite : toggle + actions */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {/* Toggle */}
                          <button
                            onClick={() => toggleActive(cat)}
                            disabled={localSaving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-violet-400 ${cat.is_active ? 'bg-violet-600' : 'bg-slate-300'}`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${cat.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                            ></span>
                          </button>

                          {/* Actions */}
                          <div className="flex items-center gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(cat)}
                              className="text-slate-400 hover:text-violet-600 transition-colors"
                              title={t('admin_settings_cat_edit')}
                            >
                              <i className="ri-pencil-line text-sm"></i>
                            </button>
                            {deleteConfirmId === cat.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                                <span className="text-[10px] text-red-600 whitespace-nowrap">{t('confirm')}</span>
                                <button
                                  onClick={() => confirmDelete(cat.id)}
                                  disabled={localSaving}
                                  className="w-5 h-5 flex items-center justify-center rounded text-red-600 hover:bg-red-100"
                                >
                                  <i className="ri-check-line text-xs"></i>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                                >
                                  <i className="ri-close-line text-xs"></i>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(cat.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title={t('admin_settings_cat_delete')}
                              >
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      {(saving || localSaving) && (
        <div className="fixed bottom-4 right-4 px-4 py-2.5 bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-white text-sm rounded-xl shadow-lg flex items-center gap-2 z-50">
          <i className="ri-loader-4-line animate-spin"></i>
          Enregistrement...
        </div>
      )}
    </div>
  );
}
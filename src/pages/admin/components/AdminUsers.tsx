import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
  is_banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  resources_count: number | null;
  contribution_score: number | null;
  avatar_url: string | null;
  institution: string | null;
  city: string | null;
  specialty: string | null;
  bio: string | null;
}

function displayRole(role: string | null): string {
  return role === 'admin' ? 'Administrateur' : 'Enseignant / Reviewer';
}

interface AdminUsersProps {
  onCountsRefresh: () => void;
}

export default function AdminUsers({ onCountsRefresh }: AdminUsersProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [banReason, setBanReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add user modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'teacher' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit user modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserRow>>();
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  // Reset password state
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, email, role, created_at, is_banned, banned_at, banned_reason, resources_count, contribution_score, avatar_url, institution, city, specialty, bio')
        .order('created_at', { ascending: false });

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const { data, error } = await withTimeout(query, 8000);
      if (error) throw error;

      let filtered = data || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (u: UserRow) =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
      }

      setUsers(filtered);
    } catch (err) {
      console.error('Users fetch error:', err);
      setToast({ type: 'error', message: 'Erreur lors du chargement des utilisateurs.' });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBanToggle = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      if (selectedUser.is_banned) {
        const { error } = await withTimeout(supabase
          .from('profiles')
          .update({ is_banned: false, banned_at: null, banned_reason: null })
          .eq('id', selectedUser.id), 8000);
        if (error) throw error;
        setToast({ type: 'success', message: `${selectedUser.name || selectedUser.email} a été débanni.` });
      } else {
        const { error } = await withTimeout(supabase
          .from('profiles')
          .update({ is_banned: true, banned_at: new Date().toISOString(), banned_reason: banReason || 'Violation des règles' })
          .eq('id', selectedUser.id), 8000);
        if (error) throw error;
        setToast({ type: 'success', message: `${selectedUser.name || selectedUser.email} a été banni.` });
      }
      setBanModalOpen(false);
      setBanReason('');
      setSelectedUser(null);
      fetchUsers();
      onCountsRefresh();
    } catch (err) {
      console.error('Ban error:', err);
      setToast({ type: 'error', message: 'Erreur lors de l\'action de bannissement.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(true);
    try {
      const { error } = await withTimeout(supabase.from('profiles').update({ role: newRole }).eq('id', userId), 8000);
      if (error) throw error;
      setToast({ type: 'success', message: 'Rôle mis à jour.' });
      fetchUsers();
      onCountsRefresh();
    } catch (err) {
      console.error('Role change error:', err);
      setToast({ type: 'error', message: 'Erreur lors du changement de rôle.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUser = async () => {
    setAddError(null);
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setAddError('Tous les champs sont obligatoires.');
      return;
    }
    if (addForm.password.length < 6) {
      setAddError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setAddLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            email: addForm.email.trim(),
            password: addForm.password,
            name: addForm.name.trim(),
            role: addForm.role,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || result.error) {
        throw new Error(result.error || 'Erreur lors de la création.');
      }

      setToast({ type: 'success', message: `${addForm.name} a été créé avec succès.` });
      setAddModalOpen(false);
      setAddForm({ name: '', email: '', password: '', role: 'teacher' });
      fetchUsers();
      onCountsRefresh();
    } catch (err: any) {
      console.error('Add user error:', err);
      setAddError(err?.message || 'Erreur lors de la création de l\'utilisateur.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditOpen = (user: UserRow) => {
    setSelectedUser(user);
    setEditForm({
      id: user.id,
      name: user.name,
      email: user.email,
      institution: user.institution,
      city: user.city,
      specialty: user.specialty,
      bio: user.bio,
      avatar_url: user.avatar_url,
    });
    setEditAvatarFile(null);
    setEditAvatarPreview(user.avatar_url);
    setEditError(null);
    setResetSent(false);
    setEditModalOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setEditError('Veuillez sélectionner une image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditError('L\'image ne doit pas dépasser 2 Mo.');
      return;
    }
    setEditError(null);
    setEditAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setEditAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditSave = async () => {
    if (!selectedUser) return;
    setEditLoading(true);
    setEditError(null);
    try {
      let avatarUrl = editForm.avatar_url || null;

      if (editAvatarFile) {
        const ext = editAvatarFile.name.split('.').pop() || 'png';
        const path = `avatars/${selectedUser.id}-${Date.now()}.${ext}`;
        const { error: upError } = await supabase.storage
          .from('avatars')
          .upload(path, editAvatarFile, { upsert: true });
        if (upError) throw upError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const { error } = await withTimeout(
        supabase
          .from('profiles')
          .update({
            name: editForm.name?.trim() || null,
            email: editForm.email?.trim() || null,
            institution: editForm.institution?.trim() || null,
            city: editForm.city?.trim() || null,
            specialty: editForm.specialty?.trim() || null,
            bio: editForm.bio?.trim() || null,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedUser.id),
        15000
      );

      if (error) throw error;
      setToast({ type: 'success', message: 'Profil mis à jour avec succès.' });
      setEditModalOpen(false);
      setEditAvatarFile(null);
      fetchUsers();
      onCountsRefresh();
    } catch (err: any) {
      console.error('Edit user error:', err);
      setEditError(err?.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async (targetEmail?: string) => {
    const email = targetEmail || selectedUser?.email;
    if (!email) return;
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setResetSent(true);
      setToast({ type: 'success', message: `Email de réinitialisation envoyé à ${email}.` });
      setTimeout(() => setResetSent(false), 4000);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setToast({ type: 'error', message: err?.message || 'Erreur lors de l\'envoi de l\'email.' });
    } finally {
      setResetLoading(false);
    }
  };

  // auto dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-4">
      {/* Filters + Add user */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="w-5 h-5 flex items-center justify-center text-slate-400">
            <i className="ri-search-line"></i>
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            className="flex-1 bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-sharek-400"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Administrateur</option>
            <option value="teacher">Enseignant / Reviewer</option>
          </select>
          <button
            onClick={() => { setAddModalOpen(true); setAddError(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-user-add-line"></i>
            </div>
            Utilisateur
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Utilisateur</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Rôle</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Inscription</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Statut</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-xs font-bold">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link to={`/enseignant/${u.id}`} className="font-medium text-slate-800 dark:text-slate-100 hover:text-sharek-600">
                              {u.name || 'Sans nom'}
                            </Link>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role || 'teacher'}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={actionLoading}
                          className="bg-white border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sharek-400"
                        >
                          <option value="teacher">Enseignant / Reviewer</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.contribution_score || 0}</td>
                      <td className="px-4 py-3">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-forbid-line"></i></div>
                            Banni
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-check-line"></i></div>
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => handleEditOpen(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors whitespace-nowrap"
                          >
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-edit-line"></i></div>
                            Modifier
                          </button>
                          <button
                            onClick={() => { setSelectedUser(u); setBanModalOpen(true); }}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                              u.is_banned
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            }`}
                          >
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className={u.is_banned ? 'ri-user-add-line' : 'ri-user-forbid-line'}></i>
                            </div>
                            {u.is_banned ? 'Débannir' : 'Bannir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucun utilisateur trouvé.
                </div>
              )}
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  {/* Header: avatar + nom + email */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-sm font-bold shrink-0">
                      {(u.name || u.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/enseignant/${u.id}`} className="font-medium text-slate-800 dark:text-slate-100 text-sm hover:text-sharek-600 block truncate">
                        {u.name || 'Sans nom'}
                      </Link>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <p className="text-slate-400 mb-0.5">Rôle</p>
                      <select
                        value={u.role || 'teacher'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={actionLoading}
                        className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sharek-400"
                      >
                        <option value="teacher">Enseignant / Reviewer</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <p className="text-slate-400 mb-0.5">Inscrit</p>
                      <p className="text-slate-700 dark:text-slate-200 font-medium">{new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <p className="text-slate-400 mb-0.5">Score</p>
                      <p className="text-slate-700 dark:text-slate-200 font-medium">{u.contribution_score || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <p className="text-slate-400 mb-0.5">Statut</p>
                      {u.is_banned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-forbid-line"></i></div>
                          Banni
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-check-line"></i></div>
                          Actif
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditOpen(u)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
                    >
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-edit-line"></i></div>
                      Modifier
                    </button>
                    <button
                      onClick={() => { setSelectedUser(u); setBanModalOpen(true); }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        u.is_banned
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className={u.is_banned ? 'ri-user-add-line' : 'ri-user-forbid-line'}></i>
                      </div>
                      {u.is_banned ? 'Débannir' : 'Bannir'}
                    </button>
                  </div>
                  <button
                    onClick={() => handleResetPassword(u.email)}
                    disabled={resetLoading || !u.email}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors disabled:opacity-50"
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      {resetLoading ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-mail-send-line"></i>
                      )}
                    </div>
                    Réinitialiser le mot de passe
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add user modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-lg">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Ajouter un utilisateur</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Créez un nouveau compte enseignant ou administrateur.</p>

            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nom complet (ex. Fatima Benali)"
                  className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                />
              </div>
              <div>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email (exemple@email.com)"
                  className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Mot de passe (min. 6 caractères)"
                  className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                />
              </div>
              <div>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-sharek-400"
                >
                  <option value="teacher">Enseignant / Reviewer</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>

            {addError && (
              <div className="mt-3 rounded-md px-3 py-2 text-xs text-red-600 bg-red-50 border border-red-100">
                {addError}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => { setAddModalOpen(false); setAddError(null); setAddForm({ name: '', email: '', password: '', role: 'teacher' }); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddUser}
                disabled={addLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-sharek-600 hover:bg-sharek-700 transition-colors ${addLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {addLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Création...
                  </span>
                ) : (
                  'Créer le compte'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Modifier le profil</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {selectedUser.name || selectedUser.email}
            </p>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {editAvatarPreview ? (
                    <img
                      src={editAvatarPreview}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-xl font-bold border border-slate-200 dark:border-slate-700">
                      {(editForm.name || selectedUser.name || selectedUser.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-sharek-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-sharek-700 transition-colors shadow-sm">
                    <i className="ri-camera-line text-xs"></i>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-400">Cliquez sur l'icône pour changer la photo</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nom complet</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom complet"
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Institution</label>
                  <input
                    type="text"
                    value={editForm.institution || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, institution: e.target.value }))}
                    placeholder="Institution / École"
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ville</label>
                  <input
                    type="text"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Ville"
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Spécialité</label>
                  <input
                    type="text"
                    value={editForm.specialty || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, specialty: e.target.value }))}
                    placeholder="Spécialité / Matière"
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Bio</label>
                  <textarea
                    value={editForm.bio || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                    placeholder="Biographie courte..."
                    rows={3}
                    maxLength={500}
                    className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-0.5 text-right">{(editForm.bio || '').length}/500</p>
                </div>
              </div>
            </div>

            {editError && (
              <div className="mt-4 rounded-md px-3 py-2 text-xs text-red-600 bg-red-50 border border-red-100">
                {editError}
              </div>
            )}

            {/* Reset password */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Réinitialiser le mot de passe</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Envoyer un email de réinitialisation à cet utilisateur</p>
                </div>
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading || resetSent || !selectedUser?.email}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    resetSent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30'
                  } ${resetLoading || resetSent ? 'cursor-not-allowed' : ''}`}
                >
                  {resetLoading ? (
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-loader-4-line animate-spin"></i>
                    </div>
                  ) : resetSent ? (
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-check-line"></i>
                    </div>
                  ) : (
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-mail-send-line"></i>
                    </div>
                  )}
                  {resetSent ? 'Email envoyé' : "Envoyer l'email"}
                </button>
              </div>
            </div>

            {/* Sticky action bar */}
            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-slate-100 dark:border-slate-700/50 mt-5 flex gap-3 justify-end">
              <button
                onClick={() => { setEditModalOpen(false); setEditAvatarFile(null); setEditError(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-sharek-600 hover:bg-sharek-700 transition-colors ${editLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {editLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Sauvegarde...
                  </span>
                ) : (
                  'Enregistrer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      {banModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-lg">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {selectedUser.is_banned ? 'Débannir' : 'Bannir'} un utilisateur
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {selectedUser.is_banned
                ? `Voulez-vous réactiver le compte de ${selectedUser.name || selectedUser.email} ?`
                : `Voulez-vous suspendre le compte de ${selectedUser.name || selectedUser.email} ?`}
            </p>
            {!selectedUser.is_banned && (
              <div className="mb-4">
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Motif (optionnel)..."
                  className="w-full bg-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-sharek-400"
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setBanModalOpen(false); setBanReason(''); setSelectedUser(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 dark:bg-slate-700/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBanToggle}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                  selectedUser.is_banned ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                } ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {actionLoading ? 'Chargement...' : selectedUser.is_banned ? 'Débannir' : 'Bannir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useCategories } from '@/hooks/useCategories';
import MainLayout from '@/components/layout/MainLayout';

interface SettingsState {
  name: string;
  email: string;
  institution: string;
  city: string;
  specialty: string;
  level: string;
  bio: string;
  notifications_email: boolean;
  notifications_push: boolean;
  notify_new_comment: boolean;
  notify_new_review: boolean;
  notify_recommendation: boolean;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

const initialSettings: SettingsState = {
  name: '',
  email: '',
  institution: '',
  city: '',
  specialty: 'Sciences de la Vie et de la Terre',
  level: '',
  bio: '',
  notifications_email: true,
  notifications_push: true,
  notify_new_comment: true,
  notify_new_review: true,
  notify_recommendation: true,
  language: 'fr',
  theme: 'light',
};

export default function Parametres() {
  const { i18n } = useTranslation('common');
  const { user, logout } = useAuth();
  const toast = useToast();
  const { theme: currentTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { levels, specialties } = useCategories();

  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'display' | 'security'>('account');
  const [isAdmin, setIsAdmin] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  }, []);

  // Real-time notifications badge + preview
  const { unreadCount, notifs, markAsRead, markAllAsRead, loading: notifsLoading } = useRealtimeNotifications(user?.id);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(data.role === 'admin');
        const loaded: SettingsState = {
          name: data.name || user.name || '',
          email: data.email || user.email || '',
          institution: data.institution || '',
          city: data.city || '',
          specialty: data.specialty || 'Sciences de la Vie et de la Terre',
          level: data.level || '',
          bio: data.bio || '',
          notifications_email: data.notifications_email !== false,
          notifications_push: data.notifications_push !== false,
          notify_new_comment: data.notify_new_comment !== false,
          notify_new_review: data.notify_new_review !== false,
          notify_recommendation: data.notify_recommendation !== false,
          language: data.language || 'fr',
          theme: (data.theme as 'light' | 'dark' | 'system') || 'light',
        };
        setSettings(loaded);
        // Sync i18n
        i18n.changeLanguage(loaded.language);
        // Note: theme is managed by ThemeContext via localStorage - we load the DB value
        // into settings state so the UI reflects it, but we don't override the active context.
        // The user must click 'Enregistrer' to persist their choice.
      } else {
        setSettings((prev) => ({
          ...prev,
          name: user.name || '',
          email: user.email || '',
        }));
      }
    } catch {
      setSettings((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    } finally {
      setLoading(false);
    }
  }, [user, i18n]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      const payload: Record<string, any> = {
        id: user.id,
        name: settings.name,
        email: settings.email,
        notifications_email: settings.notifications_email,
        notifications_push: settings.notifications_push,
        notify_new_comment: settings.notify_new_comment,
        notify_new_review: settings.notify_new_review,
        notify_recommendation: settings.notify_recommendation,
        language: settings.language,
        theme: settings.theme,
        updated_at: new Date().toISOString(),
      };

      // Only save teacher fields if not admin
      if (!isAdmin) {
        payload.institution = settings.institution;
        payload.city = settings.city;
        payload.specialty = settings.specialty;
        payload.level = settings.level;
        payload.bio = settings.bio;
      }

      const { error } = await supabase.from('profiles').upsert(payload);

      if (error) throw error;

      // Sync i18n live
      i18n.changeLanguage(settings.language);
      // Sync theme live
      if (settings.theme !== currentTheme) {
        setTheme(settings.theme);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      logger.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde des paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof SettingsState>(field: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 4000);
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetPasswordEmail = async () => {
    if (!settings.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(settings.email);
    if (error) {
      toast.error(error.message || "Erreur d'envoi de l'email.");
    } else {
      toast.success('Email de réinitialisation envoyé !');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/connexion');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 mr-2">
            <i className="ri-loader-4-line animate-spin"></i>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  const tabs = [
    { key: 'account' as const, label: 'Compte', icon: 'ri-user-settings-line', badge: 0 },
    { key: 'notifications' as const, label: 'Notifications', icon: 'ri-notification-3-line', badge: unreadCount },
    { key: 'display' as const, label: 'Affichage', icon: 'ri-palette-line', badge: 0 },
    { key: 'security' as const, label: 'Sécurité', icon: 'ri-shield-keyhole-line', badge: 0 },
  ];

  return (
    <MainLayout>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line text-emerald-600 dark:text-emerald-400"></i>
          </div>
          {toastMsg}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Gérez vos informations personnelles, notifications et préférences d'affichage</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-800/30">
            <div className="w-4 h-4 flex items-center justify-center relative">
              <i className="ri-notification-3-line"></i>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-slate-900"></span>
            </div>
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Sidebar tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden lg:sticky lg:top-4">
            <div className="flex lg:flex-col overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 text-sm font-medium transition-colors text-left whitespace-nowrap ${
                  activeTab === tab.key
                    ? isAdmin ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 lg:border-l-2 border-b-2 lg:border-b-0 border-violet-600' : 'bg-sharek-50 dark:bg-sharek-900/20 text-sharek-700 dark:text-sharek-400 lg:border-l-2 border-b-2 lg:border-b-0 border-sharek-600'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center relative">
                  <i className={tab.icon}></i>
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white dark:border-slate-900">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                {tab.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Account tab */}
          {activeTab === 'account' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Informations du compte</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Mettez à jour vos informations personnelles</p>
                {isAdmin && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-xs font-medium">
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-shield-keyhole-line text-[10px]"></i>
                    </div>
                    Mode administrateur - certains champs sont masqués
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className={isAdmin
                        ? "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
                        : "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                      }
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      disabled
                      className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">L'email ne peut pas être modifié</p>
                  </div>
                </div>

                {!isAdmin && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                          Établissement
                        </label>
                        <input
                          type="text"
                          value={settings.institution}
                          onChange={(e) => updateField('institution', e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                          placeholder="Lycée ou collège"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                          Ville
                        </label>
                        <input
                          type="text"
                          value={settings.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                          placeholder="Ex: Rabat, Casablanca..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                          Spécialité
                        </label>
                        <select
                          value={settings.specialty}
                          onChange={(e) => updateField('specialty', e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                        >
                          <option value="">Spécialité</option>
                          {specialties.map((s) => (
                            <option key={s.slug} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                          Niveau enseigné
                        </label>
                        <select
                          value={settings.level}
                          onChange={(e) => updateField('level', e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                        >
                          <option value="">Sélectionner...</option>
                          {levels.map((lvl) => (
                            <option key={lvl.slug} value={lvl.name}>
                              {lvl.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                        Biographie
                      </label>
                      <textarea
                        value={settings.bio}
                        onChange={(e) => updateField('bio', e.target.value)}
                        rows={4}
                        maxLength={500}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all resize-none"
                        placeholder="Décrivez votre parcours, vos intérêts pédagogiques..."
                      />
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1 text-right">
                        {settings.bio.length}/500
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Recent notifications preview */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Notifications récentes</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {notifsLoading
                        ? 'Chargement...'
                        : notifs.length === 0
                        ? 'Aucune notification pour le moment'
                        : `${unreadCount} non lu${unreadCount > 1 ? 's' : ''} sur ${notifs.length}`}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        markAllAsRead();
                        showToast('Toutes les notifications sont lues');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifsLoading ? (
                    <div className="px-6 py-8 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Chargement des notifications...
                    </div>
                  ) : notifs.length === 0 ? (
                    <div className="px-6 py-8 flex flex-col items-center text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      <div className="w-10 h-10 flex items-center justify-center mb-2">
                        <i className="ri-notification-off-line text-xl"></i>
                      </div>
                      <p className="text-sm">Aucune notification récente</p>
                    </div>
                  ) : (
                    notifs.slice(0, 6).map((n) => {
                      const typeIcon: Record<string, string> = {
                        comment: 'ri-message-3-line',
                        review: 'ri-user-follow-line',
                        recommendation: 'ri-file-list-3-line',
                        mention: 'ri-at-line',
                        resource: 'ri-folder-upload-line',
                        system: 'ri-information-line',
                      };
                      const icon = typeIcon[n.type] || 'ri-notification-3-line';
                      const dateStr = new Date(n.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) {
                              markAsRead(n.id);
                              showToast('Notification marquée comme lue');
                            }
                            // Navigate based on notification type
                            if (n.resource_id) {
                              navigate(`/ressources/${n.resource_id}`);
                            } else if (n.type === 'message') {
                              navigate('/messages');
                            }
                          }}
                          className={`px-6 py-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                            n.read
                              ? 'hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                              : 'bg-sharek-50 dark:bg-sharek-900/10 hover:bg-sharek-100 dark:hover:bg-sharek-900/20'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                              n.read
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                : 'bg-sharek-100 dark:bg-sharek-900/30 text-sharek-700 dark:text-sharek-400'
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className={icon}></i>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm leading-snug ${n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100 font-medium'}`}>
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5"></span>
                              )}
                            </div>
                            {n.message && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.message}</p>
                            )}
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">{dateStr}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {notifs.length > 6 && (
                  <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      + {notifs.length - 6} notification{notifs.length - 6 > 1 ? 's' : ''} supplémentaire{notifs.length - 6 > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Preferences toggles */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Préférences de notification</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Choisissez quand et comment vous être notifié</p>
                </div>

                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Notifications par email</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recevoir des emails pour les événements importants</p>
                    </div>
                    <button
                      onClick={() => updateField('notifications_email', !settings.notifications_email)}
                      className={`relative shrink-0 ml-3 w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        settings.notifications_email ? (isAdmin ? 'bg-violet-600 focus:ring-violet-400' : 'bg-sharek-600 focus:ring-sharek-400') : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-200 rounded-full shadow transition-transform ${
                          settings.notifications_email ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      ></span>
                    </button>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                  <div className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Notifications push</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Alertes en temps réel dans l'application</p>
                    </div>
                    <button
                      onClick={() => updateField('notifications_push', !settings.notifications_push)}
                      className={`relative shrink-0 ml-3 w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        settings.notifications_push ? (isAdmin ? 'bg-violet-600 focus:ring-violet-400' : 'bg-sharek-600 focus:ring-sharek-400') : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-200 rounded-full shadow transition-transform ${
                          settings.notifications_push ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      ></span>
                    </button>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Choisissez quand et comment vous être notifié</p>

                  {[
                    {
                      field: 'notify_new_comment' as const,
                      label: 'Nouveau commentaire',
                      desc: 'Quand quelqu\'un commente votre ressource',
                      icon: 'ri-message-3-line',
                    },
                    {
                      field: 'notify_new_review' as const,
                      label: 'Nouveau reviewer',
                      desc: 'Quand un enseignant accepte de reviewer votre ressource',
                      icon: 'ri-user-follow-line',
                    },
                    {
                      field: 'notify_recommendation' as const,
                      label: 'Recommandation soumise',
                      desc: 'Quand un reviewer dépose son fichier de recommandation',
                      icon: 'ri-file-list-3-line',
                    },
                  ].map((item) => (
                    <div key={item.field} className="flex items-center justify-between py-2 gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className={item.icon}></i>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings[item.field]}
                        onChange={(e) => updateField(item.field, e.target.checked)}
                        className={`shrink-0 w-4 h-4 rounded border-slate-300 dark:border-slate-600 ${isAdmin ? 'text-violet-600 focus:ring-violet-500' : 'text-sharek-600 dark:text-sharek-400 focus:ring-sharek-500'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Display tab */}
          {activeTab === 'display' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Préférences d'affichage</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Personnalisez l'apparence de l'application</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Langue</label>
                  <div className="flex gap-3">
                    {[
                      { key: 'fr', label: 'Français', flag: '🇫🇷' },
                      { key: 'ar', label: 'العربية', flag: '🇲🇦' },
                    ].map((lang) => (
                      <button
                        key={lang.key}
                        onClick={() => {
                          updateField('language', lang.key);
                          i18n.changeLanguage(lang.key);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          settings.language === lang.key
                            ? isAdmin
                              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400'
                              : 'bg-sharek-50 dark:bg-sharek-900/20 border-sharek-300 dark:border-sharek-700 text-sharek-700 dark:text-sharek-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Thème</label>
                  <div className="flex gap-3">
                    {[
                      { key: 'light' as const, label: 'Clair', icon: 'ri-sun-line' },
                      { key: 'dark' as const, label: 'Sombre', icon: 'ri-moon-line' },
                      { key: 'system' as const, label: 'Système', icon: 'ri-computer-line' },
                    ].map((th) => (
                      <button
                        key={th.key}
                        onClick={() => {
                          updateField('theme', th.key);
                          setTheme(th.key);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          settings.theme === th.key
                            ? isAdmin
                              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400'
                              : 'bg-sharek-50 dark:bg-sharek-900/20 border-sharek-300 dark:border-sharek-700 text-sharek-700 dark:text-sharek-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={th.icon}></i>
                        </div>
                        {th.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2">
                    {settings.theme === 'system'
                      ? "Le thème s'adaptera automatiquement à vos préférences système."
                      : settings.theme === 'dark'
                      ? 'Le thème sombre est activé.'
                      : 'Le thème clair est activé.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Security tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Sécurité du compte</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gérez votre mot de passe et la connexion</p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Change password directly */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Changer le mot de passe</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Nouveau mot de passe</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
                        placeholder="Nouveau mot de passe"
                      className={isAdmin
                        ? "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
                        : "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                      }
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); }}
                        placeholder="Confirmer le mot de passe"
                      className={isAdmin
                        ? "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
                        : "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-sharek-400 focus:ring-1 focus:ring-sharek-400 transition-all"
                      }
                      />
                    </div>

                    {passwordError && (
                      <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-md px-3 py-2">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-error-warning-line"></i>
                        </div>
                        <span>{passwordError}</span>
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-md px-3 py-2">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-check-line"></i>
                        </div>
                        <span>Mot de passe mis à jour avec succès</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={passwordLoading || !newPassword || !confirmPassword}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap ${
                          isAdmin ? 'bg-violet-600 hover:bg-violet-700' : 'bg-sharek-600 hover:bg-sharek-700'
                        }`}
                      >
                        {passwordLoading ? (
                          <span className="inline-flex items-center gap-1.5">
                            <i className="ri-loader-4-line animate-spin"></i>
                            Enregistrement...
                          </span>
                        ) : (
                          'Mettre à jour le mot de passe'
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                  {/* Reset by email */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Changer le mot de passe</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Vous recevrez un email avec un lien de réinitialisation</p>
                    </div>
                    <button
                      onClick={handleResetPasswordEmail}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                        isAdmin
                          ? 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                          : 'text-sharek-700 dark:text-sharek-400 bg-sharek-50 dark:bg-sharek-900/20 hover:bg-sharek-100 dark:hover:bg-sharek-900/30'
                      }`}
                    >
                      Réinitialiser
                    </button>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Déconnexion</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Vous devrez vous reconnecter pour accéder à votre compte</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
                    >
                      <div className="w-4 h-4 flex items-center justify-center inline-flex mr-1">
                        <i className="ri-logout-box-r-line"></i>
                      </div>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save bar */}
          {activeTab !== 'security' && (
            <div className="mt-6 flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft px-6 py-4">
              <div>
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-check-line"></i>
                    </div>
                    Modifications enregistrées
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    fetchSettings();
                    setSaved(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 ${
                    isAdmin ? 'bg-violet-600 hover:bg-violet-700' : 'bg-sharek-600 hover:bg-sharek-700'
                  }`}
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-1.5">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-loader-4-line animate-spin"></i>
                      </div>
                      Enregistrement...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-save-line"></i>
                      </div>
                      Enregistrer
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
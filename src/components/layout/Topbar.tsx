import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import AvatarImage from '@/components/AvatarImage';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';

// Removed - now in useRealtimeNotifications hook

interface TopbarProps {
  onMenuToggle: () => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';

  const {
    notifs,
    loading: loadingNotifs,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useRealtimeNotifications(user?.id);

  const [toast, setToast] = useState<string | null>(null);
  const [notifsDisplay, setNotifsDisplay] = useState(notifs);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleMarkAsRead = useCallback(
    async (notifId: string) => {
      await markAsRead(notifId);
      showToast('Notification marquée comme lue');
    },
    [markAsRead, showToast]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
    showToast('Toutes les notifications sont lues');
  }, [markAllAsRead, showToast]);

  useEffect(() => {
    setNotifsDisplay(notifs);
  }, [notifs]);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Messages non lus + realtime
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadMessages = async () => {
      try {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('read', false);
        if (!error && count !== null) {
          setUnreadMessagesCount(count);
        }
      } catch {
        // ignore
      }
    };
    fetchUnreadMessages();

    const msgChannel = supabase
      .channel(`messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setUnreadMessagesCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id, isAdmin]);

  const currentUserId = user?.id || 't1';
  const userName = user?.name || 'Fatima Zahra';
  const userEmail = user?.email || 'f.alaoui@lycee.ma';
  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'FA';
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userColor, setUserColor] = useState('#0d9488');

  // Charger l'avatar depuis Supabase profiles
  const loadAvatar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, color')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setAvatarUrl(data.avatar_url);
        if (data.color) setUserColor(data.color);
      }
    } catch {
      // Silencieux
    }
  }, [user?.id]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const typeConfig: Record<string, { bg: string; text: string; icon: string }> = {
    review: { bg: 'bg-ocean-100', text: 'text-ocean-600', icon: 'ri-team-line' },
    comment: { bg: 'bg-sharek-100', text: 'text-sharek-600', icon: 'ri-message-3-line' },
    recommendation: { bg: 'bg-amber-100', text: 'text-amber-600', icon: 'ri-file-list-3-line' },
    resource: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'ri-folder-open-line' },
    mention: { bg: 'bg-violet-100', text: 'text-violet-600', icon: 'ri-at-line' },
    message: { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: 'ri-mail-line' },
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 fixed top-0 right-0 left-0 lg:left-64 z-30 flex items-center justify-between px-4 lg:px-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line text-emerald-600 dark:text-emerald-400"></i>
          </div>
          {toast}
        </div>
      )}

      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-menu-line"></i>
          </div>
        </button>

        {/* Admin badge */}
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700 whitespace-nowrap">
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-shield-user-line"></i>
            </div>
            <span className="hidden md:inline">Mode administration</span>
            <span className="md:hidden">Admin</span>
          </span>
        )}

        {!isAdmin && (
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-72 ${
              searchFocused
                ? 'border-sharek-400 bg-white dark:bg-slate-900 shadow-soft'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <i className="ri-search-line text-sm"></i>
            </div>
            <input
              type="text"
              placeholder="Rechercher une ressource..."
              className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigate(`/ressources?search=${encodeURIComponent(searchQuery.trim())}`);
                  setSearchQuery('');
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <i className="ri-close-line text-xs"></i>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: notifications + profile */}
      <div className="flex items-center gap-2">
        {!user ? (
          <Link
            to="/connexion"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-login-box-line"></i>
            Connexion
          </Link>
        ) : (
          <>
            {/* Notifications - visible for everyone, right next to profile */}
            <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-notification-3-line"></i>
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-11 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-100 dark:border-slate-700 py-2 z-50 max-w-[calc(100vw-1rem)]">
                    <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-sharek-600 hover:underline"
                        >
                          Tout marquer comme lu
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {loadingNotifs ? (
                        <div className="px-4 py-6 text-center">
                          <div className="w-5 h-5 flex items-center justify-center mx-auto mb-2">
                            <i className="ri-loader-4-line animate-spin text-ocean-500"></i>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Chargement...</p>
                        </div>
                      ) : notifsDisplay.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 mx-auto mb-2">
                            <i className="ri-notification-3-line text-lg"></i>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Aucune notification</p>
                        </div>
                      ) : (
                        notifsDisplay.map((notif) => {
                          const config = typeConfig[notif.type] || typeConfig.resource;
                          return (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (!notif.read) handleMarkAsRead(notif.id);
                                setNotifOpen(false);
                                // Smart navigation based on notification type
                                if (notif.type === 'review' && notif.resource_id) {
                                  navigate(`/ressources/${notif.resource_id}`);
                                } else if (notif.type === 'comment' && notif.resource_id) {
                                  navigate(`/ressources/${notif.resource_id}`);
                                } else if (notif.type === 'recommendation' && notif.resource_id) {
                                  navigate(`/ressources/${notif.resource_id}`);
                                } else if (notif.type === 'mention' && notif.resource_id) {
                                  navigate(`/ressources/${notif.resource_id}`);
                                } else if (notif.type === 'resource' && notif.resource_id) {
                                  navigate(`/ressources/${notif.resource_id}`);
                                } else if (notif.type === 'message') {
                                  navigate('/messages');
                                }
                              }}
                              className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 ${
                                !notif.read ? 'bg-sharek-50/50 dark:bg-sharek-900/20' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${config.bg} ${config.text}`}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    <i className={`${config.icon} text-xs`}></i>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                                      {notif.title}
                                    </p>
                                    {notif.resource_type && (
                                      <ResourceTypeBadge
                                        type={notif.resource_type}
                                        label={notif.resource_type_label}
                                        className="text-[10px] px-1.5 py-0.5 rounded-md"
                                        iconClassName="w-3 h-3"
                                      />
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{timeAgo(notif.created_at)}</p>
                                </div>
                                {!notif.read && (
                                  <div className="w-2 h-2 rounded-full bg-sharek-500 flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

            {/* Messages - visible for everyone including admin */}
            <Link
              to="/messages"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-mail-send-line"></i>
              </div>
              {unreadMessagesCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </Link>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <AvatarImage
                  src={avatarUrl}
                  initials={userInitials}
                  color={userColor}
                  className="w-8 h-8"
                />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{userName}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{isAdmin ? 'Administrateur' : userEmail}</p>
                </div>
                <div className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
                  <i className="ri-arrow-down-s-line text-sm"></i>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-100 dark:border-slate-700 py-2 z-50">
                  {!isAdmin && (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/profil');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                    >
                      <div className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <i className="ri-user-line"></i>
                      </div>
                      Mon profil
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/parametres');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <i className="ri-settings-3-line"></i>
                    </div>
                    Paramètres
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                      navigate('/connexion');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-logout-box-r-line"></i>
                    </div>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
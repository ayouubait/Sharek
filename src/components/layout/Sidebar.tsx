import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logoUrl from '@/assets/logo.webp';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const publicMenuItems = [
  { path: '/ressources', label: 'Ressources', icon: 'ri-folder-open-line' },
];

const privateMenuItems = [
  { path: '/dashboard', label: 'Tableau de bord', icon: 'ri-dashboard-line' },
  { path: '/ressources', label: 'Ressources', icon: 'ri-folder-open-line' },
  { path: '/mes-ressources', label: 'Mes ressources', icon: 'ri-stack-line' },
  { path: '/mes-favoris', label: 'Mes favoris', icon: 'ri-heart-3-line' },
  { path: '/peer-review', label: 'Peer reviewing', icon: 'ri-team-line' },
  { path: '/messages', label: 'Messages', icon: 'ri-mail-send-line' },
  { path: '/commentaires', label: 'Commentaires', icon: 'ri-message-3-line' },
  { path: '/profil', label: 'Mon profil', icon: 'ri-user-line' },
  { path: '/parametres', label: 'Paramètres', icon: 'ri-settings-3-line' },
];

const adminMenuItems = [
  { path: '/admin', label: 'Vue d\'ensemble', icon: 'ri-dashboard-line' },
  { path: '/ressources', label: 'Ressources', icon: 'ri-folder-open-line' },
  { path: '/messages', label: 'Messages', icon: 'ri-mail-send-line' },
  { path: '/profil', label: 'Mon profil', icon: 'ri-user-line' },
  { path: '/parametres', label: 'Paramètres', icon: 'ri-settings-3-line' },
];

const addResourceItem = { path: '/ressources/ajouter', label: 'Ajouter une ressource', icon: 'ri-add-circle-line' };

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [activePath, setActivePath] = useState(location.pathname);

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  const isAdmin = user?.role === 'admin';

  const menuItems = user ? (isAdmin ? adminMenuItems : privateMenuItems) : publicMenuItems;

  const userName = user?.name || 'Invité';
  const userRole = isAdmin ? 'Administrateur' : (user?.email || 'Visiteur');
  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center px-4 border-b border-slate-100 dark:border-slate-700">
          <Link to="/" className="flex items-center" onClick={onClose}>
            <img src={logoUrl} alt="ShareK" className="h-12 w-auto object-contain" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {/* CTA : Ajouter une ressource — uniquement pour les non-admin */}
          {user && !isAdmin && (
            <Link
              to={addResourceItem.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap mb-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={addResourceItem.icon}></i>
              </div>
              {addResourceItem.label}
            </Link>
          )}

          {menuItems.map((item) => {
            const isActive = activePath === item.path || (item.path !== '/' && activePath.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sharek-50 dark:bg-sharek-900/20 text-sharek-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={item.icon}></i>
                </div>
                {item.label}
              </Link>
            );
          })}

          {!user && (
            <Link
              to="/connexion"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-sharek-700 dark:text-sharek-400 bg-sharek-50 dark:bg-sharek-900/20 hover:bg-sharek-100 dark:hover:bg-sharek-900/30"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-login-box-line"></i>
              </div>
              Se connecter
            </Link>
          )}
        </nav>

        {/* User mini profile at bottom */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          {user ? (
            <Link to={isAdmin ? '/admin' : '/profil'} className="flex items-center gap-3" onClick={onClose}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-ocean-100 text-ocean-600'
              }`}>
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{userName}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{userRole}</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-sm font-semibold">
                ??
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">Invité</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">Visiteur</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
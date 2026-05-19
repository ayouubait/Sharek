import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import type { Resource } from '@/mocks/data';
import { useCategories } from '@/hooks/useCategories';
import { getTypeConfig } from '@/lib/typeConfig';
import ResourceTypeBadge from '@/components/ResourceTypeBadge';
import Footer from '@/components/layout/Footer';

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  peer_reviewed: { label: 'Peer reviewed', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  not_evaluated: { label: 'Non évalué', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
  under_review: { label: 'En cours de peer reviewing', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending_reviewers: { label: 'En attente de reviewers', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  needs_revision: { label: 'À réviser', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

function PublicHeader({ onNavClick }: { onNavClick: (id: string) => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <Link to="/accueil" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sharek-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SK</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">ShareK</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 leading-tight">شارك</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <a
            href="#accueil"
            onClick={(e) => { e.preventDefault(); onNavClick('accueil'); }}
            className="px-3 py-2 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg transition-colors cursor-pointer"
          >
            Accueil
          </a>
          <a
            href="#about"
            onClick={(e) => { e.preventDefault(); onNavClick('about'); }}
            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
          >
            À propos
          </a>
          <a
            href="#contact"
            onClick={(e) => { e.preventDefault(); onNavClick('contact'); }}
            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
          >
            Contactez-nous
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-dashboard-line"></i>
              Mon espace
            </Link>
          ) : (
            <Link
              to="/connexion"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-login-box-line"></i>
              Connexion
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}></i>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-1">
          <a
            href="#accueil"
            onClick={(e) => { e.preventDefault(); onNavClick('accueil'); setMobileMenuOpen(false); }}
            className="block px-3 py-2.5 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg"
          >
            Accueil
          </a>
          <a
            href="#about"
            onClick={(e) => { e.preventDefault(); onNavClick('about'); setMobileMenuOpen(false); }}
            className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg"
          >
            À propos
          </a>
          <a
            href="#contact"
            onClick={(e) => { e.preventDefault(); onNavClick('contact'); setMobileMenuOpen(false); }}
            className="block px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg"
          >
            Contactez-nous
          </a>
          {user ? (
            <Link to="/" className="block px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg text-center">
              Mon espace
            </Link>
          ) : (
            <Link to="/connexion" className="block px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg text-center">
              Connexion
            </Link>
          )}
        </div>
      )}
    </header>
  );
}


export default function Home() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resourcesData, setResourcesData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const { types, typeLabelMap } = useCategories();
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();
  const handleNavClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 72; // header height
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal-section').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [resourcesData]);

  // Fallback visibilité si IntersectionObserver ne se déclenche pas (iframe preview)
  useEffect(() => {
    const timeout = setTimeout(() => {
      document.querySelectorAll('.reveal-section').forEach((el) => {
        (el as HTMLElement).style.opacity = '1';
        el.classList.add('animate-fade-in-up');
      });
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('resources')
          .select('*')
          .order('created_at', { ascending: false }),
        8000
      );

      if (error) throw error;

      const supaResources: Resource[] = (data || []).map((r) => ({
        id: r.id,
        title: r.title,
        school_level: r.school_level,
        unit: r.unit,
        type: r.type,
        type_label: r.type_label,
        file_url: r.file_url || '',
        file_type: r.file_type || '',
        objectives: r.objectives,
        competencies: r.competencies,
        duration: r.duration,
        keywords: r.keywords || [],
        status: r.status || 'not_evaluated',
        status_label: r.status_label || 'Non évalué',
        author_id: r.author_id,
        created_at: r.created_at,
        views: r.views || 0,
        downloads: r.downloads || 0,
        comments_count: r.comments_count || 0,
      }));

      setResourcesData(supaResources);

      const authorIds = [...new Set(supaResources.map((r) => r.author_id).filter(Boolean))];
      if (authorIds.length > 0) {
        const profiles = await fetchProfilesMap(authorIds);
        setAuthorProfiles(profiles);
      }
    } catch {
      setResourcesData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources = useMemo(() => {
    let filtered = [...resourcesData];
    if (activeTab !== 'all') {
      filtered = filtered.filter((r) => r.type === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.keywords.some((k) => k.toLowerCase().includes(q)) ||
          r.unit.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeTab, searchQuery, resourcesData]);

  const getAuthor = (authorId: string) => getDisplayProfile(authorId, authorProfiles);

  const totalReviewed = resourcesData.filter((r) => r.status === 'peer_reviewed').length;

  // Build type filters dynamically from categories + include all resource types found in data
  const resourceTypeSlugs = useMemo(() => Array.from(new Set(resourcesData.map((r) => r.type))), [resourcesData]);

  const typeFilters = useMemo(() => {
    const base = [{ key: 'all', label: 'Tous' }];
    // Add known categories first
    types.forEach((t) => {
      base.push({ key: t.slug, label: t.name });
    });
    // Add any resource types from data that are not in categories
    resourceTypeSlugs.forEach((slug) => {
      if (!types.some((t) => t.slug === slug)) {
        base.push({ key: slug, label: typeLabelMap[slug] || slug });
      }
    });
    return base;
  }, [types, resourceTypeSlugs, typeLabelMap]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white dark:bg-slate-900">
      <PublicHeader onNavClick={handleNavClick} />

      <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section id="accueil" className="reveal-section opacity-0 pt-24 pb-16 bg-gradient-to-br from-sharek-50 via-white to-ocean-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sharek-100 text-sharek-700 text-sm font-medium mb-6">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-global-line text-xs"></i>
            </div>
            Plateforme collaborative pour les enseignants de SVT
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-900 dark:text-slate-50 mb-4 leading-tight">
            Partagez vos connaissances,
            <br />
            <span className="text-sharek-600">enrichissez l&apos;enseignement</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            ShareK est un espace collaboratif où les enseignants de Sciences de la Vie et de la Terre partagent,
            évaluent et améliorent ensemble les ressources pédagogiques.
          </p>

          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft">
              <div className="w-5 h-5 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <i className="ri-search-line"></i>
              </div>
              <input
                type="text"
                placeholder="Rechercher une ressource par titre, thème ou mot-clé..."
                className="flex-1 bg-transparent text-sm outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="w-5 h-5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
                >
                  <i className="ri-close-line"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="reveal-section opacity-0 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{resourcesData.length}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ressources partagées</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">142</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enseignants actifs</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{totalReviewed}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ressources validées</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">142</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Peer reviews réalisés</div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="reveal-section opacity-0 bg-white dark:bg-slate-900 py-16 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">À propos de ShareK</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Notre mission au service de l'enseignement des SVT</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-sharek-50 dark:bg-slate-800/50 flex items-center justify-center">
                <div className="w-6 h-6 flex items-center justify-center text-sharek-600">
                  <i className="ri-share-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Partager</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Mettez à disposition de la communauté vos cours, fiches, évaluations et activités pédagogiques.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-ocean-50 dark:bg-slate-800/50 flex items-center justify-center">
                <div className="w-6 h-6 flex items-center justify-center text-ocean-600">
                  <i className="ri-user-voice-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Évaluer</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Recevez des retours constructifs de vos pairs grâce au peer reviewing pour enrichir vos ressources.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-50 dark:bg-slate-800/50 flex items-center justify-center">
                <div className="w-6 h-6 flex items-center justify-center text-amber-600">
                  <i className="ri-award-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Valider</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Accédez à des contenus de qualité validés par la communauté et prêts à être utilisés en classe.
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link
              to="/a-propos"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sharek-600 hover:text-sharek-700 transition-colors"
            >
              Découvrir le projet en détail
              <i className="ri-arrow-right-line text-xs"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="reveal-section opacity-0 max-w-7xl mx-auto px-4 lg:px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ressources partagées</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Découvrez les cours, fiches, évaluations et activités de la communauté
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {typeFilters.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-sharek-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin"></i>
              </div>
              Chargement des ressources...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResources.map((resource) => {
            const author = getAuthor(resource.author_id);
            const typeInfo = getTypeConfig(resource.type, resource.type_label);
            const statusInfo = statusConfig[resource.status] || statusConfig.not_evaluated;
            return (
              <div
                key={resource.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sharek-300 transition-colors overflow-hidden group"
              >
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className={`${typeInfo.icon} text-xl`}></i>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{typeInfo.label}</span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-start gap-2 mb-3">
                    <ResourceTypeBadge type={resource.type} label={resource.type_label} className="rounded-md" />
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text} dark:bg-slate-800 dark:text-slate-200`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                      <span className="hidden sm:inline">{statusInfo.label}</span>
                    </span>
                  </div>

                  <Link to={`/ressources/${resource.id}`} className="block">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 line-clamp-2 hover:text-sharek-600 transition-colors">
                      {resource.title}
                    </h3>
                  </Link>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{resource.objectives}</p>

                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-building-line"></i>
                      </div>
                      {resource.school_level}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-time-line"></i>
                      </div>
                      {resource.duration}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      to={`/enseignant/${resource.author_id}`}
                      className="flex items-center gap-2 group/author"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: author?.color || '#0d9488' }}
                      >
                        {author?.initials || '??'}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-300 group-hover/author:text-sharek-600 transition-colors">
                        {author?.name || 'Inconnu'}
                      </span>
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-eye-line"></i>
                        </div>
                        {resource.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-download-line"></i>
                        </div>
                        {resource.downloads}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}

        {!loading && filteredResources.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
              <div className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <i className="ri-search-line text-xl"></i>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400">Aucune ressource ne correspond à votre recherche</p>
          </div>
        )}
      </section>

      {/* Teachers */}
      <section className="reveal-section opacity-0 bg-slate-50 dark:bg-slate-800/50 py-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Enseignants actifs</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Les contributeurs qui enrichissent la plateforme</p>
          </div>

          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <i className="ri-team-line text-xl"></i>
            </div>
            <p className="text-sm">Connectez-vous pour voir les enseignants actifs.</p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="reveal-section opacity-0 bg-white dark:bg-slate-900 py-16 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Contactez-nous</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xl mx-auto">
            Une question, une suggestion ou envie de rejoindre l'aventure ? N'hésitez pas à nous écrire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-slate-600 dark:text-slate-300 mb-6">
            <a href="mailto:contact@sharek.ma" className="flex items-center gap-2 hover:text-sharek-600 transition-colors">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-mail-line"></i>
              </div>
              contact@sharek.ma
            </a>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-map-pin-line"></i>
              </div>
              Maroc
            </span>
          </div>
          <Link
            to="/contactez-nous"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sharek-600 hover:text-sharek-700 transition-colors"
          >
            Accéder au formulaire complet
            <i className="ri-arrow-right-line text-xs"></i>
          </Link>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  );
}
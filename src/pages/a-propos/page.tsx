import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/layout/Footer';

const steps = [
  {
    icon: 'ri-upload-cloud-line',
    title: 'Partager',
    desc: 'Les enseignants uploagent leurs ressources pédagogiques - cours, fiches, évaluations, activités pratiques et simulations.',
    color: 'bg-sharek-50 text-sharek-600',
  },
  {
    icon: 'ri-user-voice-line',
    title: 'Évaluer par les pairs',
    desc: 'Des reviewers experts analysent chaque ressource selon des critères scientifiques et pédagogiques rigoureux.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: 'ri-award-line',
    title: 'Valider',
    desc: 'Les ressources validées reçoivent le label « Peer Reviewed » et deviennent des références fiables pour la communauté.',
    color: 'bg-emerald-50 text-emerald-600',
  },
];

const features = [
  {
    icon: 'ri-book-open-line',
    title: 'Ressources pédagogiques variées',
    desc: 'Cours, fiches, évaluations, activités pratiques et simulations pour tous les niveaux du secondaire marocain.',
  },
  {
    icon: 'ri-shield-check-line',
    title: 'Validation scientifique rigoureuse',
    desc: 'Chaque ressource est évaluée par des pairs selon des standards académiques avant publication définitive.',
  },
  {
    icon: 'ri-team-line',
    title: 'Communauté collaborative',
    desc: 'Un espace où enseignants, chercheurs et formateurs échangent et co-construisent des contenus de qualité.',
  },
  {
    icon: 'ri-bar-chart-box-line',
    title: 'Suivi et amélioration continue',
    desc: 'Versioning des documents, retours constructifs et itérations pour une qualité toujours croissante.',
  },
];

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Public Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <Link to="/accueil" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sharek-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">SK</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 text-base leading-tight">ShareK</span>
              <span className="text-xs text-slate-400 leading-tight">شارك</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/accueil" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">Accueil</Link>
            <Link to="/a-propos" className="px-3 py-2 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg transition-colors">À propos</Link>
            <Link to="/contactez-nous" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">Contactez-nous</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/connexion" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap">
              <i className="ri-login-box-line"></i>
              Connexion
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}></i>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-3 space-y-1">
            <Link to="/accueil" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Accueil</Link>
            <Link to="/a-propos" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg">À propos</Link>
            <Link to="/contactez-nous" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Contactez-nous</Link>
            <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg text-center">Connexion</Link>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-br from-sharek-50 via-white to-ocean-50">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sharek-100 text-sharek-700 text-sm font-medium mb-6">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-flask-line text-xs"></i>
            </div>
            Projet de recherche scientifique
          </div>
          <h1 className="animate-fade-in-up delay-100 text-2xl sm:text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            ShareK : une plateforme au croisement
            <br />
            <span className="text-sharek-600">des sciences de l&apos;information</span>
          </h1>
          <p className="animate-fade-in-up delay-200 text-base sm:text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed">
            Conçu dans le cadre d&apos;une recherche en Sciences de l&apos;Information et de la Communication (SIC),
            ShareK explore comment les communautés d&apos;enseignants peuvent co-produire,
            évaluer et valider des ressources pédagogiques par une approche communautaire.
          </p>
        </div>
      </section>

      {/* Cadre de recherche */}
      <section className="py-16 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-in-left">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">Cadre de recherche</h2>
              <p className="text-slate-500 leading-relaxed mb-4">
                ShareK est développé dans le cadre d&apos;une <strong className="text-slate-700">recherche scientifique</strong> en Sciences
                de l&apos;Information et de la Communication (SIC), discipline qui étudie la production,
                la circulation et la valorisation des contenus dans les communautés de pratique.
              </p>
              <p className="text-slate-500 leading-relaxed mb-4">
                L&apos;objectif est de comprendre comment les enseignants de Sciences de la Vie et de la Terre (SVT)
                au Maroc peuvent s&apos;organiser en <strong className="text-slate-700">communauté d&apos;évaluation</strong> pour produire
                des ressources pédagogiques fiables, validées et partagées.
              </p>
              <p className="text-slate-500 leading-relaxed">
                Cette démarche s&apos;inscrit dans la continuité des travaux sur les
                <strong className="text-slate-700"> REL (Ressources Éducatives Libres)</strong> et les dynamiques collaboratives
                dans l&apos;enseignement secondaire.
              </p>
            </div>
            <div className="animate-slide-in-right">
              <img
                src="https://readdy.ai/api/search-image?query=Abstract minimalist illustration of knowledge sharing and collaborative research, soft pastel green and teal tones, scientific community network visualization, clean modern educational design with subtle Moroccan geometric patterns in the background, academic and professional atmosphere, no text, no letters"
                alt="Cadre de recherche ShareK"
                className="w-full h-80 object-cover rounded-2xl"
                width="560"
                height="320"
              />
            </div>
          </div>
        </div>
      </section>

      {/* REL & SIC */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 animate-slide-in-left">
              <img
                src="https://readdy.ai/api/search-image?query=Minimalist illustration of open educational resources and digital library, soft warm earth tones and sage green colors, floating books and documents connected by subtle lines, clean modern design representing knowledge sharing, no text, no letters, abstract and artistic style"
                alt="Ressources éducatives libres"
                className="w-full h-80 object-cover rounded-2xl"
                width="560"
                height="320"
              />
            </div>
            <div className="order-1 lg:order-2 animate-slide-in-right">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">REL et Sciences de l&apos;Information</h2>
              <p className="text-slate-500 leading-relaxed mb-4">
                Les <strong className="text-slate-700">Ressources Éducatives Libres (REL)</strong> sont au cœur du projet ShareK.
                Il ne s&apos;agit pas seulement de mettre des documents en ligne, mais de construire un
                <strong className="text-slate-700"> écosystème informationnel</strong> où chaque ressource est contextualisée,
                évaluée et améliorée par la communauté.
              </p>
              <p className="text-slate-500 leading-relaxed mb-4">
                Les Sciences de l&apos;Information et de la Communication permettent d&apos;analyser ce phénomène sous l&apos;angle
                de la <strong className="text-slate-700">médiation documentaire</strong>, de la
                <strong className="text-slate-700"> communication organisationnelle</strong> et des
                <strong className="text-slate-700"> communautés de pratique</strong>.
              </p>
              <p className="text-slate-500 leading-relaxed">
                ShareK devient ainsi un <strong className="text-slate-700">terrain d&apos;observation</strong> pour étudier comment
                les enseignants deviennent producteurs, curateurs et validateurs de savoirs pédagogiques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PCI */}
      <section className="py-16 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">Approche PCI - Peer Community In</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              ShareK reprend le modèle innovant de la « Peer Community In » (PCI) pour adapter
              la revue par les pairs à l&apos;évaluation des ressources éducatives.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in-up delay-100">
              <div className="w-12 h-12 rounded-xl bg-sharek-50 flex items-center justify-center mb-4">
                <div className="w-6 h-6 flex items-center justify-center text-sharek-600">
                  <i className="ri-upload-cloud-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">1. Soumission</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                L&apos;enseignant dépose sa ressource avec ses métadonnées pédagogiques :
                niveau scolaire, unité, objectifs, compétences visées et durée.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in-up delay-200">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                <div className="w-6 h-6 flex items-center justify-center text-amber-600">
                  <i className="ri-user-voice-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">2. Évaluation par les pairs</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Des reviewers membres de la communauté analysent la ressource selon des critères
                scientifiques et didactiques. Ils déposent des commentaires constructifs.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in-up delay-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <div className="w-6 h-6 flex items-center justify-center text-emerald-600">
                  <i className="ri-award-line text-lg"></i>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">3. Recommandation</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Si la ressource répond aux critères, elle reçoit le label « Peer Reviewed ».
                Sinon, l&apos;auteur peut la réviser et la soumettre à nouveau.
              </p>
            </div>
          </div>

          <div className="mt-10 bg-sharek-50 rounded-xl p-6 animate-fade-in-up delay-400">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-sharek-100 flex items-center justify-center flex-shrink-0">
                <div className="w-5 h-5 flex items-center justify-center text-sharek-600">
                  <i className="ri-lightbulb-line"></i>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Pourquoi PCI ?</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Le modèle PCI, initialement développé pour les publications scientifiques, offre une alternative
                  ouverte et transparente aux revues traditionnelles. En l&apos;adaptant à l&apos;éducation,
                  ShareK crée un mécanisme de <strong>confiance collective</strong> où la qualité émerge
                  du dialogue entre pairs, sans barrière commerciale ni éditoriale fermée.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800">Ce que ShareK propose</h2>
            <p className="text-slate-500 mt-2">Une suite d&apos;outils pensés pour la communauté enseignante</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`bg-white rounded-xl border border-slate-200 p-5 animate-fade-in-up delay-${(i + 1) * 100}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sharek-50 flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 flex items-center justify-center text-sharek-600">
                      <i className={`${f.icon}`}></i>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-1">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-sharek-50 via-white to-ocean-50">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 text-center animate-fade-in-up">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">Rejoignez l&apos;aventure ShareK</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Que vous soyez enseignant, chercheur ou passionné par l&apos;éducation, votre contribution
            fait la différence. Partagez, évaluez et construisons ensemble l&apos;avenir de l&apos;enseignement des SVT au Maroc.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/inscription"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-user-add-line"></i>
              Créer un compte
            </Link>
            <Link
              to="/contactez-nous"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-mail-line"></i>
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  );
}
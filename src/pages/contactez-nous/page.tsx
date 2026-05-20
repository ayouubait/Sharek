import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/layout/Footer';

export default function ContactPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = form.name.trim() && form.email.trim() && form.subject && form.message.trim();

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
            <Link to="/a-propos" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">À propos</Link>
            <Link to="/contactez-nous" className="px-3 py-2 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg transition-colors">Contactez-nous</Link>
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
            <Link to="/a-propos" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">À propos</Link>
            <Link to="/contactez-nous" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-sharek-700 bg-sharek-50 rounded-lg">Contactez-nous</Link>
            <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg text-center">Connexion</Link>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="pt-28 pb-12 bg-gradient-to-br from-sharek-50 via-white to-ocean-50">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sharek-100 text-sharek-700 text-sm font-medium mb-6">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-mail-line text-xs"></i>
            </div>
            Restons en contact
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            Contactez-nous
          </h1>
          <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Une question sur la plateforme ? Un retour d&apos;expérience ?
            Une envie de collaborer à la recherche ? Écrivez-nous, nous vous répondons dans les plus brefs délais.
          </p>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Form */}
            <div className="lg:col-span-3 animate-slide-in-left">
              <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8">
                <h2 className="text-lg font-bold text-slate-800 mb-1">Envoyer un message</h2>
                <p className="text-sm text-slate-500 mb-6">Remplissez le formulaire ci-dessous et nous vous répondrons rapidement.</p>

                {submitted ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                      <div className="w-7 h-7 flex items-center justify-center text-emerald-600">
                        <i className="ri-check-line text-xl"></i>
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-800 mb-1">Message envoyé !</h3>
                    <p className="text-sm text-slate-500">Merci de nous avoir contactés. Nous vous répondrons sous 48 heures.</p>
                  </div>
                ) : (
                  <form
                    id="contact-form"
                    action="https://readdy.ai/api/form/d85jldmp8k35tp9sb1dg"
                    method="POST"
                    data-readdy-form
                    className="space-y-5"
                    onSubmit={() => setSubmitted(true)}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet</label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Votre nom"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-500 transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="vous@exemple.ma"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-500 transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Sujet</label>
                      <select
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-500 transition-colors appearance-none"
                        required
                      >
                        <option value="">Choisir un sujet</option>
                        <option value="support">Support technique</option>
                        <option value="contribution">Proposer une contribution</option>
                        <option value="partnership">Partenariat / Recherche</option>
                        <option value="feedback">Retour d&apos;expérience</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                      <textarea
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Décrivez votre demande en détail..."
                        rows={5}
                        maxLength={500}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-500 transition-colors resize-none"
                        required
                      />
                      <p className="text-xs text-slate-400 mt-1 text-right">{form.message.length}/500</p>
                    </div>

                    <button
                      type="submit"
                      disabled={!isFormValid}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sharek-600 rounded-lg hover:bg-sharek-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      <i className="ri-send-plane-line"></i>
                      Envoyer le message
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Info cards */}
            <div className="lg:col-span-2 space-y-5 animate-slide-in-right">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sharek-50 flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 flex items-center justify-center text-sharek-600">
                      <i className="ri-mail-line"></i>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1">Email</h3>
                    <a href="mailto:contact@sharek.ma" className="text-sm text-slate-500 hover:text-sharek-600 transition-colors">
                      contact@sharek.ma
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-ocean-50 flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 flex items-center justify-center text-ocean-600">
                      <i className="ri-map-pin-line"></i>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1">Localisation</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Projet de recherche mené au Maroc
                      <br />
                      <span className="text-xs text-slate-400">Enseignement secondaire - Sciences de la Vie et de la Terre</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 flex items-center justify-center text-amber-600">
                      <i className="ri-time-line"></i>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1">Délai de réponse</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Nous répondons généralement sous 24 à 48 heures ouvrables.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sharek-50 to-white rounded-xl border border-sharek-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sharek-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 flex items-center justify-center text-sharek-600">
                      <i className="ri-flask-line"></i>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1">Recherche</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mb-3">
                      Vous êtes chercheur en SIC ou en sciences de l&apos;éducation et souhaitez collaborer ?
                    </p>
                    <Link
                      to="/a-propos"
                      className="inline-flex items-center gap-1 text-sm font-medium text-sharek-600 hover:text-sharek-700 transition-colors"
                    >
                      Découvrir le projet
                      <i className="ri-arrow-right-line text-xs"></i>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="py-12 border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 animate-fade-in-up">Nous trouver</h2>
          <div className="rounded-xl overflow-hidden border border-slate-200 animate-fade-in-up delay-100">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6757743.024555518!2d-13.2035227421875!3d31.791702!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd0b88619651baaf%3A0x547a5f2e206251c!2sMaroc!5e0!3m2!1sfr!2sma!4v1700000000000!5m2!1sfr!2sma"
              width="100%"
              height="360"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localisation du projet ShareK au Maroc"
            ></iframe>
          </div>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  );
}
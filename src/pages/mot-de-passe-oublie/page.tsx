import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Footer from '@/components/layout/Footer';

const getRedirectUrl = () => {
  const base = typeof __BASE_PATH__ !== 'undefined' ? __BASE_PATH__ : '';
  const prefix = base ? `/${base.split('/').filter(Boolean).join('/')}` : '';
  return `${window.location.origin}${prefix}/reinitialiser-mot-de-passe`;
};

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl(),
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-sharek-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">SK</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Mot de passe oublié</h1>
            <p className="text-sm text-slate-500 mt-1">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-error-warning-line"></i>
                </div>
                {error}
              </div>
            )}

            {sent && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-mail-send-line"></i>
                </div>
                <div>
                  <p className="font-medium">Email envoyé !</p>
                  <p className="mt-0.5">
                    Si ce compte existe, vous recevrez un lien pour réinitialiser votre mot de passe.
                    Vérifiez votre boîte de réception et vos spams.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                    <i className="ri-mail-line text-sm"></i>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@ecole.ma"
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sharek-200 focus:border-sharek-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || sent}
                className="w-full px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Envoi...
                  </>
                ) : sent ? (
                  <>
                    <i className="ri-check-line"></i>
                    Email envoyé
                  </>
                ) : (
                  'Envoyer le lien'
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                <Link to="/connexion" className="font-medium text-sharek-600 hover:text-sharek-700">
                  Retour à la connexion
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
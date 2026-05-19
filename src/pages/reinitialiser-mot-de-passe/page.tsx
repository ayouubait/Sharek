import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Footer from '@/components/layout/Footer';

export default function ReinitialiserMotDePasse() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validHash, setValidHash] = useState(true);
  const navigate = useNavigate();

  // Supabase sends recovery tokens in the URL hash — check we have one
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
      // No token in URL — might be invalid or expired
      setValidHash(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/connexion'), 3000);
    }
  };

  if (!validHash && !success) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <div className="w-7 h-7 flex items-center justify-center text-red-600">
                <i className="ri-error-warning-line text-2xl"></i>
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Lien invalide ou expiré</h1>
            <p className="text-sm text-slate-500 mb-6">
              Le lien de réinitialisation n&apos;est pas valide ou a expiré. Veuillez demander un nouveau lien.
            </p>
            <Link
              to="/mot-de-passe-oublie"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <i className="ri-mail-send-line"></i>
              Demander un nouveau lien
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-sharek-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">SK</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Réinitialiser le mot de passe</h1>
            <p className="text-sm text-slate-500 mt-1">Choisissez un nouveau mot de passe sécurisé</p>
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

            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-check-line"></i>
                </div>
                <div>
                  <p className="font-medium">Mot de passe mis à jour !</p>
                  <p className="mt-0.5">
                    Vous allez être redirigé vers la page de connexion dans quelques secondes...
                  </p>
                  <Link
                    to="/connexion"
                    className="inline-block mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    Aller à la connexion
                  </Link>
                </div>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                      <i className="ri-lock-line text-sm"></i>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sharek-200 focus:border-sharek-300"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Minimum 6 caractères</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                      <i className="ri-lock-password-line text-sm"></i>
                    </div>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sharek-200 focus:border-sharek-300"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      Mise à jour...
                    </>
                  ) : (
                    'Mettre à jour le mot de passe'
                  )}
                </button>
              </form>
            )}

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
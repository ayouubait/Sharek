import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/layout/Footer';
import logoUrl from '@/assets/logo.webp';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsConfirmation(false);
    setResendSuccess(false);
    setLoading(true);
    setRetryCount((c) => c + 1);
    const result = await login(email, password);
    setLoading(false);
    if (result.error) {
      // Detect email not confirmed
      if (
        result.error.toLowerCase().includes('email not confirmed') ||
        result.error.toLowerCase().includes('not confirmed') ||
        result.error.toLowerCase().includes('email_not_confirmed')
      ) {
        setNeedsConfirmation(true);
        setError('Votre email n\'est pas encore confirmé. Vérifiez votre boîte de réception ou renvoyez le lien de confirmation.');
      } else {
        setError(result.error);
      }
    } else {
      // Admin redirigé vers /admin, les autres vers l'accueil
      if (result.user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendingEmail(true);
    setResendSuccess(false);
    setError('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setResendingEmail(false);
    if (error) {
      setError(`Erreur lors de l'envoi : ${error.message}`);
    } else {
      setResendSuccess(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={logoUrl} alt="ShareK" className="h-20 w-auto object-contain mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800">Bienvenue sur ShareK</h1>
            <p className="text-sm text-slate-500 mt-1">Connectez-vous à votre compte enseignant</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            {error && (
              <div className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${
                needsConfirmation
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={needsConfirmation ? 'ri-mail-send-line' : 'ri-error-warning-line'}></i>
                </div>
                <div className="flex-1">
                  <p>{error}</p>
                  {needsConfirmation && (
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resendingEmail}
                      className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 underline disabled:opacity-50"
                    >
                      {resendingEmail ? 'Envoi en cours...' : 'Renvoyer l\'email de confirmation'}
                    </button>
                  )}
                  {!needsConfirmation && (
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="mt-2 text-xs font-semibold text-red-700 hover:text-red-800 underline disabled:opacity-50"
                    >
                      {loading ? 'Tentative en cours...' : 'Réessayer'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {resendSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-check-line"></i>
                </div>
                Email de confirmation renvoyé ! Vérifiez votre boîte de réception.
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
                  <Link to="/mot-de-passe-oublie" className="text-xs text-sharek-600 hover:text-sharek-700 font-medium">
                    Mot de passe oublié ?
                  </Link>
                </div>
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
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sharek-200 focus:border-sharek-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-sharek-600 hover:bg-sharek-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Pas encore de compte ?{' '}
                <Link to="/inscription" className="font-medium text-sharek-600 hover:text-sharek-700">
                  S&apos;inscrire
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
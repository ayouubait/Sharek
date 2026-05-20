import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/layout/Footer';
import logoUrl from '@/assets/logo.webp';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await signup(email, password, name);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      if (!result.needsEmailConfirmation) {
        // Auto-confirmed - redirect after a short delay
        setTimeout(() => navigate('/'), 1500);
      }
      // If email confirmation needed, stay on success screen with message
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <img src={logoUrl} alt="ShareK" className="h-20 w-auto object-contain mx-auto mb-4" />
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-sharek-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-2xl text-sharek-600"></i>
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Compte créé avec succès !</h2>
              <p className="text-sm text-slate-500">
                Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.
              </p>
              <button
                onClick={() => navigate('/connexion')}
                className="mt-5 px-4 py-2 bg-sharek-600 text-white rounded-lg text-sm font-medium hover:bg-sharek-700 transition-colors"
              >
                Aller à la connexion
              </button>
            </div>
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
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={logoUrl} alt="ShareK" className="h-20 w-auto object-contain mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800">Rejoindre ShareK</h1>
            <p className="text-sm text-slate-500 mt-1">Créez votre compte enseignant</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-error-warning-line"></i>
                </div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                    <i className="ri-user-line text-sm"></i>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fatima Zahra Alaoui"
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sharek-200 focus:border-sharek-300"
                  />
                </div>
              </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
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
                <p className="text-xs text-slate-400 mt-1">Minimum 6 caractères</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmer le mot de passe</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                    <i className="ri-lock-line text-sm"></i>
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Création...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Déjà un compte ?{' '}
                <Link to="/connexion" className="font-medium text-sharek-600 hover:text-sharek-700">
                  Se connecter
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
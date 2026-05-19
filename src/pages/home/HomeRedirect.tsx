import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-sharek-600 text-2xl"></i>
        </div>
      </div>
    );
  }

  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/ressources" replace />;
  }

  return <Navigate to="/connexion" replace />;
}

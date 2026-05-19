import { useLocation, Link } from "react-router-dom";
import Footer from '@/components/layout/Footer';

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 relative flex flex-col items-center justify-center text-center px-4">
        <h1 className="absolute bottom-0 text-9xl md:text-[12rem] font-black text-slate-100 select-none pointer-events-none z-0">
          404
        </h1>
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-6">
            <i className="ri-error-warning-line text-3xl"></i>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Page introuvable</h1>
          <p className="mt-2 text-base text-slate-400 font-mono">{location.pathname}</p>
          <p className="mt-4 text-lg md:text-xl text-slate-500 max-w-md mx-auto">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 bg-sharek-600 hover:bg-sharek-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <i className="ri-home-line"></i>
            Retour à l&apos;application
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
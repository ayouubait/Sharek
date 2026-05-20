import { Navigate, type RouteObject } from "react-router-dom";
import { lazy, Suspense } from "react";
import TeacherOnlyRoute from "@/components/TeacherOnlyRoute";
import SharedAuthRoute from "@/components/SharedAuthRoute";
import AdminRoute from "@/components/AdminRoute";
import PublicOnlyRoute from "@/components/PublicOnlyRoute";
import NotFound from "@/pages/NotFound";

const Dashboard = lazy(() => import("@/pages/dashboard/page"));
const HomeRedirect = lazy(() => import("@/pages/home/HomeRedirect"));
const EnseignantProfil = lazy(() => import("@/pages/enseignant/page"));
const ResourcesList = lazy(() => import("@/pages/ressources/page"));
const ResourceAdd = lazy(() => import("@/pages/ressources-ajouter/page"));
const ResourceDetail = lazy(() => import("@/pages/ressource-detail/page"));
const ResourceEdit = lazy(() => import("@/pages/ressource-modifier/page"));
const ResourceAnalytics = lazy(() => import("@/pages/ressource-analytics/page"));
const PeerReview = lazy(() => import("@/pages/peer-review/page"));
const Commentaires = lazy(() => import("@/pages/commentaires/page"));
const Profil = lazy(() => import("@/pages/profil/page"));
const Parametres = lazy(() => import("@/pages/parametres/page"));
const LoginPage = lazy(() => import("@/pages/login/page"));
const SignupPage = lazy(() => import("@/pages/signup/page"));
const MesRessources = lazy(() => import("@/pages/mes-ressources/page"));
const MesFavoris = lazy(() => import("@/pages/mes-favoris/page"));
const MessagesPage = lazy(() => import("@/pages/messages/page"));
const AdminPage = lazy(() => import("@/pages/admin/page"));
const MotDePasseOublie = lazy(() => import("@/pages/mot-de-passe-oublie/page"));
const ReinitialiserMotDePasse = lazy(() => import("@/pages/reinitialiser-mot-de-passe/page"));
const ParametresAdminPage = lazy(() => import("@/pages/parametres-admin/page"));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <i className="ri-loader-4-line animate-spin text-2xl"></i>
        <span className="text-sm">Chargement…</span>
      </div>
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: withSuspense(<HomeRedirect />),
  },
  {
    path: "/accueil",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/a-propos",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/contactez-nous",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/dashboard",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<Dashboard />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        {withSuspense(<AdminPage />)}
      </AdminRoute>
    ),
  },
  {
    path: "/admin/parametres",
    element: (
      <AdminRoute>
        {withSuspense(<ParametresAdminPage />)}
      </AdminRoute>
    ),
  },
  {
    path: "/enseignant/:id",
    element: withSuspense(<EnseignantProfil />),
  },
  {
    path: "/ressources",
    element: withSuspense(<ResourcesList />),
  },
  {
    path: "/ressources/ajouter",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<ResourceAdd />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/ressources/modifier/:id",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<ResourceEdit />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/ressources/:id",
    element: withSuspense(<ResourceDetail />),
  },
  {
    path: "/ressources/:id/analytics",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<ResourceAnalytics />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/mes-ressources",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<MesRessources />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/mes-favoris",
    element: (
      <SharedAuthRoute>
        {withSuspense(<MesFavoris />)}
      </SharedAuthRoute>
    ),
  },
  {
    path: "/peer-review",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<PeerReview />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/commentaires",
    element: (
      <TeacherOnlyRoute>
        {withSuspense(<Commentaires />)}
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/messages",
    element: (
      <SharedAuthRoute>
        {withSuspense(<MessagesPage />)}
      </SharedAuthRoute>
    ),
  },
  {
    path: "/messages/:userId",
    element: (
      <SharedAuthRoute>
        {withSuspense(<MessagesPage />)}
      </SharedAuthRoute>
    ),
  },
  {
    path: "/profil",
    element: (
      <SharedAuthRoute>
        {withSuspense(<Profil />)}
      </SharedAuthRoute>
    ),
  },
  {
    path: "/parametres",
    element: (
      <SharedAuthRoute>
        {withSuspense(<Parametres />)}
      </SharedAuthRoute>
    ),
  },
  {
    path: "/connexion",
    element: (
      <PublicOnlyRoute>
        {withSuspense(<LoginPage />)}
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/inscription",
    element: (
      <PublicOnlyRoute>
        {withSuspense(<SignupPage />)}
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/mot-de-passe-oublie",
    element: withSuspense(<MotDePasseOublie />),
  },
  {
    path: "/reinitialiser-mot-de-passe",
    element: withSuspense(<ReinitialiserMotDePasse />),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;

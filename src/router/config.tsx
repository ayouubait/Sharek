import { Navigate, type RouteObject } from "react-router-dom";
import TeacherOnlyRoute from "@/components/TeacherOnlyRoute";
import SharedAuthRoute from "@/components/SharedAuthRoute";
import AdminRoute from "@/components/AdminRoute";
import PublicOnlyRoute from "@/components/PublicOnlyRoute";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/dashboard/page";
import HomeRedirect from "@/pages/home/HomeRedirect";
import EnseignantProfil from "@/pages/enseignant/page";
import ResourcesList from "@/pages/ressources/page";
import ResourceAdd from "@/pages/ressources-ajouter/page";
import ResourceDetail from "@/pages/ressource-detail/page";
import ResourceEdit from "@/pages/ressource-modifier/page";
import ResourceAnalytics from "@/pages/ressource-analytics/page";
import PeerReview from "@/pages/peer-review/page";
import Commentaires from "@/pages/commentaires/page";
import Profil from "@/pages/profil/page";
import Parametres from "@/pages/parametres/page";
import LoginPage from "@/pages/login/page";
import SignupPage from "@/pages/signup/page";
import MesRessources from "@/pages/mes-ressources/page";
import MesFavoris from "@/pages/mes-favoris/page";
import MessagesPage from "@/pages/messages/page";
import AdminPage from "@/pages/admin/page";
import MotDePasseOublie from "@/pages/mot-de-passe-oublie/page";
import ReinitialiserMotDePasse from "@/pages/reinitialiser-mot-de-passe/page";
import ParametresAdminPage from "@/pages/parametres-admin/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <HomeRedirect />,
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
        <Dashboard />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminPage />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/parametres",
    element: (
      <AdminRoute>
        <ParametresAdminPage />
      </AdminRoute>
    ),
  },
  {
    path: "/enseignant/:id",
    element: <EnseignantProfil />,
  },
  {
    path: "/ressources",
    element: <ResourcesList />,
  },
  {
    path: "/ressources/ajouter",
    element: (
      <TeacherOnlyRoute>
        <ResourceAdd />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/ressources/modifier/:id",
    element: (
      <TeacherOnlyRoute>
        <ResourceEdit />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/ressources/:id",
    element: <ResourceDetail />,
  },
  {
    path: "/ressources/:id/analytics",
    element: (
      <TeacherOnlyRoute>
        <ResourceAnalytics />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/mes-ressources",
    element: (
      <TeacherOnlyRoute>
        <MesRessources />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/mes-favoris",
    element: (
      <SharedAuthRoute>
        <MesFavoris />
      </SharedAuthRoute>
    ),
  },
  {
    path: "/peer-review",
    element: (
      <TeacherOnlyRoute>
        <PeerReview />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/commentaires",
    element: (
      <TeacherOnlyRoute>
        <Commentaires />
      </TeacherOnlyRoute>
    ),
  },
  {
    path: "/messages",
    element: (
      <SharedAuthRoute>
        <MessagesPage />
      </SharedAuthRoute>
    ),
  },
  {
    path: "/messages/:userId",
    element: (
      <SharedAuthRoute>
        <MessagesPage />
      </SharedAuthRoute>
    ),
  },
  {
    path: "/profil",
    element: (
      <SharedAuthRoute>
        <Profil />
      </SharedAuthRoute>
    ),
  },
  {
    path: "/parametres",
    element: (
      <SharedAuthRoute>
        <Parametres />
      </SharedAuthRoute>
    ),
  },
  {
    path: "/connexion",
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/inscription",
    element: (
      <PublicOnlyRoute>
        <SignupPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/mot-de-passe-oublie",
    element: <MotDePasseOublie />,
  },
  {
    path: "/reinitialiser-mot-de-passe",
    element: <ReinitialiserMotDePasse />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
# ShareK / شارك — Plateforme collaborative pour enseignants SVT

## 1. Project Description
**ShareK** (de l'arabe شارك, "participer / partager") est une plateforme collaborative destinée aux enseignants de Sciences de la Vie et de la Terre (SVT) au Maroc. Elle permet le partage, l'évaluation par les pairs (peer reviewing) et l'amélioration des ressources éducatives ouvertes (cours PDF, fiches, évaluations, activités pratiques, simulations, diaporamas).

**Public cible** : Enseignants de SVT au Maroc (collège et lycée)
**Valeur centrale** : Valoriser la collaboration entre pairs, garantir la qualité des ressources via un processus d'évaluation structuré, et centraliser l'accès aux ressources pédagogiques.

## 2. Page Structure
- `/` — Tableau de bord (Dashboard)
- `/ressources` — Liste des ressources
- `/ressources/:id` — Détail d'une ressource (lecteur PDF + commentaires + peer review)
- `/ressources/ajouter` — Formulaire d'ajout d'une ressource
- `/mes-ressources` — Gestion des ressources de l'utilisateur connecté (stats, suppression, filtres)
- `/peer-review` — Espace peer reviewing (gestion des revues)
- `/commentaires` — Commentaires reçus / envoyés
- `/profil` — Profil enseignant
- `/parametres` — Paramètres du compte
- `/a-propos` — Page publique "À propos"
- `/contactez-nous` — Formulaire de contact
- `/messages` — Messagerie entre enseignants
- `/admin` — Dashboard administrateur (stats, utilisateurs, ressources, reviews, commentaires)
- `/admin/parametres` — Paramètres de la plateforme (catégories et paramètres globaux)
- `/enseignant/:id` — Profil public d'un enseignant
- `/ressource-analytics` — Analytics par ressource
- `/connexion` — Login
- `/inscription` — Signup
- `/mot-de-passe-oublie` — Mot de passe oublié
- `/reinitialiser-mot-de-passe` — Réinitialisation mot de passe

## 3. Core Features
- [x] Layout principal (sidebar + topbar + zone centrale)
- [x] Tableau de bord avec statistiques et activité récente
- [x] Liste des ressources avec filtres et recherche (page publique + interne)
- [x] Upload de ressource (formulaire complet + Supabase Storage)
- [x] Lecteur de documents (PDF avec react-pdf + lecteur simulé pour mocks)
- [x] Système de commentaires par type (pédagogique, scientifique, technique, général)
- [x] Panneau de peer review (volontaires, statuts, progression)
- [x] Tracker visuel de progression du peer review
- [x] Section fichier de recommandation
- [x] Profil enseignant avec score de contribution
- [x] Système de rôles (Enseignant, Reviewer, Admin)
- [x] Badge de statut visible sur chaque ressource
- [x] Upload de fichiers PDF via Supabase Storage
- [x] Page "Mes ressources" — gestion des ressources de l'utilisateur (stats, suppression, filtres)
- [x] Système d'authentification (login, signup, mot de passe oublié, réinitialisation)
- [x] Routes protégées selon les rôles (AdminRoute, TeacherOnlyRoute, etc.)
- [x] Dark mode (toggle dans les paramètres + ThemeContext)
- [x] Notifications en temps réel (useRealtimeNotifications)
- [x] Messagerie entre utilisateurs
- [x] Dashboard administrateur complet (stats, users, ressources, pending reviews, comments, activity timeline, growth chart, engagement cards, top performers)
- [x] Page publique "À propos"
- [x] Formulaire de contact
- [x] Profil public enseignant (`/enseignant/:id`)
- [x] Analytics par ressource
- [x] Internationalisation (i18n fr/en)
- [x] Mention system dans les commentaires (@utilisateur)
- [x] Gestion des versions de ressource
- [x] Système de likes sur les commentaires
- [x] Assignation / désassignation / modification inline des reviewers

## 4. Data Model Design
*(Connecté à Supabase — voir tables existantes)*

### Tables Supabase actives
- **profiles** : id, name, email, avatar_url, institution, city, specialty, level, bio, role, color, initials, contribution_score, reviews_count, resources_count, theme, language, notifications_email, notifications_push, notify_new_comment, notify_new_review, notify_recommendation
- **resources** : id, title, school_level, unit, type, type_label, file_url, file_type, objectives, competencies, duration, keywords, status, status_label, author_id, created_at, views, downloads, comments_count
- **comments** : id, resource_id, author_id, type, type_label, content, created_at, likes_count
- **peer_reviews** : id, resource_id, reviewer_id, status, status_label, joined_at, recommendation_submitted
- **recommendations** : id, resource_id, reviewer_id, file_name, submitted_at, status, status_label, observations, strengths, weaknesses, suggestions, decision
- **notifications** : id, type, message, time, read, resource_id, created_at, user_id
- **comment_likes** : id, comment_id, user_id
- **messages** : id, sender_id, receiver_id, content, created_at, read
- **resource_versions** : id, resource_id, version_number, changes, file_url, created_at

### Nouvelles tables (Paramètres admin)
- **categories** : id, name, slug, type (level/type/unit/specialty), sort_order, is_active, created_at, updated_at — Catégories de ressources modifiables par l'admin
- **platform_settings** : id, key, value, type (string/number/boolean/json), description, updated_at, updated_by — Paramètres globaux de la plateforme

### Stockage Supabase
- **Bucket `resources`** : fichiers PDF uploadés par les utilisateurs, organisés par `user_id/filename`

## 5. Backend / Third-party Integration Plan
- **Supabase Auth** : Authentification des enseignants (email/password)
- **Supabase Database** : Stockage de toutes les données
- **Supabase Storage** : Stockage des fichiers PDF uploadés (bucket `resources`)
- **Supabase Edge Functions** : Admin Create User
- **Shopify** : Non requis.
- **Stripe** : Non requis.

## 6. Development Phase Plan

### Phase 1 : Layout principal + Dashboard ✅
- Sidebar de navigation avec tous les liens
- Topbar avec recherche, notifications, profil
- Layout responsive (desktop + tablet)
- Page Dashboard avec statistiques visuelles, graphiques, ressources récentes, et activité peer review

### Phase 2 : Ressources + Upload ✅
- Page liste des ressources avec cartes, filtres, statuts
- Page formulaire d'upload de ressource (tous les champs)
- Validation du formulaire
- Transition après soumission avec statut "Non évalué"

### Phase 3 : Lecture de ressource + Commentaires ✅
- Lecteur PDF (react-pdf) et lecteur simulé pour les mocks sans fichier
- Badge de statut visible au-dessus du lecteur
- Section commentaires sous le document
- Types de commentaires (pédagogique, scientifique, technique, général)
- Affichage du nom et avatar du commentateur (via table profiles)
- Système de likes sur les commentaires
- Mentions (@utilisateur)

### Phase 4 : Peer Review Panel + Progress Tracker ✅
- Liste des reviewers volontaires avec avatars
- Bouton "Participer comme reviewer"
- Affichage conditionnel selon le nombre de reviewers
- Tracker visuel de progression avec icônes
- Section fichier de recommandation
- Assignation / désassignation / modification inline des reviewers

### Phase 5 : Upload PDF + Profils + Gestion des ressources ✅
- Upload de fichiers PDF via Supabase Storage avec barre de progression
- Affichage des vrais noms d'auteurs depuis la table profiles
- Page "Mes ressources" avec stats globales, tableau de gestion, filtres, et suppression
- Vrais noms d'utilisateurs dans les commentaires
- Profil public enseignant
- Gestion des versions de ressource

### Phase 6 : Authentification + Sécurité + Admin ✅
- Login / Signup / Mot de passe oublié / Réinitialisation
- Routes protégées selon les rôles
- Dashboard administrateur complet
- Système de notifications en temps réel
- Messagerie entre utilisateurs
- Dark mode

### Phase 7 : Finalisation & Polish 🔄 (EN COURS)
- [ ] Ajouter une page "Paramètres admin" avec gestion des catégories et paramètres globaux
- [ ] Animations d'entrée et transitions sur toutes les pages (actuellement uniquement sur la home publique)
- [ ] Ajustements responsive finaux (certaines pages admin et détail ressource à vérifier sur mobile)
- [ ] Cohérence visuelle globale (vérifier les couleurs admin violet vs enseignant sharek)
- [ ] Optimisation des performances (lazy loading des images, pagination des listes)
- [ ] Tests utilisateur sur les flux critiques (upload, peer review, commentaires)
- [ ] SEO et meta tags sur les pages publiques
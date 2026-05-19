# ShareK — Checklist de production

Audit + plan de mise en prod sur Supabase. Coche au fur et à mesure.

---

## 1. Audit ✅ / ❌

| # | Point | État | Action |
|---|---|---|---|
| 1 | RLS sur toutes les tables | ❌ → ✅ | Appliquer `supabase/migrations/0001_*` à `0004_*` |
| 2 | Vérif rôle admin côté serveur (pas que front) | ❌ → ✅ | Fonction `public.is_admin()` + Edge Function durcie |
| 3 | Storage policies (owner-only write, public read) | ❌ → ✅ | `supabase/migrations/0003_storage_policies.sql` |
| 4 | Realtime activé sur `notifications`/`messages`/`comments` | ❌ → ✅ | `supabase/migrations/0004_realtime.sql` |
| 5 | Env vars : anon-only côté client | ⚠️ → ✅ | `src/lib/supabase.ts` vérifie maintenant la `role` du JWT + `.env.example` créé + `.gitignore` créé |
| 6 | Edge Function `create-user` durcie | ⚠️ → ✅ | CORS allowlist via `ALLOWED_ORIGINS`, validation email/password/role, ban check |
| 7 | CORS prod | ❌ | Définir `ALLOWED_ORIGINS` dans Supabase + Site URL dans Auth |
| 8 | SMTP custom | ❌ | À configurer dans Supabase Auth → SMTP Settings |
| 9 | Rate limiting Auth | ❌ | À activer dans Supabase Auth → Rate Limits |
| 10 | Backups automatiques | ❌ | Plan Pro requis (Supabase Dashboard → Settings → Database) |
| 11 | `alert()` → toast | ❌ → ✅ | `src/lib/toast.tsx` créé + remplacé dans `profil/page.tsx` et `parametres/page.tsx` |
| 12 | `console.error` → logger | ⚠️ partiel | `src/lib/logger.ts` créé. Sweep restant : `AdminUsers.tsx`, `AdminResources.tsx`, etc. (voir §6) |
| 13 | `npm install` (erreurs "Cannot find module") | ❌ | À exécuter avant build |
| 14 | `mocks/data.ts` | ✅ types-only | Pas de mock data réelle — OK |
| 15 | `.gitignore` (le `.env` réel n'était pas ignoré) | ❌ → ✅ | Créé. **VÉRIFIE** que ton `.env` n'a JAMAIS été poussé sur git |

---

## 2. Fichiers créés / modifiés

### Créés
- `supabase/migrations/0001_helpers_and_grants.sql` — fonctions `is_admin()`, `is_banned()`, `handle_new_user()`, anti-escalation
- `supabase/migrations/0002_rls_policies.sql` — RLS sur 12 tables
- `supabase/migrations/0003_storage_policies.sql` — buckets `avatars`, `message-attachments`, `resources` + suppression du bucket `covers` (legacy)
- `supabase/migrations/0004_realtime.sql` — publication realtime
- `src/lib/toast.tsx` — `ToastProvider` + `useToast()`
- `src/lib/logger.ts` — wrapper DEV-only avec hook Sentry
- `.env.example` — template
- `.gitignore` — ignore `.env`, `node_modules`, `dist`, etc.

### Modifiés
- `supabase/functions/create-user/index.ts` — CORS allowlist, validation stricte, ban check
- `src/lib/supabase.ts` — refuse de booter si env manquant ou clé service_role
- `src/App.tsx` — wrappé dans `ToastProvider`
- `src/pages/profil/page.tsx` — `alert()` + `console.error` remplacés
- `src/pages/parametres/page.tsx` — idem
- `src/pages/home/HomeRedirect.tsx` — redirige les non connectés vers `/connexion`
- `src/router/config.tsx` — `/accueil`, `/a-propos`, `/contactez-nous` → redirect `/`
- `src/components/PublicOnlyRoute.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Footer.tsx`, `src/pages/NotFound.tsx`, `src/pages/ressource-detail/page.tsx` — liens vers `/accueil` supprimés
- `src/pages/profil/page.tsx` + `src/pages/profil/components/AdminProfileDashboard.tsx` — couverture supprimée, layout mobile fixé, role check robuste, overflow tabs admin corrigé

---

## 3. Commandes Supabase à exécuter

### Variables d'environnement Edge Function
```bash
# Dans Supabase Dashboard → Edge Functions → create-user → Secrets
ALLOWED_ORIGINS=https://sharek.ma,https://www.sharek.ma
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY sont déjà injectés par Supabase
```

### Appliquer les migrations (CLI Supabase)
```bash
# Si tu utilises le CLI Supabase (recommandé) :
supabase link --project-ref <ton-project-ref>
supabase db push

# Sinon, copier-coller chaque fichier 0001 → 0002 → 0003 → 0004
# dans : Dashboard → SQL Editor → Run, dans l'ordre.
```

### Déployer l'Edge Function
```bash
supabase functions deploy create-user --no-verify-jwt
# (--no-verify-jwt parce que le bootstrap "first admin" n'a pas de JWT)
# Puis dans Dashboard → Edge Functions → create-user → Secrets,
# ajouter ALLOWED_ORIGINS.
```

### Configurer Auth dans le Dashboard
```
Dashboard → Authentication → URL Configuration
  Site URL: https://sharek.ma
  Redirect URLs: https://sharek.ma/**, http://localhost:5173/**

Dashboard → Authentication → Providers → Email
  Confirm email: ON
  Secure email change: ON
  Secure password change: ON

Dashboard → Authentication → Rate Limits
  Sign up:  3 / hour  (par IP)
  Sign in:  30 / hour
  Token refresh: 150 / hour
  OTP / Magic link: 4 / hour

Dashboard → Authentication → SMTP Settings
  Configurer un provider transactionnel (Resend, Postmark, SendGrid).
  Le SMTP par défaut Supabase a une limite très basse (~3 emails/h) — INUTILISABLE en prod.

Dashboard → Settings → Database → Backups
  Activer les daily backups (plan Pro).
```

### Vérifier la réplication Realtime
```
Dashboard → Database → Replication → supabase_realtime
  Doit lister : notifications, messages, comments, comment_likes, profiles
  (La migration 0004 le fait — vérifie visuellement.)
```

---

## 4. Commandes locales

```bash
# Installer les dépendances (les erreurs TS "Cannot find module" disparaîtront)
cd "PFE 2026/Younes BOUTGOURA/ShareK"
npm install

# Vérifier qu'il n'y a pas d'erreurs
npm run build

# Lancer en local
npm run dev
```

---

## 5. Tests manuels après déploiement

### En tant qu'enseignant (rôle `teacher`)
- [ ] Login fonctionne
- [ ] `/profil` ne montre PAS "Administrateur" et PAS la section "Accès rapide → Utilisateurs"
- [ ] Avatar upload fonctionne (toast vert)
- [ ] Image > 5 Mo → toast rouge (pas alert())
- [ ] Publier une ressource → notification au peer reviewer
- [ ] La bell icon montre une notif en temps réel (test avec 2 onglets)
- [ ] Tentative de modifier la ressource d'un autre enseignant → 401/403 (testable depuis la console : `supabase.from('resources').update(...).eq('id', '<autre>')`)
- [ ] Tentative de SELECT * sur `messages` d'autres users → 0 lignes
- [ ] `/accueil`, `/a-propos`, `/contactez-nous` redirigent vers `/ressources`

### En tant qu'admin
- [ ] `/admin` charge les stats
- [ ] Création d'utilisateur depuis `/admin → Users` (passe par Edge Function)
- [ ] Bannir un user → cet user ne peut plus poster (test côté ban check)
- [ ] L'onglet "Activité de la plateforme" ne déborde plus à droite (mobile)

### Sécurité (tests offensifs basiques)
- [ ] Depuis la console navigateur, tenter `await supabase.from('profiles').update({role:'admin'}).eq('id', '<mon-id>')` → DOIT échouer (trigger `prevent_role_escalation`)
- [ ] Tenter d'uploader un fichier dans `avatars/<autre-uid>/...` → DOIT échouer (RLS storage)
- [ ] Appeler `/functions/v1/create-user` sans JWT après le bootstrap → 401
- [ ] Vérifier que `VITE_PUBLIC_SUPABASE_ANON_KEY` dans le bundle (`dist/`) est bien la clé `anon`, pas `service_role` :
  ```bash
  grep -o 'eyJ[a-zA-Z0-9_.-]*' dist/assets/*.js | head -1 | cut -d. -f2 | base64 -d 2>/dev/null
  # Doit contenir "role":"anon"
  ```

---

## 6. Suites recommandées (non bloquantes pour go-live)

### Sweep `console.error` → `logger.error`
Fichiers restants (volume faible, environ 30 occurrences) :
- `src/pages/admin/components/AdminUsers.tsx` (6)
- `src/pages/admin/components/AdminResources.tsx` (4)
- `src/pages/admin/components/AdminPendingReviews.tsx` (3)
- `src/pages/admin/components/AdminComments.tsx` (3)
- `src/pages/ressource-detail/components/VersionManager.tsx` (3)
- `src/pages/parametres-admin/page.tsx` (2)
- `src/pages/ressource-modifier/page.tsx`, `ressource-analytics/page.tsx`, `profil/components/TeacherActivityFeed.tsx` (1 chacun)

Pattern :
```ts
import { logger } from '@/lib/logger';
// remplacer :
//   console.error('xxx', err);
// par :
//   logger.error('xxx', err);
```

### Sentry (optionnel mais recommandé)
- `npm install @sentry/react`
- Wire dans `src/lib/logger.ts` → `reportError`
- DSN dans `.env` : `VITE_SENTRY_DSN=...`

### Push notifications navigateur (PWA)
Si tu veux des vraies notifs OS-level (pas seulement temps-réel in-app) :
1. Service Worker (Workbox via `vite-plugin-pwa`)
2. Générer des clés VAPID
3. Stocker les `push_subscriptions` par user
4. Une Edge Function `send-push` qui POST sur l'endpoint de chaque subscription via `web-push`

C'est ~200 lignes — pas critique pour le go-live, à faire dans un 2e temps.

---

## 7. Verdict Supabase

**Garde Supabase.** Pour ShareK (rôle académique, communauté d'enseignants au Maroc, < 10k utilisateurs prévus) :
- Postgres complet, RLS = sécurité au niveau base ✅
- Auth, Storage, Realtime, Edge Functions intégrés ✅
- Free tier suffit pour démarrer, Pro à 25$/mois pour les backups
- Migration future possible (self-hosted Postgres) sans réécriture

**Réécrire en backend custom** ne se justifierait que si :
- Volume > 100k MAU
- Logique métier serveur > 10 endpoints non-CRUD
- Contraintes de souveraineté (données médicales, défense)

Aucune de ces conditions ne s'applique à ShareK aujourd'hui.

---

## 8. Récap final — ordre d'exécution

1. ✅ `npm install` (résout les erreurs TS)
2. ✅ Vérifier que `.env` n'est PAS dans git : `git log --all --oneline -- .env`. S'il l'a été : **roule les clés Supabase MAINTENANT** (Dashboard → Settings → API → Reset).
3. ✅ Appliquer migrations `0001` → `0004` dans l'ordre
4. ✅ Configurer Auth (Site URL, Rate Limits, SMTP)
5. ✅ Déployer `create-user` Edge Function + secret `ALLOWED_ORIGINS`
6. ✅ Activer backups (plan Pro)
7. ✅ `npm run build` puis déployer le `dist/` (Vercel / Netlify / Supabase Hosting)
8. ✅ Lancer les tests manuels §5
9. (Optionnel) Sweep `console.error` + Sentry + PWA push

Bon déploiement 🚀

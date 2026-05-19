# ShareK — Guide de durcissement production

Ordonné. Coche au fur et à mesure. **NE PAS SAUTER L'ORDRE** : 0001 doit être appliquée avant 0002/0003 (qui en dépendent).

---

## ✅ Pré-vérification — Audit actuel

Lance ce SQL **avant tout** pour savoir ce qui est déjà appliqué :

```sql
-- État des helpers
select
  exists(select 1 from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace) as fn_is_admin,
  exists(select 1 from pg_proc where proname = 'is_banned' and pronamespace = 'public'::regnamespace) as fn_is_banned,
  exists(select 1 from pg_proc where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace) as fn_handle_new_user,
  exists(select 1 from pg_proc where proname = 'prevent_role_escalation' and pronamespace = 'public'::regnamespace) as fn_anti_escalation;

-- État RLS par table
select tablename, rowsecurity, forcerowsecurity
from pg_tables where schemaname = 'public'
order by tablename;

-- État buckets storage
select id, public, file_size_limit, array_length(allowed_mime_types, 1) as mime_count
from storage.buckets;

-- État realtime publication
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
```

Si tout ressort `false` / `f`, applique tout. Sinon, saute les étapes déjà OK.

---

## 1️⃣ Migrations DB (5 + 10 min)

### Étape 1 — `0001_helpers_and_grants.sql`

Crée `is_admin()`, `is_banned()`, `handle_new_user()`, et le trigger anti-escalation de rôle.

**SQL Editor → New query → Colle [supabase/migrations/0001_helpers_and_grants.sql](supabase/migrations/0001_helpers_and_grants.sql) → Run**

Vérif post-run :
```sql
select 'is_admin' as fn, public.is_admin() as result
union all select 'is_banned', public.is_banned();
```
→ Doit retourner 2 lignes avec `false` (vu que tu es admin connecté via dashboard, `is_admin()` peut être `true` selon ton contexte).

### Étape 2 — `0002_rls_policies.sql`

RLS sur toutes les tables (profiles, resources, peer_reviews, comments, comment_likes, notifications, messages, recommendations, resource_versions, categories, platform_settings, favorites si existe).

**SQL Editor → Colle [supabase/migrations/0002_rls_policies.sql](supabase/migrations/0002_rls_policies.sql) → Run**

Vérif :
```sql
select tablename, count(*) as policies
from pg_policies where schemaname = 'public'
group by tablename order by tablename;
```
→ Chaque table doit avoir ≥ 3 policies.

### Étape 3 — `0003_storage_policies.sql`

Policies storage strictes (owner-only write, public read). Remplace les policies permissives de 0006.

**SQL Editor → Colle [supabase/migrations/0003_storage_policies.sql](supabase/migrations/0003_storage_policies.sql) → Run**

⚠️ Si tu as gardé la migration 0006 (policies permissives), 0003 va **drop+recreate** les policies avec des règles plus strictes. C'est voulu.

Vérif :
```sql
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
```

### Étape 4 — `0004_realtime.sql`

Active la réplication realtime sur notifications/messages/comments/comment_likes/profiles.

**SQL Editor → Colle [supabase/migrations/0004_realtime.sql](supabase/migrations/0004_realtime.sql) → Run**

Vérif :
```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
```
→ Tu dois voir : `comment_likes`, `comments`, `favorites`, `messages`, `notifications`, `profiles`.

### Étape 5 — `0008_cleanup_legacy.sql`

Supprime le bucket `covers` legacy (rendu inutile depuis le retrait de la cover de profil).

**SQL Editor → Colle [supabase/migrations/0008_cleanup_legacy.sql](supabase/migrations/0008_cleanup_legacy.sql) → Run**

---

## 2️⃣ SMTP custom — Resend (30 min)

Le SMTP par défaut Supabase est limité à ~3 emails/heure → inacceptable en prod.

### Setup Resend (gratuit, 3000 emails/mois)

1. Va sur [resend.com](https://resend.com) → Sign up (gratuit)
2. **Domains → Add domain** → entre `sharek.ma` (ou ton domaine)
3. Resend te donne 3 enregistrements DNS (SPF + DKIM + DMARC) à ajouter chez ton registrar
   - Si tu n'as pas de domaine custom, tu peux skip et utiliser `onboarding@resend.dev` pour tester
4. **API Keys → Create API Key** → name="sharek-supabase" → copie la clé (`re_xxxxxxxxx`)

### Configurer dans Supabase

**Dashboard → Project Settings → Authentication → SMTP Settings**

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | ON |
| Sender email | `noreply@sharek.ma` (ou `onboarding@resend.dev`) |
| Sender name | `ShareK` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | (la clé `re_xxxxxxxxx`) |
| Minimum interval | `60` (sec entre 2 emails au même destinataire) |

Save → **Send test email** depuis Dashboard pour vérifier.

### Personnaliser les templates emails

**Dashboard → Authentication → Email Templates** → personnalise au moins :
- **Confirm signup** : "Bienvenue sur ShareK ! Confirme ton inscription..."
- **Reset password** : "Réinitialise ton mot de passe ShareK..."
- **Magic link** : "Connecte-toi à ShareK en un clic..."

---

## 3️⃣ Rate Limiting Auth (2 min)

Sans ça : exposé au brute-force login + spam signup.

**Dashboard → Authentication → Rate Limits**

| Action | Valeur recommandée pour beta |
|---|---|
| Sign up | `3 / hour` par IP |
| Sign in | `30 / hour` par IP |
| Token refresh | `150 / hour` par IP |
| OTP / Magic link | `4 / hour` par IP |
| Verify | `30 / hour` par IP |

Save.

---

## 4️⃣ Backups (paye + 2 min)

**Dashboard → Project Settings → Database → Backups**

Si tu es en Free :
- Upgrade vers Pro (~$25/mois) → backups automatiques quotidiens 7 jours
- Si pas de budget : `pg_dump` manuel hebdomadaire via le CLI Supabase :
  ```bash
  supabase db dump -f backup-$(date +%Y%m%d).sql --linked
  ```
  À mettre dans un cron sur ta machine de prod.

---

## 5️⃣ Edge Function `create-user` — Production ready

L'Edge Function est déjà codée avec CORS allowlist via env var.

### Déployer

```bash
# Depuis le repo racine
supabase link --project-ref ybqrtpcazyl  # ton project ref
supabase functions deploy create-user --no-verify-jwt
```

Le `--no-verify-jwt` est nécessaire parce que le bootstrap "first admin" est appelé SANS JWT.

### Configurer les secrets

**Dashboard → Edge Functions → create-user → Secrets**

Ajoute :
```
ALLOWED_ORIGINS=https://sharek.ma,https://www.sharek.ma
```

(Multi-domaines séparés par virgule. Pour le local dev, ajoute aussi `http://localhost:4173,http://localhost:5173`.)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` sont **injectés automatiquement** par Supabase, pas besoin de les setter.

### Tester

```bash
# Doit retourner 401 (pas de JWT) si un admin existe déjà
curl -i -X OPTIONS https://ybqrtpcazyl.supabase.co/functions/v1/create-user \
  -H "Origin: https://sharek.ma"

# Doit retourner les CORS headers avec sharek.ma autorisé
```

---

## 6️⃣ CORS / URLs Auth

**Dashboard → Authentication → URL Configuration**

| Champ | Valeur prod |
|---|---|
| Site URL | `https://sharek.ma` |
| Redirect URLs | `https://sharek.ma/**`, `http://localhost:4173/**`, `http://localhost:5173/**` |

Sans ça, les liens de confirmation email/reset password ne fonctionneront pas en prod.

---

## 7️⃣ Audit sécurité — Tests offensifs (15 min)

Voir [scripts/security-tests.md](scripts/security-tests.md) — 8 scénarios concrets à exécuter depuis la console navigateur après login en tant que teacher. Si l'un d'eux **réussit** où il devrait échouer, c'est une faille à fixer.

Tests inclus :
1. Self role escalation (teacher → admin)
2. UPDATE sur le profil d'un autre user
3. DELETE sur ressource d'autrui
4. Storage upload dans le dossier d'un autre user
5. READ messages d'autres users
6. INSERT favori pour un autre user
7. Service_role exposed dans le bundle ?
8. Edge function `create-user` sans auth

---

## 8️⃣ Test de charge — 20 enseignants simultanés (30 min)

Voir [scripts/load-test.mjs](scripts/load-test.mjs) — simulation Node.js de 20 sessions concurrentes faisant : login + read /ressources + lecture de ressource + commentaire.

```bash
# Configure d'abord 20 comptes test (ou utilise un seul + tokens fictifs)
node scripts/load-test.mjs
```

Le script affiche :
- Latence p50/p95/p99 par endpoint
- Taux d'erreur
- Throughput requêtes/sec

Critère de réussite pour pilote ERIPDS :
- p95 < 500ms sur tous les endpoints
- 0 erreur 5xx
- Connection pool Postgres pas saturé

---

## 📋 Checklist finale

Coche dans l'ordre :

- [ ] **Pré-vérif** SQL audit lancé
- [ ] **0001** appliquée — `is_admin()`, `is_banned()` existent
- [ ] **0002** appliquée — RLS sur 12 tables
- [ ] **0003** appliquée — Storage policies strictes
- [ ] **0004** appliquée — Realtime activé
- [ ] **0008** appliquée — Bucket `covers` legacy supprimé
- [ ] **SMTP Resend** configuré + test email envoyé OK
- [ ] **Email templates** personnalisés (3 minimum)
- [ ] **Rate limits Auth** configurés
- [ ] **Backups** (Pro plan OU pg_dump hebdo)
- [ ] **Edge Function `create-user`** déployée + secret `ALLOWED_ORIGINS` set
- [ ] **Auth URLs** : Site URL + Redirect URLs en prod
- [ ] **Tests offensifs** : 8/8 passent (échec attendu)
- [ ] **Test de charge** : p95 < 500ms

Quand 14/14 sont cochés : 🚀 **prêt pour ouverture publique**.

Tant que tu es en pilote ERIPDS (50 users max, accompagnement humain), tu peux skipper le Pro/backups/load-test sans risque immédiat.

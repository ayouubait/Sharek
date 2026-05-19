# Tests offensifs — ShareK

**Pour qui** : à exécuter après l'application des migrations 0001-0004 + 0008.
**Comment** : login en tant qu'enseignant test (younes@sharek.com) → ouvrir DevTools → Console.

Tous les tests doivent **ÉCHOUER** (= la sécurité tient). Si l'un **RÉUSSIT**, c'est une faille critique à fixer immédiatement.

---

## Setup

Dans la console navigateur (sur n'importe quelle page de l'app, connecté en teacher) :

```js
// La référence supabase est exposée pour debug — sinon importer le client.
const sb = window.__supabase || (await import('/src/lib/supabase.ts')).supabase;

// Ton ID teacher (à récupérer depuis /profil ou via :)
const { data: { user } } = await sb.auth.getUser();
const MY_ID = user.id;
console.log('Test running as user:', MY_ID);
```

Si `window.__supabase` n'est pas exposé, ouvre la console sur `/profil` qui importe déjà le client — la `supabase` global est dispo dans les sources map.

---

## Test 1 — Self role escalation

**Objectif** : un teacher tente de se promouvoir admin.

```js
const result = await sb.from('profiles').update({ role: 'admin' }).eq('id', MY_ID).select();
console.log(result);
```

**Attendu** :
- `error.message` contient "Forbidden: only admins can change role" (grâce au trigger `prevent_role_escalation`).
- OU `data: null, error: null` mais le rôle n'a pas changé en DB.

**Échec** = le user est admin maintenant → **faille critique**, vérifier que migration 0001 est bien appliquée.

---

## Test 2 — UPDATE profil d'un autre user

```js
// Trouve un autre user (ex: l'admin)
const others = await sb.from('profiles').select('id, name').neq('id', MY_ID).limit(1);
const otherId = others.data?.[0]?.id;
const r = await sb.from('profiles').update({ name: 'HACKED' }).eq('id', otherId).select();
console.log(r);
```

**Attendu** : `data: []` (0 row affected, RLS l'a bloqué silencieusement).
**Échec** = le nom de l'autre a été changé → policy `profiles_update_self` cassée.

---

## Test 3 — DELETE ressource d'autrui

```js
// Récupère une ressource publiée par quelqu'un d'autre
const r = await sb.from('resources').select('id, author_id').neq('author_id', MY_ID).limit(1);
const otherResourceId = r.data?.[0]?.id;
if (otherResourceId) {
  const del = await sb.from('resources').delete().eq('id', otherResourceId).select();
  console.log(del);
}
```

**Attendu** : `data: []` (RLS bloque).
**Échec** = ressource supprimée → policy `resources_delete_owner` ou `_admin` mal écrite.

---

## Test 4 — Upload storage dans le dossier d'un autre user

```js
const blob = new Blob(['malicious'], { type: 'image/png' });
const otherUid = 'f6dc7539-b0f8-491d-8c2c-2790885e0d62'; // l'ID d'ayoub@sharek.com (admin)
const result = await sb.storage.from('resources').upload(`${otherUid}/hack.png`, blob);
console.log(result);
```

**Attendu** : `error.message` contient "new row violates row-level security policy".
**Échec** = upload réussi → policy `resources_storage_insert` ne vérifie pas le foldername.

---

## Test 5 — READ messages d'autres users

```js
const msgs = await sb.from('messages').select('*').limit(10);
console.log('Messages visibles:', msgs.data?.length);
console.log(msgs.data?.map(m => ({ from: m.sender_id, to: m.receiver_id })));
```

**Attendu** : seuls les messages où `sender_id = MY_ID OR receiver_id = MY_ID` apparaissent.
**Échec** = messages d'autres conversations visibles → policy `messages_select_participants` cassée.

---

## Test 6 — INSERT favori pour un autre user

```js
const others = await sb.from('profiles').select('id').neq('id', MY_ID).limit(1);
const otherId = others.data?.[0]?.id;
const someResource = (await sb.from('resources').select('id').limit(1)).data?.[0]?.id;
if (otherId && someResource) {
  const r = await sb.from('favorites').insert({ user_id: otherId, resource_id: someResource }).select();
  console.log(r);
}
```

**Attendu** : `error.message` contient "violates row-level security".
**Échec** = favori inséré pour l'autre user → policy `favorites_insert_self` mal écrite.

---

## Test 7 — Service_role exposed dans le bundle ?

Dans un terminal (pas le browser) :

```bash
# Récupère la clé Supabase utilisée par le bundle
JWT=$(grep -oE 'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' \
  out/assets/index-*.js | head -1)

# Décode le payload
echo "$JWT" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

**Attendu** : `"role": "anon"`.
**Échec** = `"role": "service_role"` → **CRITIQUE**, change la clé dans `.env` IMMÉDIATEMENT et roll la clé dans Supabase Dashboard.

Note : si tu utilises le nouveau format `sb_publishable_*`, cherche-le à la place :
```bash
grep -oE 'sb_publishable_[A-Za-z0-9]+' out/assets/index-*.js | head -1
# Doit être 'sb_publishable_xxxx' (= clé publique). Si 'sb_secret_xxxx', danger.
```

---

## Test 8 — Edge function `create-user` sans auth

Dans un terminal :

```bash
# Sans Authorization header → doit être refusé si un admin existe déjà
curl -i -X POST 'https://ybqrtpcazyl.supabase.co/functions/v1/create-user' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sharek.ma' \
  -d '{"email":"attacker@evil.com","password":"hack123!","name":"Attacker","role":"admin"}'
```

**Attendu** : `401 Unauthorized` ou `403 Forbidden — admin only`.
**Échec** = `200 success: true` avec un nouvel admin créé → CORS/auth check cassé dans la fn.

---

## Test 9 (bonus) — CORS edge function depuis un origin non autorisé

```bash
curl -i -X OPTIONS 'https://ybqrtpcazyl.supabase.co/functions/v1/create-user' \
  -H 'Origin: https://evil.example.com'
```

**Attendu** : `Access-Control-Allow-Origin` ≠ `evil.example.com` (= le défaut `ALLOWED_ORIGINS[0]`).
**Échec** = `evil.example.com` reflété → CSRF possible.

---

## Test 10 (bonus) — Ban check sur INSERT comment

Si tu te bannis toi-même via SQL Editor :
```sql
update public.profiles set is_banned = true where email = 'younes@sharek.com';
```

Puis depuis le browser :
```js
await sb.from('comments').insert({ resource_id: '<un-id>', content: 'spam', author_id: MY_ID });
```

**Attendu** : `error.message` contient "violates row-level security" (policy `comments_insert_self` check `not is_banned()`).
**Échec** = comment inséré malgré le ban → policy ne check pas `is_banned()`.

Restaure :
```sql
update public.profiles set is_banned = false where email = 'younes@sharek.com';
```

---

## 📋 Scoring

| Tests passés (échec attendu) | Verdict |
|---|---|
| 10/10 | 🟢 Sécurité prod-ready |
| 8-9/10 | 🟡 Quasi-prêt, identifier les 1-2 trous |
| < 8 | 🔴 Reprendre les migrations 0001-0003 |

Documente les résultats dans le PR/commit avant ouverture publique.

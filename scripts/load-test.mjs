#!/usr/bin/env node
/**
 * ShareK — Test de charge léger pour valider que Supabase tient
 * une charge réaliste de pilote (20 enseignants simultanés).
 *
 * Usage :
 *   node scripts/load-test.mjs
 *
 * Configuration via .env (ou variables d'environnement) :
 *   VITE_PUBLIC_SUPABASE_URL          — endpoint Supabase
 *   VITE_PUBLIC_SUPABASE_ANON_KEY     — clé anon publique
 *   LOAD_TEST_USERS=20                 — nb d'users concurrents (default 20)
 *   LOAD_TEST_ITERATIONS=10            — nb de cycles par user (default 10)
 *   LOAD_TEST_EMAIL_PREFIX=loadtest    — prefix emails (loadtest+0@sharek.com)
 *   LOAD_TEST_PASSWORD=LoadTest_2026!  — password commun
 *
 * Pré-requis :
 *   1. Créer les comptes test via le SQL Editor :
 *      ```sql
 *      do $$
 *      declare i int;
 *      begin
 *        for i in 0..19 loop
 *          -- À faire via l'Edge Function create-user, ou manuellement.
 *          raise notice 'Crée user loadtest+%@sharek.com manuellement', i;
 *        end loop;
 *      end$$;
 *      ```
 *      OU plus simple : un seul user existant qui se reconnecte 20 fois.
 *
 * Mesure :
 *   - Latence par opération (login, list, read, comment)
 *   - p50 / p95 / p99
 *   - Throughput requêtes/sec
 *   - Taux d'erreur
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ──────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) {
        const key = m[1];
        let value = m[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // .env absent — OK si les vars sont déjà setées
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const N_USERS = parseInt(process.env.LOAD_TEST_USERS || '20', 10);
const N_ITERATIONS = parseInt(process.env.LOAD_TEST_ITERATIONS || '10', 10);
const EMAIL_PREFIX = process.env.LOAD_TEST_EMAIL_PREFIX || 'younes';
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'ShareK_Teach@2026!';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Manque VITE_PUBLIC_SUPABASE_URL ou VITE_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────
// Métriques
// ──────────────────────────────────────────────────────────────────────

const samples = {
  login: [],
  listResources: [],
  readResource: [],
  postComment: [],
  toggleFavorite: [],
};
const errors = [];

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    samples[label].push(Date.now() - t0);
    return result;
  } catch (err) {
    errors.push({ label, msg: err?.message || String(err) });
    samples[label].push(Date.now() - t0);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Scénario utilisateur
// ──────────────────────────────────────────────────────────────────────

async function userJourney(userIndex) {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Si EMAIL_PREFIX == 'younes' (default), tous les users se loguent sur le même
  // compte (utile pour un test où tu as 1 seul compte). Sinon, chaque user a
  // son propre email loadtest+N@sharek.com.
  const email = EMAIL_PREFIX === 'younes'
    ? 'younes@sharek.com'
    : `${EMAIL_PREFIX}+${userIndex}@sharek.com`;

  // 1. Login
  const loginRes = await timed('login', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw error;
    return data;
  });
  if (!loginRes) return;

  // 2. N cycles de browsing + commentaire
  for (let i = 0; i < N_ITERATIONS; i++) {
    // List resources (with cover_image_url)
    const list = await timed('listResources', async () => {
      const { data, error } = await sb
        .from('resources')
        .select('id, title, cover_image_url, status, author_id, views, downloads, comments_count')
        .limit(20);
      if (error) throw error;
      return data;
    });

    if (!list || list.length === 0) continue;
    const target = list[Math.floor(Math.random() * list.length)];

    // Read 1 resource detail
    await timed('readResource', async () => {
      const { data, error } = await sb.from('resources').select('*').eq('id', target.id).single();
      if (error) throw error;
      return data;
    });

    // Toggle favorite (add or remove)
    await timed('toggleFavorite', async () => {
      const { data: existing } = await sb
        .from('favorites')
        .select('user_id')
        .eq('user_id', loginRes.user.id)
        .eq('resource_id', target.id)
        .maybeSingle();
      if (existing) {
        const { error } = await sb
          .from('favorites')
          .delete()
          .eq('user_id', loginRes.user.id)
          .eq('resource_id', target.id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('favorites')
          .insert({ user_id: loginRes.user.id, resource_id: target.id });
        if (error) throw error;
      }
    });

    // Post a comment 1 fois sur 5 (pour ne pas spammer)
    if (i % 5 === 0) {
      await timed('postComment', async () => {
        const { error } = await sb.from('comments').insert({
          resource_id: target.id,
          author_id: loginRes.user.id,
          type: 'general',
          type_label: 'Commentaire',
          content: `Load test comment from user ${userIndex} iteration ${i}`,
          likes_count: 0,
        });
        if (error) throw error;
      });
    }
  }

  await sb.auth.signOut();
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 ShareK load test`);
  console.log(`   Users concurrents : ${N_USERS}`);
  console.log(`   Itérations / user : ${N_ITERATIONS}`);
  console.log(`   Endpoint          : ${SUPABASE_URL}`);
  console.log(`   Email             : ${EMAIL_PREFIX === 'younes' ? 'younes@sharek.com (compte unique)' : `${EMAIL_PREFIX}+N@sharek.com (multi-comptes)`}\n`);

  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: N_USERS }, (_, i) => userJourney(i))
  );
  const totalMs = Date.now() - t0;

  // ── Rapport ──
  console.log(`\n📊 Résultats (${(totalMs / 1000).toFixed(1)}s total)`);
  console.log('─'.repeat(70));
  console.log(
    'Opération'.padEnd(20) +
    'p50'.padStart(10) +
    'p95'.padStart(10) +
    'p99'.padStart(10) +
    'Count'.padStart(10) +
    'Errors'.padStart(10),
  );
  console.log('─'.repeat(70));

  for (const [label, arr] of Object.entries(samples)) {
    const errCount = errors.filter((e) => e.label === label).length;
    console.log(
      label.padEnd(20) +
      `${percentile(arr, 50)}ms`.padStart(10) +
      `${percentile(arr, 95)}ms`.padStart(10) +
      `${percentile(arr, 99)}ms`.padStart(10) +
      `${arr.length}`.padStart(10) +
      `${errCount}`.padStart(10),
    );
  }

  const totalReqs = Object.values(samples).reduce((s, a) => s + a.length, 0);
  const throughput = (totalReqs / (totalMs / 1000)).toFixed(1);
  console.log('─'.repeat(70));
  console.log(`Total requêtes    : ${totalReqs}`);
  console.log(`Throughput        : ${throughput} req/s`);
  console.log(`Total errors      : ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Sample errors (premiers 5) :');
    for (const e of errors.slice(0, 5)) {
      console.log(`   - [${e.label}] ${e.msg}`);
    }
  }

  // ── Verdict ──
  const p95Login = percentile(samples.login, 95);
  const p95List = percentile(samples.listResources, 95);
  const errRate = errors.length / totalReqs;
  console.log('\n🎯 Verdict pilote ERIPDS (20 users) :');
  console.log(`   p95 login  : ${p95Login}ms ${p95Login < 1000 ? '✅' : '⚠️'} (cible <1000ms)`);
  console.log(`   p95 list   : ${p95List}ms ${p95List < 500 ? '✅' : '⚠️'} (cible <500ms)`);
  console.log(`   err rate   : ${(errRate * 100).toFixed(1)}% ${errRate < 0.01 ? '✅' : '⚠️'} (cible <1%)`);

  const allGood = p95Login < 1000 && p95List < 500 && errRate < 0.01;
  console.log(`\n${allGood ? '🟢 PRÊT pour pilote' : '🟡 À optimiser avant ouverture'}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

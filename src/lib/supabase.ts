import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  const missing = [
    !supabaseUrl ? 'VITE_PUBLIC_SUPABASE_URL' : null,
    !supabaseKey ? 'VITE_PUBLIC_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean).join(', ');
  throw new Error(
    `[ShareK] Missing required environment variables: ${missing}. ` +
    `Copy .env.example to .env and fill in your Supabase project values.`
  );
}

// Defense-in-depth: refuse to boot if a service_role key was accidentally
// pasted into the client env. The JWT payload role of an anon key is "anon".
try {
  const payload = JSON.parse(atob(supabaseKey.split('.')[1] ?? ''));
  if (payload?.role && payload.role !== 'anon') {
    throw new Error(
      `[ShareK] FATAL: VITE_PUBLIC_SUPABASE_ANON_KEY appears to be a "${payload.role}" key, ` +
      `not "anon". Never expose service_role keys to the browser.`
    );
  }
} catch (err) {
  if ((err as Error)?.message?.startsWith('[ShareK] FATAL')) throw err;
  // Token wasn't a JWT — let Supabase fail naturally on the first request.
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

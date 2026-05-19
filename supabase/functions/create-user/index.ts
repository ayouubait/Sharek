import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================================
// create-user — admin-only Edge Function (or first-setup bootstrap)
// Uses SERVICE_ROLE: never expose this key client-side.
// =====================================================================

// Comma-separated list of allowed origins, e.g.
// "https://sharek.ma,https://app.sharek.ma,http://localhost:5173"
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500, origin);
    }

    // Admin client (service_role bypasses RLS).
    const admin = createClient(supabaseUrl, serviceKey);

    // Caller client (uses caller JWT — for auth.getUser only).
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const role = String(body.role ?? "teacher").trim().toLowerCase();

    // Validation
    if (!email || !password || !name) {
      return json({ error: "Champs manquants : email, password, name" }, 400, origin);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ error: "Email invalide" }, 400, origin);
    }
    if (password.length < 8) {
      return json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, 400, origin);
    }
    if (name.length < 2 || name.length > 100) {
      return json({ error: "Nom invalide (2 à 100 caractères)." }, 400, origin);
    }
    if (!["teacher", "admin", "reviewer"].includes(role)) {
      return json({ error: "Rôle invalide" }, 400, origin);
    }

    // First-setup bootstrap: if no admin exists yet, the very first call may create one.
    const { data: existingAdmins, error: adminLookupErr } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (adminLookupErr) {
      return json({ error: "Lookup error" }, 500, origin);
    }
    const isFirstSetup = !existingAdmins || existingAdmins.length === 0;

    if (!isFirstSetup) {
      // Require caller to be an authenticated admin.
      const { data: { user }, error: userErr } = await callerClient.auth.getUser();
      if (userErr || !user) {
        return json({ error: "Unauthorized" }, 401, origin);
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("role, is_banned")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || profile.is_banned || profile.role !== "admin") {
        return json({ error: "Forbidden — admin only" }, 403, origin);
      }
    }

    const finalRole = isFirstSetup ? "admin" : role;

    const { data: newUserData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: finalRole },
    });

    if (createError || !newUserData?.user) {
      return json(
        { error: createError?.message ?? "Erreur lors de la création de l'utilisateur." },
        400,
        origin,
      );
    }

    // Reassert role server-side (trigger may default it to 'teacher').
    await admin.from("profiles").update({ role: finalRole, name, email }).eq("id", newUserData.user.id);

    return json(
      { success: true, userId: newUserData.user.id, email, role: finalRole, isFirstSetup },
      200,
      origin,
    );
  } catch (err) {
    return json({ error: (err as Error)?.message ?? "Server error" }, 500, origin);
  }
});

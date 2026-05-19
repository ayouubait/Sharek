import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  specialty?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string; user?: AuthUser }>;
  signup: (email: string, password: string, name: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'sharek-auth-user';

function extractUser(rawUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null, profile?: { name?: string; role?: string; specialty?: string } | null): AuthUser | null {
  if (!rawUser) return null;
  return {
    id: rawUser.id,
    email: rawUser.email || '',
    name: profile?.name || (rawUser.user_metadata?.name as string) || rawUser.email?.split('@')[0] || '',
    role: profile?.role,
    specialty: profile?.specialty,
  };
}

function readUserFromStorage(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthUser;
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchUserProfileWithTimeout(userId: string): Promise<{ name?: string; role?: string; specialty?: string } | undefined> {
  // Retry once on failure, with longer timeouts (15s + 15s) to survive flaky network or cold queries
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await withTimeout(
        supabase
          .from('profiles')
          .select('name, role, specialty')
          .eq('id', userId)
          .maybeSingle(),
        15000
      );
      if (data) return { name: data.name, role: data.role, specialty: data.specialty };
    } catch {
      // try again
    }
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      promise.then(() => {}).catch(() => {});
      reject(new Error('Timeout'));
    }, ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUserFromStorage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setUser(readUserFromStorage());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000);
        if (!cancelled && session?.user) {
          const profile = await fetchUserProfileWithTimeout(session.user.id);
          if (!cancelled) {
            setUser((prev) => {
              const next = extractUser(session.user, profile);
              // If profile fetch failed, keep previously cached name/specialty/role if they look valid
              if (!profile && prev && next && prev.id === next.id && prev.name && !prev.name.includes('@')) {
                return { ...next, name: prev.name, specialty: prev.specialty, role: prev.role };
              }
              return next;
            });
          }
        }
      } catch {
        // Timeout or error: user considered not logged in
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const profile = session?.user ? await fetchUserProfileWithTimeout(session.user.id) : undefined;
        setUser((prev) => {
          const next = extractUser(session?.user || null, profile);
          // If fetch failed (profile is undefined) and we already have a valid user, preserve it
          if (!profile && prev && next && prev.id === next.id && prev.name && !prev.name.includes('@') && prev.name !== prev.email?.split('@')[0]) {
            return { ...next, name: prev.name, specialty: prev.specialty, role: prev.role };
          }
          return next;
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      // TOKEN_REFRESHED is intentionally ignored: the session refresh doesn't change user identity,
      // and refetching the profile here can fail silently and degrade the cached name/specialty.
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        60000
      );
      if (error) return { error: error.message };
      const profile = data.user ? await fetchUserProfileWithTimeout(data.user.id) : undefined;
      const user = extractUser(data.user, profile);
      setUser(user);
      return { user };
    } catch {
      return { error: 'Le serveur met trop de temps à répondre. Vérifiez votre connexion internet et réessayez.' };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        }),
        30000
      );
      if (error) return { error: error.message };

      const needsEmailConfirmation = !data.user?.identities || data.user.identities.length === 0;

      if (!needsEmailConfirmation && data.user) {
        const role = await fetchUserProfileWithTimeout(data.user.id);
        setUser(extractUser(data.user, role));
      }

      return { needsEmailConfirmation };
    } catch {
      return { error: 'Le serveur met trop de temps à répondre. Veuillez réessayer.' };
    }
  };

  const logout = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 5000);
    } catch {
      // Force local logout even if Supabase times out
    }

    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
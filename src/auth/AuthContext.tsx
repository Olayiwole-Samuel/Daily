import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { GOOGLE_CLIENT_ID, signInWithGoogle, type AuthUser } from './google';

const SESSION_KEY = 'weekly-goals-session';

interface AuthContextValue {
  user: AuthUser | null;
  signIn: () => Promise<void>;
  signInDemo: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Remember who signed in, so reopening the app doesn't ask again.
function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    return typeof parsed.id === 'string' && typeof parsed.email === 'string' ? (parsed as AuthUser) : null;
  } catch {
    return null;
  }
}

function saveSession(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: you'll just sign in again next time
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadSession);

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not set up yet (missing VITE_GOOGLE_CLIENT_ID).');
    const signedIn = await signInWithGoogle(GOOGLE_CLIENT_ID);
    saveSession(signedIn);
    setUser(signedIn);
  }, []);

  // Only offered in dev when no client id is configured, so you can keep building.
  const signInDemo = useCallback(() => {
    const demo: AuthUser = { id: 'demo', email: 'demo@localhost', name: 'Demo Player', demo: true };
    saveSession(demo);
    setUser(demo);
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, signIn, signInDemo, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

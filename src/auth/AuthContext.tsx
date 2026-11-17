import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { GOOGLE_CLIENT_ID, signInWithGoogle, type AuthUser } from './google';
import { checkServerSession, endServerSession, startServerSession } from '../sync/client';

const SESSION_KEY = 'weekly-goals-session';

// Where cloud backup stands for the signed-in user:
//   connected     - server session active, data syncs
//   needsSignIn   - signed in on this device, but the server needs a fresh Google sign-in
//   notConfigured - the server has no database yet (data stays on this device)
//   offline       - can't reach the server right now
//   demo          - dev-mode user, never synced
export type CloudStatus = 'checking' | 'connected' | 'needsSignIn' | 'notConfigured' | 'offline' | 'demo';

interface AuthContextValue {
  user: AuthUser | null;
  cloud: CloudStatus;
  signIn: () => Promise<void>;
  signInDemo: () => void;
  signOut: () => void;
  refreshCloud: () => Promise<void>;
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
  const [cloud, setCloud] = useState<CloudStatus>('checking');

  // Ask the server whether this device has a valid session for THIS user.
  const refreshCloud = useCallback(async () => {
    const current = loadSession();
    if (!current) return;
    if (current.demo) return setCloud('demo');
    const check = await checkServerSession();
    if (check === 'offline') return setCloud('offline');
    if (!check.cloud) return setCloud('notConfigured');
    setCloud(check.userId === current.id ? 'connected' : 'needsSignIn');
  }, []);

  useEffect(() => {
    refreshCloud();
    // Re-check when coming back online.
    window.addEventListener('online', refreshCloud);
    return () => window.removeEventListener('online', refreshCloud);
  }, [refreshCloud]);

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not set up yet (missing VITE_GOOGLE_CLIENT_ID).');
    const { user: signedIn, accessToken } = await signInWithGoogle(GOOGLE_CLIENT_ID);
    saveSession(signedIn);
    setUser(signedIn);
    // Also sign in to our own server for cloud backup. If that fails the app
    // still works from this device, and Settings offers to try again.
    await startServerSession(accessToken);
    await refreshCloud();
  }, [refreshCloud]);

  // Only offered in dev when no client id is configured, so you can keep building.
  const signInDemo = useCallback(() => {
    const demo: AuthUser = { id: 'demo', email: 'demo@localhost', name: 'Demo Player', demo: true };
    saveSession(demo);
    setUser(demo);
    setCloud('demo');
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setUser(null);
    setCloud('checking');
    endServerSession();
  }, []);

  return <AuthContext.Provider value={{ user, cloud, signIn, signInDemo, signOut, refreshCloud }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

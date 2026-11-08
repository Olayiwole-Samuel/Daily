// Google sign-in using Google Identity Services (GIS), loaded from Google's CDN.
// We use the "token client": our own button opens Google's popup, we get a short-lived
// access token, and use it once to read the user's name, email and picture.

export interface AuthUser {
  id: string; // Google's stable user id ("sub")
  email: string;
  name: string;
  picture?: string;
  demo?: boolean; // local dev login without a Google client id
}

// Minimal types for the parts of the GIS library we use (it ships no TS types).
interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}
interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: { type: string; message?: string }) => void;
    }) => TokenClient;
  };
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

let scriptPromise: Promise<void> | null = null;

// Adds Google's script tag once. Called early so the popup opens instantly on click.
export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // allow a retry, e.g. after coming back online
        reject(new Error("Couldn't reach Google. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface UserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

// Must be called straight from a click handler: browsers only allow popups
// that come directly from a user action.
export function signInWithGoogle(clientId: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) {
      reject(new Error('Google sign-in is still loading. Try again in a second.'));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || 'Sign-in was cancelled.'));
          return;
        }
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          });
          if (!res.ok) throw new Error('Could not load your Google profile.');
          const info = (await res.json()) as UserInfo;
          resolve({ id: info.sub, email: info.email, name: info.name || info.email, picture: info.picture });
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Sign-in failed.'));
        }
      },
      error_callback: (err) => reject(new Error(err.type === 'popup_closed' ? 'Sign-in popup was closed.' : err.message || 'Sign-in failed.')),
    });
    client.requestAccessToken();
  });
}

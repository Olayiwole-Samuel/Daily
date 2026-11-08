import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Target, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { GOOGLE_CLIENT_ID, loadGoogleScript } from '../auth/google';

// Google's multicolour "G", as Google's sign-in button guidelines ask for.
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const PERKS = [
  { icon: Target, text: 'Daily checklist from your weekly plan', color: '#00f0ff' },
  { icon: Flame, text: 'Streaks that keep you locked in', color: '#ff8a00' },
  { icon: Zap, text: 'Progress you can actually see', color: '#39ff14' },
];

export default function LoginPage() {
  const { signIn, signInDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google's script right away so the popup opens instantly when tapped.
  useEffect(() => {
    if (GOOGLE_CLIENT_ID) loadGoogleScript().catch((e: Error) => setError(e.message));
  }, []);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        className="card w-full max-w-sm space-y-6 p-7 text-center"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.1 }}
      >
        <motion.div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-pink via-neon-violet to-neon-cyan shadow-neon-pink"
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <Sparkles className="h-8 w-8 text-white" aria-hidden />
        </motion.div>

        <div>
          <h1 className="font-neon text-3xl leading-snug tracking-wide">
            <span className="neon-text text-neon-pink">WEEKLY</span> <span className="neon-text text-neon-cyan">GOALS</span>
          </h1>
          <p className="muted mt-2">Sign in to start your streak.</p>
        </div>

        <ul className="space-y-2 text-left">
          {PERKS.map(({ icon: Icon, text, color }, i) => (
            <motion.li
              key={text}
              className="flex items-center gap-3 rounded-2xl bg-violet-100/60 px-3 py-2 text-sm font-medium dark:bg-white/5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.12 }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color, filter: `drop-shadow(0 0 6px ${color})` }} aria-hidden />
              {text}
            </motion.li>
          ))}
        </ul>

        {GOOGLE_CLIENT_ID ? (
          <button
            type="button"
            onClick={handleSignIn}
            disabled={busy}
            className="btn group relative w-full overflow-hidden bg-white text-base text-slate-800 shadow-neon-cyan hover:shadow-neon-pink"
          >
            {/* sheen that sweeps across on hover */}
            <span className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent transition-transform duration-700 group-hover:translate-x-[300%]" aria-hidden />
            <GoogleG />
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-left text-sm">
            <p className="font-semibold text-amber-600 dark:text-amber-300">Google sign-in isn't set up yet</p>
            <p className="muted">
              Add <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to a <code className="font-mono">.env.local</code> file (see the README), then restart the dev server.
            </p>
            {import.meta.env.DEV && (
              <button type="button" className="btn-secondary w-full" onClick={signInDemo}>
                Continue in dev mode
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-500 dark:text-red-400">
            {error}
          </p>
        )}

        <p className="muted text-xs">Your goals are saved on this device, separately for each Google account.</p>
      </motion.div>
    </main>
  );
}

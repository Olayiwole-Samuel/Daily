import { useRef, useState, type ChangeEvent } from 'react';
import { Download, LogOut, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { AppState, Theme } from '../types';
import { useApp } from '../state/AppContext';
import { isAppState, normalizeState } from '../state/storage';
import { todayISO } from '../lib/dates';
import ConfirmDialog from '../components/ConfirmDialog';
import SegmentedControl from '../components/SegmentedControl';

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const { user, signOut } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function exportData() {
    // Build a file in memory and "click" a temporary link to download it.
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-goals-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: 'Backup downloaded.' });
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires onChange
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAppState(parsed)) {
        setMessage({ text: "That file doesn't look like a Weekly Goals backup.", error: true });
        return;
      }
      setPendingImport(normalizeState(parsed)); // ask before replacing everything
    } catch {
      setMessage({ text: "Couldn't read that file. Is it a .json backup?", error: true });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Settings</h1>

      <section className="card flex items-center gap-4" aria-labelledby="account-heading">
        {user?.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full ring-2 ring-neon-cyan shadow-neon-cyan" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan text-xl font-bold text-white" aria-hidden>
            {user?.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="account-heading" className="truncate font-bold">
            {user?.name}
          </h2>
          <p className="muted truncate text-sm">{user?.demo ? 'Dev mode (not signed in to Google)' : user?.email}</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={signOut}>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </section>

      <section className="card" aria-labelledby="theme-heading">
        <h2 id="theme-heading" className="mb-3 font-semibold">
          Theme
        </h2>
        <SegmentedControl
          label="Theme"
          value={state.settings.theme}
          onChange={(theme) => dispatch({ type: 'SET_THEME', theme })}
          options={THEMES.map(({ value, label, icon: Icon }) => ({
            value,
            label: (
              <>
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </>
            ),
          }))}
        />
      </section>

      <section className="card space-y-3" aria-labelledby="data-heading">
        <h2 id="data-heading" className="font-semibold">
          Your data
        </h2>
        <p className="muted text-sm">
          Everything is saved in this browser only. Export a backup now and then, and import it on another device or after clearing your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportData}>
            <Download className="h-4 w-4" aria-hidden /> Export JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Import JSON
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={onFileChosen} aria-label="Choose a backup file" />
        </div>
        {message && (
          <p role="status" className={`text-sm font-medium ${message.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {message.text}
          </p>
        )}
      </section>

      <section className="card space-y-3 border-red-200 dark:border-red-900" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="font-semibold text-red-700 dark:text-red-400">
          Reset
        </h2>
        <p className="muted text-sm">Deletes all goals, entries, meals and rules from this browser.</p>
        <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
          <Trash2 className="h-4 w-4" aria-hidden /> Reset all data
        </button>
      </section>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace all data?"
        message={`This replaces everything here with the backup (${pendingImport?.goals.length ?? 0} goals, ${pendingImport?.entries.length ?? 0} entries). Export first if you want to keep the current data.`}
        confirmLabel="Import"
        danger
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) dispatch({ type: 'IMPORT', state: pendingImport });
          setPendingImport(null);
          setMessage({ text: 'Backup imported.' });
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        message="This deletes everything and can't be undone. Export a backup first if you might want it back."
        confirmLabel="Reset everything"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          dispatch({ type: 'RESET' });
          setConfirmReset(false);
          setMessage({ text: 'All data reset.' });
        }}
      />
    </div>
  );
}

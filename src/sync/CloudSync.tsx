import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { useAuth } from '../auth/AuthContext';
import { migrateState } from '../state/storage';
import { fromCloudData, mergeCloudData, toCloudData, type CloudData } from './shared';
import { pullCloud, pushCloud } from './client';
import type { AppState } from '../types';

// How cloud backup is doing right now, for the Settings screen.
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline';

const SyncContext = createContext<{ status: SyncStatus; lastSynced: Date | null; syncNow: () => void }>({
  status: 'off',
  lastSynced: null,
  syncNow: () => undefined,
});

export const useSyncStatus = () => useContext(SyncContext);

// What we last agreed with the server: its version number, and the exact JSON
// of the data at that point. If the current data's JSON differs, we have local
// changes that still need uploading.
interface SyncMeta {
  version: number | null;
  json: string | null;
}

const metaKey = (userId: string) => `weekly-goals-sync:${userId}`;

function loadMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(metaKey(userId));
    if (raw) return JSON.parse(raw) as SyncMeta;
  } catch {
    // ignore
  }
  return { version: null, json: null };
}

function saveMeta(userId: string, meta: SyncMeta) {
  try {
    localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch {
    // ignore: we'll just compare again next time
  }
}

// Cloud data from the server is checked and cleaned the same way as data
// loaded from this device, so a bad copy can never crash the app.
function clean(data: CloudData): CloudData {
  return toCloudData(migrateState(data as unknown as Record<string, unknown>));
}

const PUSH_DELAY_MS = 1500;
const PULL_EVERY_MS = 60_000;

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const { user, cloud, refreshCloud } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const enabled = cloud === 'connected' && !!user && !user.demo;
  const userId = user?.id ?? '';

  // Refs give the async sync code the latest values without restarting effects.
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const busy = useRef(false);
  const again = useRef(false);

  const apply = useCallback(
    (data: CloudData): string => {
      const next = fromCloudData(data, stateRef.current);
      dispatch({ type: 'IMPORT', state: next });
      stateRef.current = next;
      return JSON.stringify(toCloudData(next));
    },
    [dispatch],
  );

  // One full round: download if the cloud moved on, then upload our changes.
  const sync = useCallback(async () => {
    if (!enabled) return;
    if (busy.current) {
      again.current = true; // run once more when the current round finishes
      return;
    }
    busy.current = true;
    setStatus('syncing');
    try {
      let meta = loadMeta(userId);
      const localJson = () => JSON.stringify(toCloudData(stateRef.current));

      const pulled = await pullCloud();
      if (pulled.kind === 'signedOut') {
        await refreshCloud();
        return setStatus('off');
      }
      if (pulled.kind === 'unavailable') return setStatus('offline');

      if (pulled.kind === 'data' && pulled.version !== meta.version) {
        const remote = clean(pulled.data);
        const dirty = localJson() !== meta.json;
        // No local changes: just take the cloud copy. Otherwise combine both.
        const json = apply(dirty ? mergeCloudData(toCloudData(stateRef.current), remote) : remote);
        meta = { version: pulled.version, json: dirty ? meta.json : json };
        saveMeta(userId, meta);
      }

      // Upload local changes (up to 3 tries if another device keeps saving first).
      // Nothing in the cloud yet means this is a first save (no base version).
      let base: number | null = pulled.kind === 'empty' ? null : meta.version;
      for (let attempt = 0; attempt < 3 && localJson() !== meta.json; attempt++) {
        const data = toCloudData(stateRef.current);
        const pushed = await pushCloud(data, base);
        if (pushed.kind === 'saved') {
          meta = { version: pushed.version, json: JSON.stringify(data) };
          base = pushed.version;
          saveMeta(userId, meta);
        } else if (pushed.kind === 'conflict' && pushed.data) {
          apply(mergeCloudData(data, clean(pushed.data)));
          meta = { version: pushed.version, json: meta.json };
          base = pushed.version;
        } else if (pushed.kind === 'signedOut') {
          await refreshCloud();
          return setStatus('off');
        } else {
          return setStatus('offline');
        }
      }
      setStatus('synced');
      setLastSynced(new Date());
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        window.setTimeout(() => void sync(), 0);
      }
    }
  }, [enabled, userId, apply, refreshCloud]);

  // Sync on start, when the app comes back to the foreground, and every minute.
  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    void sync();
    const onVisible = () => document.visibilityState === 'visible' && void sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    const timer = window.setInterval(() => void sync(), PULL_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, sync]);

  // Upload shortly after any change (debounced, so typing doesn't spam the server).
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void sync(), PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, enabled, sync]);

  return <SyncContext.Provider value={{ status, lastSynced, syncNow: () => void sync() }}>{children}</SyncContext.Provider>;
}

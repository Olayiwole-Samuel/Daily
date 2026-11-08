import type { AppState } from '../types';
import { DEFAULT_EATING_RULES } from './template';

// Before sign-in existed, everything lived under this one key.
export const LEGACY_STORAGE_KEY = 'weekly-goals-v1';

// Each Google account gets its own slot, so two people on one device don't mix data.
export function storageKeyFor(userId: string): string {
  return `${LEGACY_STORAGE_KEY}:${userId}`;
}

export function createEmptyState(): AppState {
  return {
    version: 1,
    goals: [],
    entries: [],
    food: [],
    eatingRules: [...DEFAULT_EATING_RULES],
    settings: { theme: 'dark' }, // neon looks best in the dark
    celebratedStreaks: {},
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Checks the overall shape of data from localStorage or an imported file.
// It is not a full schema check, but it catches wrong files and corrupted data,
// which is what matters before we replace everything the user has.
export function isAppState(value: unknown): value is AppState {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (!Array.isArray(value.goals) || !Array.isArray(value.entries) || !Array.isArray(value.food)) {
    return false;
  }
  if (!Array.isArray(value.eatingRules)) return false;
  if (!isObject(value.settings)) return false;
  const goalsOk = value.goals.every(
    (g) => isObject(g) && typeof g.id === 'string' && typeof g.title === 'string' && typeof g.type === 'string' && Array.isArray(g.scheduledDays),
  );
  const entriesOk = value.entries.every(
    (e) => isObject(e) && typeof e.goalId === 'string' && typeof e.date === 'string',
  );
  return goalsOk && entriesOk;
}

// Fills in any fields that may be missing (e.g. from a hand-edited file),
// so the rest of the app can trust the shape.
export function normalizeState(state: AppState): AppState {
  const theme = state.settings?.theme;
  return {
    ...createEmptyState(),
    ...state,
    settings: { theme: theme === 'light' || theme === 'dark' ? theme : 'system' },
    celebratedStreaks: isObject(state.celebratedStreaks) ? state.celebratedStreaks : {},
  };
}

export function loadState(key: string): AppState {
  try {
    // First sign-in on a device that already had data: adopt the old data.
    const raw = localStorage.getItem(key) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed: unknown = JSON.parse(raw);
    // Future versions would migrate older shapes here, based on parsed.version.
    return isAppState(parsed) ? normalizeState(parsed) : createEmptyState();
  } catch {
    // localStorage can be blocked (private mode) or hold broken JSON.
    return createEmptyState();
  }
}

export function saveState(key: string, state: AppState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    // The old shared slot has been adopted by this account; remove it so a
    // second account on this device doesn't adopt the same data.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage full or blocked: the app still works for this session.
  }
}

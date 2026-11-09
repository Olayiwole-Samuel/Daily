import { z } from 'zod';
import type { AppState, SavedPhoto } from '../types';
import { DEFAULT_EATING_RULES } from './template';
import { CoachPlanSchema, CoachProfileSchema, WeighInSchema, WorkoutSessionSchema } from '../coach/schema';

// Before sign-in existed, everything lived under this one key.
export const LEGACY_STORAGE_KEY = 'weekly-goals-v1';

// Each Google account gets its own slot, so two people on one device don't mix data.
export function storageKeyFor(userId: string): string {
  return `${LEGACY_STORAGE_KEY}:${userId}`;
}

export function createEmptyState(): AppState {
  return {
    version: 2,
    goals: [],
    entries: [],
    food: [],
    eatingRules: [...DEFAULT_EATING_RULES],
    settings: { theme: 'dark' }, // neon looks best in the dark
    celebratedStreaks: {},
    sessions: [],
    weighIns: [],
    savedPhotos: [],
    groceryChecked: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Checks the overall shape of data from localStorage or an imported file
// (version 1 or 2). It catches wrong files and corrupted data, which is what
// matters before we replace everything the user has.
export function isStoredState(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  if (value.version !== 1 && value.version !== 2) return false;
  if (!Array.isArray(value.goals) || !Array.isArray(value.entries) || !Array.isArray(value.food)) {
    return false;
  }
  if (!Array.isArray(value.eatingRules)) return false;
  if (!isObject(value.settings)) return false;
  const goalsOk = value.goals.every(
    (g) => isObject(g) && typeof g.id === 'string' && typeof g.title === 'string' && typeof g.type === 'string' && Array.isArray(g.scheduledDays),
  );
  const entriesOk = value.entries.every((e) => isObject(e) && typeof e.goalId === 'string' && typeof e.date === 'string');
  return goalsOk && entriesOk;
}

// Keeps only the items of a list that match the schema, so one corrupted
// item doesn't wipe out the rest.
function validItems<T>(schema: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

function validOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

const SavedPhotoSchema: z.ZodType<SavedPhoto> = z.object({ id: z.string(), date: z.string(), dataUrl: z.string() });

// MIGRATION: turns any stored version (1 or 2) into the current version 2.
// Version 1 had no coach data, so those fields start empty. Coach fields are
// validated with zod, since a plan that doesn't match the schema would crash screens.
export function migrateState(stored: Record<string, unknown>): AppState {
  const empty = createEmptyState();
  const settings = isObject(stored.settings) ? stored.settings : {};
  const theme = settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system' ? settings.theme : 'dark';

  return {
    ...empty,
    // Part 1 fields were checked by isStoredState.
    goals: stored.goals as AppState['goals'],
    entries: stored.entries as AppState['entries'],
    food: stored.food as AppState['food'],
    eatingRules: (stored.eatingRules as unknown[]).filter((r): r is string => typeof r === 'string'),
    settings: { theme },
    celebratedStreaks: isObject(stored.celebratedStreaks) ? (stored.celebratedStreaks as Record<string, number>) : {},
    // Coach fields (absent in version 1).
    coachProfile: validOptional(CoachProfileSchema, stored.coachProfile),
    coachPlan: validOptional(CoachPlanSchema, stored.coachPlan),
    sessions: validItems(WorkoutSessionSchema, stored.sessions),
    activeSession: validOptional(WorkoutSessionSchema, stored.activeSession),
    weighIns: validItems(WeighInSchema, stored.weighIns),
    workoutGoalId: typeof stored.workoutGoalId === 'string' ? stored.workoutGoalId : undefined,
    savedPhotos: validItems(SavedPhotoSchema, stored.savedPhotos),
    groceryChecked: Array.isArray(stored.groceryChecked) ? stored.groceryChecked.filter((k): k is string => typeof k === 'string') : [],
  };
}

export function loadState(key: string): AppState {
  try {
    // First sign-in on a device that already had data: adopt the old data.
    const raw = localStorage.getItem(key) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed: unknown = JSON.parse(raw);
    return isStoredState(parsed) ? migrateState(parsed) : createEmptyState();
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

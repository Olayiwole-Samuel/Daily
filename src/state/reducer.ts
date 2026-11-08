import type { AppState, Entry, FoodEntry, Goal, ISODate, Meal, Theme } from '../types';
import { newId } from '../lib/dates';
import { createTemplateGoals } from './template';
import { createEmptyState } from './storage';

// Every way the state can change. A "discriminated union": the `type` field
// tells TypeScript exactly which payload shape goes with which action.
export type Action =
  | { type: 'ADD_GOAL'; goal: Goal }
  | { type: 'UPDATE_GOAL'; goal: Goal }
  | { type: 'ARCHIVE_GOAL'; goalId: string; archived: boolean }
  | { type: 'LOAD_TEMPLATE'; today: ISODate }
  | { type: 'SET_ENTRY'; goalId: string; date: ISODate; patch: Pick<Entry, 'done' | 'value' | 'text'> }
  | { type: 'TOGGLE_MILESTONE'; goalId: string; milestoneId: string; date: ISODate }
  | { type: 'SET_FOOD'; date: ISODate; meal: Meal; patch: Partial<Pick<FoodEntry, 'text' | 'onPlan'>> }
  | { type: 'SET_EATING_RULES'; rules: string[] }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'MARK_CELEBRATED'; key: string; milestone: number }
  | { type: 'IMPORT'; state: AppState }
  | { type: 'RESET' };

// An entry with nothing in it means "not done", so we drop it instead of storing noise.
function isEmptyEntry(e: Entry): boolean {
  return !e.done && !e.value && !(e.text && e.text.trim());
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, action.goal] };

    case 'UPDATE_GOAL':
      return { ...state, goals: state.goals.map((g) => (g.id === action.goal.id ? action.goal : g)) };

    case 'ARCHIVE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.goalId ? { ...g, archived: action.archived } : g)),
      };

    case 'LOAD_TEMPLATE':
      return { ...state, goals: [...state.goals, ...createTemplateGoals(action.today)] };

    case 'SET_ENTRY': {
      // One entry per goal per day: update it if it exists, otherwise create it.
      const existing = state.entries.find((e) => e.goalId === action.goalId && e.date === action.date);
      const next: Entry = existing
        ? { ...existing, ...action.patch }
        : { id: newId(), goalId: action.goalId, date: action.date, ...action.patch };
      const others = state.entries.filter((e) => e !== existing);
      return { ...state, entries: isEmptyEntry(next) ? others : [...others, next] };
    }

    case 'TOGGLE_MILESTONE':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id !== action.goalId
            ? g
            : {
                ...g,
                milestones: (g.milestones ?? []).map((m) =>
                  m.id !== action.milestoneId
                    ? m
                    : // Ticking records the day it was finished; unticking clears it.
                      { ...m, doneDate: m.doneDate ? undefined : action.date },
                ),
              },
        ),
      };

    case 'SET_FOOD': {
      const existing = state.food.find((f) => f.date === action.date && f.meal === action.meal);
      const next: FoodEntry = existing
        ? { ...existing, ...action.patch }
        : { id: newId(), date: action.date, meal: action.meal, text: '', onPlan: false, ...action.patch };
      return { ...state, food: [...state.food.filter((f) => f !== existing), next] };
    }

    case 'SET_EATING_RULES':
      return { ...state, eatingRules: action.rules };

    case 'SET_THEME':
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case 'MARK_CELEBRATED':
      return { ...state, celebratedStreaks: { ...state.celebratedStreaks, [action.key]: action.milestone } };

    case 'IMPORT':
      return action.state;

    case 'RESET':
      return createEmptyState();
  }
}

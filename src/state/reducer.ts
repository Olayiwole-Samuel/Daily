import type { AppState, Entry, FoodEntry, Goal, ISODate, Meal, SavedPhoto, Theme } from '../types';
import type { CoachPlan, CoachProfile, WeighIn, WorkoutSession } from '../coach/schema';
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
  | { type: 'RESET' }
  // ----- AI Coach -----
  | { type: 'SET_COACH_PROFILE'; profile: CoachProfile }
  | { type: 'SET_COACH_PLAN'; plan: CoachPlan }
  | { type: 'SET_WORKOUT_GOAL'; goalId: string | undefined }
  | { type: 'SAVE_ACTIVE_SESSION'; session: WorkoutSession | undefined }
  | { type: 'FINISH_SESSION'; session: WorkoutSession }
  | { type: 'ADD_WEIGH_IN'; weighIn: WeighIn }
  | { type: 'DELETE_WEIGH_IN'; id: string }
  | { type: 'SAVE_PHOTO'; photo: SavedPhoto }
  | { type: 'DELETE_PHOTOS' }
  | { type: 'TOGGLE_GROCERY'; key: string }
  | { type: 'RESET_COACH' };

// Upserts the one entry for goal+date (shared by SET_ENTRY and finishing a workout).
function setEntry(state: AppState, goalId: string, date: ISODate, patch: Pick<Entry, 'done' | 'value' | 'text'>): AppState {
  const existing = state.entries.find((e) => e.goalId === goalId && e.date === date);
  const next: Entry = existing ? { ...existing, ...patch } : { id: newId(), goalId, date, ...patch };
  const others = state.entries.filter((e) => e !== existing);
  return { ...state, entries: isEmptyEntry(next) ? others : [...others, next] };
}

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

    case 'SET_ENTRY':
      // One entry per goal per day: update it if it exists, otherwise create it.
      return setEntry(state, action.goalId, action.date, action.patch);

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

    // ----- AI Coach -----

    case 'SET_COACH_PROFILE':
      return { ...state, coachProfile: action.profile };

    case 'SET_COACH_PLAN': {
      // Link the Workout goal automatically the first time: a goal titled "Workout".
      const autoGoal = state.goals.find((g) => !g.archived && /workout/i.test(g.title));
      return {
        ...state,
        coachPlan: action.plan,
        workoutGoalId: state.workoutGoalId ?? autoGoal?.id,
        groceryChecked: [], // new plan, new grocery list
        activeSession: undefined, // its routine ids may no longer exist
      };
    }

    case 'SET_WORKOUT_GOAL':
      return { ...state, workoutGoalId: action.goalId };

    case 'SAVE_ACTIVE_SESSION':
      return { ...state, activeSession: action.session };

    case 'FINISH_SESSION': {
      const withSession: AppState = {
        ...state,
        sessions: [...state.sessions, action.session],
        activeSession: undefined,
      };
      // Tick the Part 1 Workout goal for that day, so weekly progress and streaks update.
      return state.workoutGoalId ? setEntry(withSession, state.workoutGoalId, action.session.date, { done: true }) : withSession;
    }

    case 'ADD_WEIGH_IN':
      // One weigh-in per day: a second one the same day replaces the first.
      return { ...state, weighIns: [...state.weighIns.filter((w) => w.date !== action.weighIn.date), action.weighIn] };

    case 'DELETE_WEIGH_IN':
      return { ...state, weighIns: state.weighIns.filter((w) => w.id !== action.id) };

    case 'SAVE_PHOTO':
      // Keep at most 6 photos so localStorage (about 5 MB) doesn't fill up.
      return { ...state, savedPhotos: [...state.savedPhotos, action.photo].slice(-6) };

    case 'DELETE_PHOTOS':
      return { ...state, savedPhotos: [] };

    case 'TOGGLE_GROCERY':
      return {
        ...state,
        groceryChecked: state.groceryChecked.includes(action.key)
          ? state.groceryChecked.filter((k) => k !== action.key)
          : [...state.groceryChecked, action.key],
      };

    case 'RESET_COACH':
      return {
        ...state,
        coachProfile: undefined,
        coachPlan: undefined,
        sessions: [],
        activeSession: undefined,
        weighIns: [],
        savedPhotos: [],
        groceryChecked: [],
      };
  }
}

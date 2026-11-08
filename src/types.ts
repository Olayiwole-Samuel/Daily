// All the shapes of data the app works with, in one place.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday
export type GoalType = 'daily' | 'weeklyCount' | 'numberTarget' | 'milestones' | 'journal';
export type ISODate = string; // 'YYYY-MM-DD' in local time

export interface Milestone {
  id: string;
  title: string;
  plannedDate?: ISODate;
  doneDate?: ISODate;
}

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  color: string; // hex
  scheduledDays: Weekday[]; // which days it shows on Today
  target?: number; // weeklyCount: 5, numberTarget: 150
  unit?: string; // 'pages', 'min'
  note?: string; // '6:00am'
  milestones?: Milestone[];
  archived: boolean;
  createdAt: ISODate;
}

export interface Entry {
  id: string;
  goalId: string;
  date: ISODate;
  done?: boolean; // daily, weeklyCount
  value?: number; // numberTarget
  text?: string; // journal
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  date: ISODate;
  meal: Meal;
  text: string;
  onPlan: boolean;
}

export interface StreakInfo {
  current: number;
  best: number;
  unit: 'days' | 'weeks';
  aliveToday: boolean; // streak continues if today gets done
}

export type Theme = 'light' | 'dark' | 'system';

export interface AppState {
  version: 1;
  goals: Goal[];
  entries: Entry[];
  food: FoodEntry[];
  eatingRules: string[];
  settings: { theme: Theme };
  celebratedStreaks: Record<string, number>; // goalId -> last milestone celebrated
}

// Human-friendly labels, used by forms and cards.
export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  daily: 'Daily habit',
  weeklyCount: 'Weekly count',
  numberTarget: 'Number target',
  milestones: 'Milestones',
  journal: 'Journal',
};

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

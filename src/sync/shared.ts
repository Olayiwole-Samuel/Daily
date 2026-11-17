// Cloud sync + reminder logic shared by the app and the server functions.
// Pure functions only (no browser or database access), so they're easy to test.
// Type-only imports are erased when compiled, so the server can use this file.
import type { AppState, Entry, Goal, ISODate } from '../types.js';

// ---------- What goes to the cloud ----------

// Everything except progress photos, which stay on the device for privacy.
export type CloudData = Omit<AppState, 'savedPhotos'>;

export function toCloudData(state: AppState): CloudData {
  const { savedPhotos, ...rest } = state;
  return rest;
}

// Applies cloud data on this device, keeping the photos that only live here.
export function fromCloudData(data: CloudData, local: AppState): AppState {
  return { ...data, savedPhotos: local.savedPhotos };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A light shape check for data arriving at the server or from the server.
export function isCloudData(value: unknown): value is CloudData {
  if (!isObject(value) || value.version !== 2) return false;
  const arrays = ['goals', 'entries', 'food', 'eatingRules', 'sessions', 'weighIns'];
  return arrays.every((key) => Array.isArray(value[key])) && isObject(value.settings);
}

// ---------- Merging two devices' changes ----------

function unionBy<T>(local: T[], remote: T[], key: (item: T) => string, pick: (local: T, remote: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(key(item), item);
  for (const item of local) {
    const k = key(item);
    const existing = map.get(k);
    map.set(k, existing ? pick(item, existing) : item);
  }
  return [...map.values()];
}

// "Most progress wins" for the same goal on the same day.
function progress(e: Entry): number {
  return (e.done ? 1000 : 0) + (e.value ?? 0) + (e.text?.trim().length ?? 0);
}

// Used only when two devices changed things at the same time (e.g. both offline).
// Lists are combined so nothing logged on either device is lost; for single
// values (settings, coach plan) the cloud copy, which is newer, wins.
export function mergeCloudData(local: CloudData, remote: CloudData): CloudData {
  return {
    ...remote,
    goals: unionBy(local.goals, remote.goals, (g) => g.id, (_l, r) => r),
    entries: unionBy(local.entries, remote.entries, (e) => `${e.goalId}|${e.date}`, (l, r) => (progress(l) >= progress(r) ? l : r)),
    food: unionBy(local.food, remote.food, (f) => `${f.date}|${f.meal}`, (l, r) => (l.text.trim() ? l : r)),
    sessions: unionBy(local.sessions, remote.sessions, (s) => s.id, (l, r) => (l.finishedAt ? l : r)),
    weighIns: unionBy(local.weighIns, remote.weighIns, (w) => w.date, (l) => l),
    groceryChecked: [...new Set([...local.groceryChecked, ...remote.groceryChecked])],
    stoppedTakeovers: [...new Set([...(local.stoppedTakeovers ?? []), ...(remote.stoppedTakeovers ?? [])])],
  };
}

// ---------- Goal reminders ----------

export interface Reminder {
  goalId: string;
  title: string;
  time: string; // 'HH:MM'
  days: number[]; // 0 = Monday
}

export function remindersFromGoals(goals: Goal[]): Reminder[] {
  return goals
    .filter((g) => !g.archived && g.reminderTime && /^\d{2}:\d{2}$/.test(g.reminderTime))
    .map((g) => ({ goalId: g.id, title: g.title, time: g.reminderTime!, days: g.scheduledDays }));
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// The date, weekday (0 = Monday) and minute of the day in a given time zone.
export function localParts(now: Date, timeZone: string): { date: ISODate; weekday: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hour = Number(parts.hour) % 24; // some engines print midnight as 24
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: weekdays.indexOf(parts.weekday), minutes: hour * 60 + Number(parts.minute) };
}

export function isGoalDone(entries: Entry[], goalId: string, date: ISODate): boolean {
  const e = entries.find((x) => x.goalId === goalId && x.date === date);
  return !!e && (!!e.done || (e.value ?? 0) > 0 || !!e.text?.trim());
}

// Is this reminder's time now (within a 10-minute window, so a late scheduler
// tick still catches it), on a scheduled day, and the goal not done or stopped?
export function isReminderDue(
  reminder: Reminder,
  now: Date,
  timeZone: string,
  data: Pick<CloudData, 'entries' | 'stoppedTakeovers'> | null,
  windowMinutes = 10,
): { due: boolean; localDate: ISODate } {
  const local = localParts(now, timeZone);
  const start = toMinutes(reminder.time);
  const inWindow = local.minutes >= start && local.minutes < start + windowMinutes;
  const scheduled = reminder.days.includes(local.weekday);
  const handled =
    !!data && (isGoalDone(data.entries, reminder.goalId, local.date) || (data.stoppedTakeovers ?? []).includes(`${reminder.goalId}|${local.date}`));
  return { due: inWindow && scheduled && !handled, localDate: local.date };
}

// For the in-app takeover: goals whose time has passed today and aren't done or stopped.
export function overdueGoals(goals: Goal[], entries: Entry[], stopped: string[], today: ISODate, weekday: number, minutesNow: number): Goal[] {
  return goals.filter(
    (g) =>
      !g.archived &&
      !!g.reminderTime &&
      g.scheduledDays.includes(weekday as Goal['scheduledDays'][number]) &&
      toMinutes(g.reminderTime) <= minutesNow &&
      !isGoalDone(entries, g.id, today) &&
      !stopped.includes(`${g.id}|${today}`),
  );
}

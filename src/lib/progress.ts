import type { Entry, Goal, ISODate, Milestone } from '../types';
import { weekDays, weekStart, weekdayIndex } from './dates';

// ---------- Fast lookup of entries ----------

// Many functions ask "what is the entry for goal X on date Y?" for hundreds of days.
// Scanning the whole array each time would be slow, so we build a Map once per
// entries array. A WeakMap cache means the Map is rebuilt only when the array changes
// (the reducer always creates a new array on change).
const indexCache = new WeakMap<Entry[], Map<string, Entry>>();

function entryIndex(entries: Entry[]): Map<string, Entry> {
  let index = indexCache.get(entries);
  if (!index) {
    index = new Map(entries.map((e) => [`${e.goalId}|${e.date}`, e]));
    indexCache.set(entries, index);
  }
  return index;
}

export function getEntry(entries: Entry[], goalId: string, date: ISODate): Entry | undefined {
  return entryIndex(entries).get(`${goalId}|${date}`);
}

// ---------- Scheduling ----------

// The weekly target. Daily-style goals have no explicit target, so other code
// uses the number of scheduled days instead.
export function weeklyTarget(goal: Goal): number {
  return goal.target && goal.target > 0 ? goal.target : 1;
}

// First day this goal "exists". Usually createdAt, but imported history can be older.
export function goalStartDate(goal: Goal, entries: Entry[]): ISODate {
  let start = goal.createdAt;
  for (const e of entries) {
    if (e.goalId === goal.id && e.date < start) start = e.date;
  }
  for (const m of goal.milestones ?? []) {
    if (m.plannedDate && m.plannedDate < start) start = m.plannedDate;
  }
  return start;
}

// Is this goal on the plan for that weekday? (Ignores archive and milestone detail.)
export function isScheduledOn(goal: Goal, date: ISODate): boolean {
  return goal.scheduledDays.includes(weekdayIndex(date));
}

// Goals scheduled on that weekday and not archived.
export function getGoalsForDate(goals: Goal[], date: ISODate): Goal[] {
  return goals.filter((g) => !g.archived && isScheduledOn(g, date));
}

// ---------- Milestones ----------

// Milestones to show on a given day: planned for that day, plus overdue ones that
// were still unfinished on that day, plus unfinished ones with no planned date.
export function milestonesForDate(goal: Goal, date: ISODate): Milestone[] {
  return (goal.milestones ?? []).filter((m) => {
    const unfinishedOnDate = !m.doneDate || m.doneDate >= date;
    if (!m.plannedDate) return unfinishedOnDate;
    if (m.plannedDate === date) return true;
    return m.plannedDate < date && unfinishedOnDate;
  });
}

// Milestones that "count" on a day: only ones with a planned date (today's + overdue).
function dueMilestones(goal: Goal, date: ISODate): Milestone[] {
  return milestonesForDate(goal, date).filter((m) => m.plannedDate);
}

// ---------- Done-ness ----------

// Sum or count for a weekly goal from Monday up to and including `upTo`.
export function weekTotal(goal: Goal, entries: Entry[], weekStartIso: ISODate, upTo?: ISODate): number {
  let total = 0;
  for (const day of weekDays(weekStartIso)) {
    if (upTo && day > upTo) break;
    const e = getEntry(entries, goal.id, day);
    if (!e) continue;
    total += goal.type === 'numberTarget' ? e.value ?? 0 : e.done ? 1 : 0;
  }
  return total;
}

// Did the user do this goal on this day?
// For weekly goals, a day also counts as done once the weekly target was already
// reached earlier that week, so a planned rest day doesn't ruin a perfect day.
export function isGoalDoneOnDate(goal: Goal, entries: Entry[], date: ISODate): boolean {
  const e = getEntry(entries, goal.id, date);
  switch (goal.type) {
    case 'daily':
      return !!e?.done;
    case 'journal':
      return !!e?.text?.trim();
    case 'weeklyCount':
    case 'numberTarget': {
      const didSomething = goal.type === 'weeklyCount' ? !!e?.done : (e?.value ?? 0) > 0;
      return didSomething || weekTotal(goal, entries, weekStart(date), date) >= weeklyTarget(goal);
    }
    case 'milestones': {
      const due = dueMilestones(goal, date);
      return due.length > 0 && due.every((m) => m.doneDate !== undefined && m.doneDate <= date);
    }
  }
}

// Should this goal count toward the day's "X of Y done"?
// Same as scheduled, except milestone goals only count when something is due,
// and nothing counts before the goal existed.
export function isGoalDueOnDate(goal: Goal, entries: Entry[], date: ISODate): boolean {
  if (goal.archived || !isScheduledOn(goal, date)) return false;
  if (date < goalStartDate(goal, entries)) return false;
  if (goal.type === 'milestones') return dueMilestones(goal, date).length > 0;
  return true;
}

export function getDueGoals(goals: Goal[], entries: Entry[], date: ISODate): Goal[] {
  return goals.filter((g) => isGoalDueOnDate(g, entries, date));
}

// ---------- Week progress ----------

export interface WeekProgress {
  actual: number;
  target: number;
  expected: number; // how much "should" be done by now for an even pace
  onTrack: boolean;
}

export function getWeekProgress(goal: Goal, entries: Entry[], weekStartIso: ISODate, today: ISODate): WeekProgress {
  // Only days on or after the goal's start count, so a goal added on Sunday
  // isn't "behind" for the Monday–Saturday before it existed.
  const start = goalStartDate(goal, entries);
  const days = weekDays(weekStartIso).filter((d) => d >= start);
  // Days already over (today isn't over yet, so it doesn't count).
  const elapsed = days.filter((d) => d < today).length;
  const weekOver = weekDays(weekStartIso)[6] < today;
  let actual: number;
  let target: number;
  let expected: number;

  switch (goal.type) {
    case 'daily':
    case 'journal': {
      // Target = scheduled days this week; expected = scheduled days already over.
      const scheduled = days.filter((d) => isScheduledOn(goal, d));
      actual = scheduled.filter((d) => isGoalDoneOnDate(goal, entries, d)).length;
      target = scheduled.length;
      expected = scheduled.filter((d) => d < today).length;
      break;
    }
    case 'weeklyCount':
    case 'numberTarget':
      actual = weekTotal(goal, entries, weekStartIso);
      // A week entirely before the goal existed has nothing to aim for.
      target = days.length === 0 ? 0 : weeklyTarget(goal);
      // Even pace: e.g. 150 pages over 7 days, 3 days over -> ~64 expected.
      expected = days.length === 0 ? 0 : Math.floor((target * elapsed) / days.length);
      break;
    case 'milestones': {
      const planned = (goal.milestones ?? []).filter((m) => m.plannedDate && days.includes(m.plannedDate));
      actual = planned.filter((m) => m.doneDate).length;
      target = planned.length;
      expected = planned.filter((m) => m.plannedDate! < today).length;
      break;
    }
  }

  // A ternary keeps the rule readable: past/finished weeks need the full target.
  const onTrack = weekOver ? actual >= target : actual >= expected;
  return { actual, target, expected, onTrack };
}

// State of one day in the 7-dot week grid.
export type DayStatus = 'done' | 'missed' | 'today' | 'future' | 'off';

export function getDayStatus(goal: Goal, entries: Entry[], date: ISODate, today: ISODate): DayStatus {
  const done = isGoalDoneOnDate(goal, entries, date);
  // Weekly goals can be ticked on any day, so show real activity, not "target met".
  const didThatDay =
    goal.type === 'weeklyCount'
      ? !!getEntry(entries, goal.id, date)?.done
      : goal.type === 'numberTarget'
        ? (getEntry(entries, goal.id, date)?.value ?? 0) > 0
        : done;
  if (didThatDay) return 'done';
  if (!isScheduledOn(goal, date) || date < goalStartDate(goal, entries)) return 'off';
  if (goal.type === 'milestones' && !isGoalDueOnDate(goal, entries, date)) return 'off';
  if (date > today) return 'future';
  if (date === today) return 'today';
  // Rest day on a weekly goal after the target was hit isn't a miss.
  return done ? 'done' : 'missed';
}

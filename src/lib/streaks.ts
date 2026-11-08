import type { Entry, Goal, ISODate, StreakInfo } from '../types';
import { addDaysISO, weekStart } from './dates';
import {
  getDueGoals,
  goalStartDate,
  isGoalDoneOnDate,
  isScheduledOn,
  weekTotal,
  weeklyTarget,
} from './progress';

export const STREAK_MILESTONES = [3, 7, 14, 30];

// Walks day by day from `start` to `today` and counts runs of done days.
// `isCounted(date)` says whether a day matters at all (unscheduled days are skipped,
// so they neither add to nor break a streak). Today is special: if it isn't done
// yet the day isn't over, so the streak stays "alive" instead of breaking.
function walkDays(
  start: ISODate,
  today: ISODate,
  isCounted: (date: ISODate) => boolean,
  isDone: (date: ISODate) => boolean,
): StreakInfo {
  let run = 0;
  let best = 0;
  let aliveToday = false;

  for (let date = start; date <= today; date = addDaysISO(date, 1)) {
    if (!isCounted(date)) continue;
    if (isDone(date)) {
      run += 1;
      best = Math.max(best, run);
    } else if (date === today) {
      aliveToday = true; // still time to do it today
    } else {
      run = 0; // a missed scheduled day breaks the streak
    }
  }
  return { current: run, best, unit: 'days', aliveToday };
}

// Same idea as walkDays, but each step is a whole week and "done" = target hit.
function walkWeeks(goal: Goal, entries: Entry[], start: ISODate, today: ISODate): StreakInfo {
  const thisWeek = weekStart(today);
  const target = weeklyTarget(goal);
  let run = 0;
  let best = 0;
  let aliveToday = false;

  for (let week = weekStart(start); week <= thisWeek; week = addDaysISO(week, 7)) {
    if (weekTotal(goal, entries, week) >= target) {
      run += 1;
      best = Math.max(best, run);
    } else if (week === thisWeek) {
      aliveToday = true; // the current week isn't over yet
    } else {
      run = 0;
    }
  }
  return { current: run, best, unit: 'weeks', aliveToday };
}

// Streak for one goal, or null for goal types that don't have streaks (milestones).
export function getStreak(goal: Goal, entries: Entry[], today: ISODate): StreakInfo | null {
  const start = goalStartDate(goal, entries);
  if (start > today) return { current: 0, best: 0, unit: 'days', aliveToday: false };

  switch (goal.type) {
    case 'daily':
    case 'journal':
      return walkDays(
        start,
        today,
        (d) => isScheduledOn(goal, d),
        (d) => isGoalDoneOnDate(goal, entries, d),
      );
    case 'weeklyCount':
    case 'numberTarget':
      return walkWeeks(goal, entries, start, today);
    case 'milestones':
      return null;
  }
}

// Consecutive days where every goal due that day was done.
// Days with nothing due are skipped (they don't break the streak).
export function getPerfectDayStreak(goals: Goal[], entries: Entry[], today: ISODate): StreakInfo {
  const active = goals.filter((g) => !g.archived);
  if (active.length === 0) return { current: 0, best: 0, unit: 'days', aliveToday: false };
  const start = active.map((g) => goalStartDate(g, entries)).reduce((a, b) => (a < b ? a : b));

  return walkDays(
    start,
    today,
    (d) => getDueGoals(active, entries, d).length > 0,
    (d) => getDueGoals(active, entries, d).every((g) => isGoalDoneOnDate(g, entries, d)),
  );
}

// The highest milestone (3/7/14/30) at or below `count`, or 0.
export function milestoneReached(count: number): number {
  return STREAK_MILESTONES.filter((m) => count >= m).pop() ?? 0;
}

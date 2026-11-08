import { describe, expect, it } from 'vitest';
import type { Entry, Goal, Weekday } from '../types';
import { ALL_DAYS, addDaysISO, weekStart, weekdayIndex } from './dates';
import {
  getDayStatus,
  getGoalsForDate,
  getWeekProgress,
  isGoalDoneOnDate,
  isGoalDueOnDate,
  milestonesForDate,
} from './progress';

const MON = '2026-11-09';
const d = (offset: number) => addDaysISO(MON, offset);

function goal(partial: Partial<Goal> & Pick<Goal, 'type'>): Goal {
  return {
    id: 'g1',
    title: 'Test',
    color: '#000000',
    scheduledDays: ALL_DAYS,
    archived: false,
    createdAt: d(-7),
    ...partial,
  };
}

describe('dates', () => {
  it('uses Monday as weekday 0 and as the week start', () => {
    expect(weekdayIndex(MON)).toBe(0);
    expect(weekdayIndex(d(6))).toBe(6); // Sunday
    expect(weekStart(d(6))).toBe(MON);
  });
});

describe('getGoalsForDate', () => {
  it('returns non-archived goals scheduled on that weekday', () => {
    const everyDay = goal({ id: 'a', type: 'daily' });
    const weekdays = goal({ id: 'b', type: 'daily', scheduledDays: [0, 1, 2, 3, 4] as Weekday[] });
    const archived = goal({ id: 'c', type: 'daily', archived: true });
    const goals = [everyDay, weekdays, archived];
    expect(getGoalsForDate(goals, MON).map((g) => g.id)).toEqual(['a', 'b']);
    expect(getGoalsForDate(goals, d(5)).map((g) => g.id)).toEqual(['a']); // Saturday
  });
});

describe('isGoalDoneOnDate', () => {
  it('daily: done flag', () => {
    const g = goal({ type: 'daily' });
    expect(isGoalDoneOnDate(g, [{ id: '1', goalId: 'g1', date: MON, done: true }], MON)).toBe(true);
    expect(isGoalDoneOnDate(g, [], MON)).toBe(false);
  });

  it('numberTarget: value > 0', () => {
    const g = goal({ type: 'numberTarget', target: 150 });
    expect(isGoalDoneOnDate(g, [{ id: '1', goalId: 'g1', date: MON, value: 12 }], MON)).toBe(true);
  });

  it('weeklyCount: a rest day counts once the weekly target is already reached', () => {
    const g = goal({ type: 'weeklyCount', target: 2 });
    const entries: Entry[] = [
      { id: '1', goalId: 'g1', date: d(0), done: true },
      { id: '2', goalId: 'g1', date: d(1), done: true },
    ];
    expect(isGoalDoneOnDate(g, entries, d(2))).toBe(true);
    expect(isGoalDoneOnDate(g, entries.slice(0, 1), d(2))).toBe(false);
  });
});

describe('milestones', () => {
  const g = goal({
    type: 'milestones',
    milestones: [
      { id: 'm1', title: 'Functions', plannedDate: d(0) },
      { id: 'm2', title: 'Arrows', plannedDate: d(1) },
      { id: 'm3', title: 'Arrays', plannedDate: d(3) },
    ],
  });

  it('shows items planned for the day plus overdue unfinished ones', () => {
    expect(milestonesForDate(g, d(1)).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(milestonesForDate(g, d(2)).map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('is due only when something is planned or overdue', () => {
    const allDone = {
      ...g,
      milestones: g.milestones!.map((m) => (m.id === 'm3' ? m : { ...m, doneDate: m.plannedDate })),
    };
    expect(isGoalDueOnDate(allDone, [], d(2))).toBe(false);
    expect(isGoalDueOnDate(allDone, [], d(3))).toBe(true);
  });
});

describe('getWeekProgress', () => {
  it('weeklyCount: on track when actual >= even-pace expectation', () => {
    const g = goal({ type: 'weeklyCount', target: 5 });
    const entries: Entry[] = [
      { id: '1', goalId: 'g1', date: d(0), done: true },
      { id: '2', goalId: 'g1', date: d(1), done: true },
    ];
    // Thursday: 3 days over, expected floor(5*3/7) = 2
    expect(getWeekProgress(g, entries, MON, d(3))).toEqual({ actual: 2, target: 5, expected: 2, onTrack: true });
  });

  it('numberTarget: behind when pages lag the pace', () => {
    const g = goal({ type: 'numberTarget', target: 150 });
    const entries: Entry[] = [{ id: '1', goalId: 'g1', date: d(0), value: 20 }];
    const p = getWeekProgress(g, entries, MON, d(3)); // expected 64
    expect(p.actual).toBe(20);
    expect(p.onTrack).toBe(false);
  });

  it('daily: target is the number of scheduled days', () => {
    const g = goal({ type: 'daily', scheduledDays: [0, 1, 2, 3, 4] as Weekday[] });
    const p = getWeekProgress(g, [{ id: '1', goalId: 'g1', date: d(0), done: true }], MON, d(1));
    expect(p).toEqual({ actual: 1, target: 5, expected: 1, onTrack: true });
  });

  it('ignores days before the goal was created', () => {
    const g = goal({ type: 'daily', createdAt: d(6) }); // added on Sunday
    expect(getWeekProgress(g, [], MON, d(6))).toEqual({ actual: 0, target: 1, expected: 0, onTrack: true });
  });

  it('past weeks need the full target to be on track', () => {
    const g = goal({ type: 'weeklyCount', target: 2 });
    const entries: Entry[] = [{ id: '1', goalId: 'g1', date: d(0), done: true }];
    expect(getWeekProgress(g, entries, MON, d(10)).onTrack).toBe(false);
  });
});

describe('getDayStatus', () => {
  it('marks done, missed, today, future and unscheduled days', () => {
    const g = goal({ type: 'daily', scheduledDays: [0, 1, 2, 3, 4] as Weekday[] });
    const entries: Entry[] = [{ id: '1', goalId: 'g1', date: d(0), done: true }];
    const today = d(2);
    expect(getDayStatus(g, entries, d(0), today)).toBe('done');
    expect(getDayStatus(g, entries, d(1), today)).toBe('missed');
    expect(getDayStatus(g, entries, d(2), today)).toBe('today');
    expect(getDayStatus(g, entries, d(3), today)).toBe('future');
    expect(getDayStatus(g, entries, d(5), today)).toBe('off');
  });
});

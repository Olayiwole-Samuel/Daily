import { describe, expect, it } from 'vitest';
import type { Entry, Goal, Weekday } from '../types';
import { getPerfectDayStreak, getStreak, milestoneReached } from './streaks';
import { ALL_DAYS, addDaysISO } from './dates';

// 2026-11-09 is a Monday. Helper: day offset from that Monday.
const MON = '2026-11-09';
const d = (offset: number) => addDaysISO(MON, offset);

function goal(partial: Partial<Goal> & Pick<Goal, 'type'>): Goal {
  return {
    id: partial.id ?? 'g1',
    title: 'Test',
    color: '#000000',
    scheduledDays: ALL_DAYS,
    archived: false,
    createdAt: d(-28),
    ...partial,
  };
}

let n = 0;
const done = (date: string, goalId = 'g1'): Entry => ({ id: `e${n++}`, goalId, date, done: true });
const value = (date: string, v: number, goalId = 'g1'): Entry => ({ id: `e${n++}`, goalId, date, value: v });
const text = (date: string, t: string, goalId = 'g1'): Entry => ({ id: `e${n++}`, goalId, date, text: t });

describe('getStreak — daily goals', () => {
  const g = goal({ type: 'daily' });

  it('is 0 with no entries', () => {
    expect(getStreak(g, [], d(3))).toEqual({ current: 0, best: 0, unit: 'days', aliveToday: true });
  });

  it('counts consecutive days back from yesterday and stays alive today', () => {
    const entries = [done(d(0)), done(d(1)), done(d(2))];
    const s = getStreak(g, entries, d(3))!;
    expect(s.current).toBe(3);
    expect(s.aliveToday).toBe(true);
  });

  it('adds today when today is done', () => {
    const entries = [done(d(0)), done(d(1)), done(d(2)), done(d(3))];
    const s = getStreak(g, entries, d(3))!;
    expect(s.current).toBe(4);
    expect(s.aliveToday).toBe(false);
  });

  it('breaks on a missed scheduled day', () => {
    const entries = [done(d(0)), done(d(2))]; // d(1) missed
    expect(getStreak(g, entries, d(3))!.current).toBe(1);
  });

  it('is 0 when yesterday was missed', () => {
    const entries = [done(d(0)), done(d(1))]; // d(2) missed
    expect(getStreak(g, entries, d(3))!.current).toBe(0);
  });

  it('skips unscheduled days (weekend for a Mon–Fri class)', () => {
    const weekdaysOnly = goal({ type: 'daily', scheduledDays: [0, 1, 2, 3, 4] as Weekday[] });
    // Thu, Fri, (Sat, Sun skipped), Mon
    const entries = [done(d(3)), done(d(4)), done(d(7))];
    const s = getStreak(weekdaysOnly, entries, d(8))!;
    expect(s.current).toBe(3);
  });

  it('remembers the best streak after it breaks', () => {
    const entries = [done(d(0)), done(d(1)), done(d(2)), done(d(3)), done(d(5))];
    const s = getStreak(g, entries, d(6))!;
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('does not count days before the goal was created as missed', () => {
    const fresh = goal({ type: 'daily', createdAt: d(2) });
    const s = getStreak(fresh, [done(d(2)), done(d(3))], d(3))!;
    expect(s.current).toBe(2);
  });
});

describe('getStreak — journal goals', () => {
  const g = goal({ type: 'journal' });

  it('counts days with non-empty text', () => {
    const entries = [text(d(0), 'closures'), text(d(1), 'map vs forEach')];
    expect(getStreak(g, entries, d(2))!.current).toBe(2);
  });

  it('treats whitespace-only text as not done', () => {
    const entries = [text(d(0), 'a'), text(d(1), '   ')];
    expect(getStreak(g, entries, d(2))!.current).toBe(0);
  });
});

describe('getStreak — weekly goals', () => {
  it('counts consecutive weeks where a weekly count target was hit', () => {
    const g = goal({ type: 'weeklyCount', target: 2 });
    const entries = [
      done(d(-14)), done(d(-13)), // week -2: hit
      done(d(-7)), done(d(-5)), // week -1: hit
    ];
    const s = getStreak(g, entries, d(2))!;
    expect(s.unit).toBe('weeks');
    expect(s.current).toBe(2);
    expect(s.aliveToday).toBe(true); // this week not hit yet but not over
  });

  it('counts the current week once the target is reached', () => {
    const g = goal({ type: 'weeklyCount', target: 2 });
    const entries = [done(d(-7)), done(d(-6)), done(d(0)), done(d(1))];
    expect(getStreak(g, entries, d(2))!.current).toBe(2);
  });

  it('breaks on a past week that missed the target', () => {
    const g = goal({ type: 'weeklyCount', target: 2 });
    const entries = [done(d(-14)), done(d(-13)), done(d(-7))]; // week -1 only 1
    expect(getStreak(g, entries, d(2))!.current).toBe(0);
  });

  it('sums values for number targets', () => {
    const g = goal({ type: 'numberTarget', target: 150 });
    const entries = [value(d(-7), 100), value(d(-3), 60), value(d(0), 20)];
    const s = getStreak(g, entries, d(1))!;
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });
});

describe('getStreak — milestones', () => {
  it('has no streak', () => {
    expect(getStreak(goal({ type: 'milestones', milestones: [] }), [], d(0))).toBeNull();
  });
});

describe('getPerfectDayStreak', () => {
  const a = goal({ id: 'a', type: 'daily' });
  const b = goal({ id: 'b', type: 'daily', scheduledDays: [0, 1, 2, 3, 4] as Weekday[] });

  it('counts days where every scheduled goal was done', () => {
    const entries = [done(d(0), 'a'), done(d(0), 'b'), done(d(1), 'a'), done(d(1), 'b')];
    const s = getPerfectDayStreak([a, b], entries, d(2));
    expect(s.current).toBe(2);
    expect(s.aliveToday).toBe(true);
  });

  it('breaks if one goal was missed', () => {
    const entries = [done(d(0), 'a'), done(d(0), 'b'), done(d(1), 'a')];
    expect(getPerfectDayStreak([a, b], entries, d(2)).current).toBe(0);
  });

  it('needs only the goals scheduled that day (weekend has just "a")', () => {
    const entries = [done(d(4), 'a'), done(d(4), 'b'), done(d(5), 'a'), done(d(6), 'a')];
    expect(getPerfectDayStreak([a, b], entries, d(7)).current).toBe(3);
  });

  it('ignores archived goals', () => {
    const archived = { ...b, archived: true };
    const entries = [done(d(0), 'a'), done(d(1), 'a')];
    expect(getPerfectDayStreak([a, archived], entries, d(2)).current).toBe(2);
  });

  it('is 0 with no goals', () => {
    expect(getPerfectDayStreak([], [], d(0)).current).toBe(0);
  });
});

describe('milestoneReached', () => {
  it('returns the highest milestone at or below the count', () => {
    expect(milestoneReached(2)).toBe(0);
    expect(milestoneReached(3)).toBe(3);
    expect(milestoneReached(13)).toBe(7);
    expect(milestoneReached(45)).toBe(30);
  });
});

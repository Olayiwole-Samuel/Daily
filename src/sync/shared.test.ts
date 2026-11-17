import { describe, expect, it } from 'vitest';
import type { Goal } from '../types';
import { createEmptyState } from '../state/storage';
import { fromCloudData, isCloudData, isReminderDue, localParts, mergeCloudData, overdueGoals, remindersFromGoals, toCloudData, type CloudData } from './shared';

const goal = (partial: Partial<Goal>): Goal => ({
  id: 'g',
  title: 'Bible',
  type: 'daily',
  color: '#fff',
  scheduledDays: [0, 1, 2, 3, 4, 5, 6],
  archived: false,
  createdAt: '2026-11-01',
  ...partial,
});

const cloud = (extra: Partial<CloudData>): CloudData => ({ ...toCloudData(createEmptyState()), ...extra });

describe('cloud data', () => {
  it('never uploads photos and keeps local photos when applying cloud data', () => {
    const local = { ...createEmptyState(), savedPhotos: [{ id: 'p', date: '2026-11-17', dataUrl: 'data:x' }] };
    const data = toCloudData(local);
    expect('savedPhotos' in data).toBe(false);
    expect(fromCloudData(data, local).savedPhotos).toHaveLength(1);
    expect(isCloudData(data)).toBe(true);
    expect(isCloudData({ version: 2 })).toBe(false);
  });

  it('merges two devices without losing anything logged on either', () => {
    const phone = cloud({
      goals: [goal({ id: 'a' })],
      entries: [{ id: '1', goalId: 'a', date: '2026-11-16', done: true }],
      weighIns: [{ id: 'w1', date: '2026-11-16', kg: 80 }],
    });
    const laptop = cloud({
      goals: [goal({ id: 'a', title: 'Renamed' }), goal({ id: 'b' })],
      entries: [{ id: '2', goalId: 'a', date: '2026-11-16' }, { id: '3', goalId: 'b', date: '2026-11-17', done: true }],
      weighIns: [{ id: 'w2', date: '2026-11-17', kg: 79.5 }],
    });
    const merged = mergeCloudData(phone, laptop);
    expect(merged.goals.map((g) => g.title).sort()).toEqual(['Bible', 'Renamed']); // goal a takes the cloud version
    expect(merged.entries).toHaveLength(2);
    expect(merged.entries.find((e) => e.goalId === 'a')?.done).toBe(true); // most progress wins
    expect(merged.weighIns).toHaveLength(2);
  });
});

describe('reminders', () => {
  it('only goals with a valid time become reminders', () => {
    const r = remindersFromGoals([goal({ id: 'a', reminderTime: '05:30' }), goal({ id: 'b' }), goal({ id: 'c', reminderTime: '05:30', archived: true })]);
    expect(r.map((x) => x.goalId)).toEqual(['a']);
  });

  it('reads local time in the user’s time zone', () => {
    // 04:31 UTC on Tue 17 Nov 2026 = 05:31 in Lagos, 23:31 Mon 16 Nov in New York.
    const now = new Date('2026-11-17T04:31:00Z');
    expect(localParts(now, 'Africa/Lagos')).toEqual({ date: '2026-11-17', weekday: 1, minutes: 331 });
    expect(localParts(now, 'America/New_York')).toEqual({ date: '2026-11-16', weekday: 0, minutes: 1411 });
  });

  it('is due within 10 minutes of the time, on scheduled days, unless done or stopped', () => {
    const reminder = { goalId: 'a', title: 'Bible', time: '05:30', days: [1] }; // Tuesdays only
    const tz = 'Africa/Lagos';
    expect(isReminderDue(reminder, new Date('2026-11-17T04:31:00Z'), tz, null).due).toBe(true);
    expect(isReminderDue(reminder, new Date('2026-11-17T04:45:00Z'), tz, null).due).toBe(false); // too late
    expect(isReminderDue(reminder, new Date('2026-11-16T04:31:00Z'), tz, null).due).toBe(false); // Monday
    const done = { entries: [{ id: 'e', goalId: 'a', date: '2026-11-17', done: true }], stoppedTakeovers: [] };
    expect(isReminderDue(reminder, new Date('2026-11-17T04:31:00Z'), tz, done).due).toBe(false);
    const stopped = { entries: [], stoppedTakeovers: ['a|2026-11-17'] };
    expect(isReminderDue(reminder, new Date('2026-11-17T04:31:00Z'), tz, stopped).due).toBe(false);
  });
});

describe('in-app takeover', () => {
  const goals = [goal({ id: 'bible', reminderTime: '05:30' }), goal({ id: 'class', reminderTime: '14:00', scheduledDays: [0, 1, 2, 3, 4] })];

  it('takes over once the time has passed and the goal is not done', () => {
    expect(overdueGoals(goals, [], [], '2026-11-17', 1, 5 * 60 + 29).map((g) => g.id)).toEqual([]);
    expect(overdueGoals(goals, [], [], '2026-11-17', 1, 5 * 60 + 30).map((g) => g.id)).toEqual(['bible']);
    expect(overdueGoals(goals, [], [], '2026-11-17', 1, 15 * 60).map((g) => g.id)).toEqual(['bible', 'class']);
  });

  it('stops when the goal is done, when you ask it to stop, and on unscheduled days', () => {
    const done = [{ id: 'e', goalId: 'bible', date: '2026-11-17', done: true }];
    expect(overdueGoals(goals, done, [], '2026-11-17', 1, 6 * 60).map((g) => g.id)).toEqual([]);
    expect(overdueGoals(goals, [], ['bible|2026-11-17'], '2026-11-17', 1, 6 * 60).map((g) => g.id)).toEqual([]);
    expect(overdueGoals(goals, [], [], '2026-11-22', 6, 15 * 60).map((g) => g.id)).toEqual(['bible']); // Sunday: no class
  });
});

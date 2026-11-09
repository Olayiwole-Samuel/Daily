import { describe, expect, it } from 'vitest';
import { isStoredState, migrateState } from './storage';

describe('storage migration', () => {
  const v1 = {
    version: 1,
    goals: [{ id: 'g', title: 'Workout', type: 'weeklyCount', scheduledDays: [0], color: '#fff', archived: false, createdAt: '2026-11-01' }],
    entries: [{ id: 'e', goalId: 'g', date: '2026-11-02', done: true }],
    food: [],
    eatingRules: ['Water first'],
    settings: { theme: 'light' },
    celebratedStreaks: {},
  };

  it('upgrades version 1 data to version 2 with empty coach data', () => {
    expect(isStoredState(v1)).toBe(true);
    const state = migrateState(v1);
    expect(state.version).toBe(2);
    expect(state.goals).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.settings.theme).toBe('light');
    expect(state.sessions).toEqual([]);
    expect(state.weighIns).toEqual([]);
    expect(state.coachPlan).toBeUndefined();
  });

  it('drops coach data that does not match the schema instead of crashing', () => {
    const state = migrateState({ ...v1, version: 2, coachPlan: { broken: true }, weighIns: [{ id: 'w', date: '2026-11-09', kg: 80 }, { nope: 1 }] });
    expect(state.coachPlan).toBeUndefined();
    expect(state.weighIns).toHaveLength(1);
  });

  it('rejects files that are not app data', () => {
    expect(isStoredState({ version: 3 })).toBe(false);
    expect(isStoredState('hello')).toBe(false);
  });
});

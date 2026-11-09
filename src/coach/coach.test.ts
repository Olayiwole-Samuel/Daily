import { describe, expect, it } from 'vitest';
import type { AiPlan, CoachProfile, Exercise, WorkoutSession } from './schema';
import { applySafety, bmi, checkProfile, effectiveGoal, findPlanProblems, maintenanceKcal, minimumKcal } from './safety';
import { getLastPerformance, getRoutineForDate, getWeightTrend, suggestProgression } from './workout';

const profile: CoachProfile = {
  goalBuild: 'loseFat',
  age: 30,
  sex: 'female',
  heightCm: 165,
  weightKg: 80,
  activity: 'light',
  experience: 'beginner',
  daysPerWeek: 3,
  minutesPerSession: 40,
  place: 'home',
  equipment: [],
  nationality: 'Nigerian',
  dislikes: [],
  dietary: [],
  budget: 'low',
  mealsPerDay: 3,
  health: { hasCondition: false },
  photoProvided: false,
};

const meal = { name: 'm', foods: [{ item: 'beans', portion: '1 cup' }], kcal: 400, proteinG: 20 };
const plan: AiPlan = {
  bodySummary: 's',
  weeklyPaceKg: -0.5,
  routines: [
    { id: 'A', name: 'A', warmUp: 'w', coolDown: 'c', estimatedMin: 30, exercises: [{ id: 'sq', name: 'Squat', sets: 3, reps: 10, restSec: 60, howTo: 'x' }] },
    { id: 'B', name: 'B', warmUp: 'w', coolDown: 'c', estimatedMin: 30, exercises: [{ id: 'pl', name: 'Plank', sets: 3, durationSec: 30, restSec: 45, howTo: 'x' }] },
  ],
  schedule: ['A', null, 'B', null, 'A', null, null],
  progression: 'p',
  dailyKcal: 1800,
  dailyProteinG: 110,
  nutritionWhy: 'w',
  mealPlan: Array.from({ length: 7 }, (_, day) => ({ day, breakfast: meal, lunch: meal, dinner: meal, snacks: [] })),
  swaps: [],
  groceryList: [],
  tips: ['a', 'b', 'c'],
};

describe('safety maths', () => {
  it('computes BMI and maintenance', () => {
    expect(bmi(profile)).toBeCloseTo(29.4, 1);
    // BMR = 800 + 1031.25 - 150 - 161 = 1520.25; x1.375 = 2090
    expect(maintenanceKcal(profile)).toBe(2090);
  });

  it('caps the deficit at 500 kcal but never below the floor', () => {
    expect(minimumKcal(profile)).toBe(1590);
    const small = { ...profile, heightCm: 150, weightKg: 50, age: 60, activity: 'sedentary' as const };
    expect(minimumKcal(small)).toBe(1200); // floor wins
  });

  it('rejects under-18s and odd numbers', () => {
    expect(checkProfile({ ...profile, age: 16 })).toMatch(/18\+/);
    expect(checkProfile({ ...profile, weightKg: 300, heightCm: 120 })).toMatch(/double-check/);
    expect(checkProfile(profile)).toBeNull();
  });

  it('never plans fat loss for an underweight user', () => {
    const thin = { ...profile, weightKg: 45 };
    expect(effectiveGoal(thin)).toBe('maintain');
    const { plan: safe, notes } = applySafety({ ...plan, dailyKcal: 1200, weeklyPaceKg: -0.5 }, thin);
    expect(safe.dailyKcal).toBe(maintenanceKcal(thin));
    expect(safe.weeklyPaceKg).toBe(0);
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe('applySafety', () => {
  it('raises a too-low calorie target and caps the pace', () => {
    const { plan: safe, notes } = applySafety({ ...plan, dailyKcal: 1000, weeklyPaceKg: -2 }, profile);
    expect(safe.dailyKcal).toBe(1590);
    expect(safe.weeklyPaceKg).toBe(-1);
    expect(notes).toHaveLength(2);
  });

  it('leaves a safe plan alone', () => {
    const { plan: safe, notes } = applySafety(plan, profile);
    expect(safe.dailyKcal).toBe(1800);
    expect(notes).toHaveLength(0);
  });

  it('adds a doctor note for health conditions', () => {
    const { notes } = applySafety(plan, { ...profile, health: { hasCondition: true, notes: 'knee' } });
    expect(notes.join(' ')).toMatch(/doctor/);
  });
});

describe('findPlanProblems', () => {
  it('accepts a well-formed plan', () => {
    expect(findPlanProblems(plan, profile)).toEqual([]);
  });

  it('catches bad schedule references and too many training days', () => {
    const bad = { ...plan, schedule: ['A', 'Z', 'B', 'A', null, null, null] };
    const problems = findPlanProblems(bad, profile);
    expect(problems.some((p) => p.includes('unknown routine'))).toBe(true);
    expect(problems.some((p) => p.includes('training days'))).toBe(true);
  });
});

describe('workout helpers', () => {
  const squat: Exercise = { id: 'sq', name: 'Squat', sets: 2, reps: 10, restSec: 60, howTo: 'x' };
  const session = (date: string, done: boolean): WorkoutSession => ({
    id: date,
    date,
    routineId: 'A',
    startedAt: `${date}T06:00:00`,
    finishedAt: `${date}T06:40:00`,
    exercises: [{ exerciseId: 'sq', sets: [{ done, reps: 10 }, { done, reps: 9 }] }],
  });

  it('finds the routine for a date (2026-11-09 is a Monday)', () => {
    expect(getRoutineForDate(plan.schedule, '2026-11-09')).toBe('A');
    expect(getRoutineForDate(plan.schedule, '2026-11-10')).toBeNull();
  });

  it('returns the latest performance', () => {
    const sets = getLastPerformance([session('2026-11-09', true), session('2026-11-11', true)], 'sq');
    expect(sets?.[1].reps).toBe(9);
    expect(getLastPerformance([], 'sq')).toBeNull();
  });

  it('suggests progression only after 2 fully completed sessions', () => {
    expect(suggestProgression([session('2026-11-09', true)], squat)).toBeNull();
    expect(suggestProgression([session('2026-11-09', true), session('2026-11-11', false)], squat)).toBeNull();
    expect(suggestProgression([session('2026-11-09', true), session('2026-11-11', true)], squat)).toMatch(/12 reps/);
  });

  it('computes the weight trend from unsorted weigh-ins', () => {
    const trend = getWeightTrend([
      { id: '2', date: '2026-11-16', kg: 79.2 },
      { id: '1', date: '2026-11-09', kg: 80 },
    ]);
    expect(trend?.startKg).toBe(80);
    expect(trend?.changeKg).toBe(-0.8);
    expect(getWeightTrend([])).toBeNull();
  });
});

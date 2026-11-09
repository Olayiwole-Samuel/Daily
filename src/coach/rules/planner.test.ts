import { describe, expect, it } from 'vitest';
import type { CoachProfile } from '../schema';
import { AiPlanSchema } from '../schema';
import { applySafety, findPlanProblems, minimumKcal } from '../safety';
import { buildRulePlan, targets } from './planner';

const base: CoachProfile = {
  goalBuild: 'loseFat',
  age: 30,
  sex: 'female',
  heightCm: 165,
  weightKg: 80,
  activity: 'light',
  experience: 'beginner',
  daysPerWeek: 3,
  minutesPerSession: 30,
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

const plan = (p: Partial<CoachProfile>, seed = 1) => buildRulePlan({ profile: { ...base, ...p } }, seed);
const allFoodText = (p: ReturnType<typeof plan>) =>
  p.mealPlan
    .flatMap((d) => [d.breakfast, d.lunch, d.dinner, ...d.snacks])
    .flatMap((meal) => [meal.name, ...meal.foods.map((x) => x.item)])
    .join(' ')
    .toLowerCase();
const allExercises = (p: ReturnType<typeof plan>) => p.routines.flatMap((r) => r.exercises.map((e) => e.name.toLowerCase())).join(' | ');

describe('free planner', () => {
  it('produces valid, problem-free plans across many different profiles', () => {
    const goals = ['loseFat', 'leanToned', 'buildMuscle', 'athletic', 'maintain'] as const;
    const places = ['home', 'gym', 'outdoors'] as const;
    const levels = ['beginner', 'intermediate', 'advanced'] as const;
    const cuisines = ['Nigerian', 'Ghanaian', 'Kenyan', 'British', 'Indian'];
    let count = 0;
    for (const goalBuild of goals)
      for (const place of places)
        for (const experience of levels)
          for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek += 2)
            for (const mealsPerDay of [2, 3, 5]) {
              const profile = { ...base, goalBuild, place, experience, daysPerWeek, mealsPerDay, nationality: cuisines[count % cuisines.length] };
              const p = buildRulePlan({ profile }, count);
              expect(AiPlanSchema.safeParse(p).success).toBe(true);
              expect(findPlanProblems(p, profile)).toEqual([]);
              count++;
            }
    expect(count).toBeGreaterThan(500);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(plan({}, 7)).toEqual(plan({}, 7));
    const meals = new Set(Array.from({ length: 6 }, (_, s) => plan({}, s).mealPlan[0].lunch.name));
    expect(meals.size).toBeGreaterThan(1);
  });

  it('only uses equipment the user has', () => {
    const noKit = allExercises(plan({ equipment: [] }));
    expect(noKit).not.toMatch(/dumbbell|kettlebell|band|barbell|machine|pulldown|cable|pull-up|rope/);
    const withDumbbells = allExercises(plan({ equipment: ['Dumbbells'], experience: 'intermediate' }));
    expect(withDumbbells).toMatch(/dumbbell|goblet/);
    // Bench press needs dumbbells AND a bench.
    for (let seed = 0; seed < 20; seed++) {
      expect(allExercises(plan({ equipment: ['Dumbbells'], experience: 'advanced', daysPerWeek: 4 }, seed))).not.toMatch(/bench press|hip thrust/);
    }
  });

  it('keeps it low impact with a health condition', () => {
    const p = plan({ health: { hasCondition: true, notes: 'knee' }, experience: 'advanced', goalBuild: 'athletic' });
    expect(allExercises(p)).not.toMatch(/jump|burpee|mountain|high knees|skipping|swing/);
    expect(p.bodySummary).toMatch(/doctor/);
  });

  it('respects vegetarian, vegan and allergy needs', () => {
    expect(allFoodText(plan({ dietary: ['Vegetarian'] }))).not.toMatch(/fish|chicken|beef|suya|tilapia|mince/);
    const vegan = allFoodText(plan({ dietary: ['Vegan'], mealsPerDay: 5 }));
    // "garden eggs" are a vegetable (a small eggplant), so only real eggs count here.
    expect(vegan).not.toMatch(/(?<!garden )\beggs?\b|milk|yoghurt|wara|fish|chicken|beef/);
    expect(allFoodText(plan({ dietary: ['Nut allergy'], mealsPerDay: 5 }))).not.toMatch(/groundnut|nuts\b|tom brown/);
  });

  it('avoids disliked foods', () => {
    const p = plan({ dislikes: ['okra', 'beans'] });
    expect(allFoodText(p)).not.toMatch(/okra|beans/);
  });

  it('uses local foods for the cuisine', () => {
    expect(allFoodText(plan({}))).toMatch(/eba|amala|moi moi|akara|jollof|ofada|plantain|yam|fufu|adalu|pap/);
    expect(allFoodText(plan({ nationality: 'Ghanaian' }))).toMatch(/waakye|banku|kenkey|kontomire|koko|red red|tom brown|plantain|jollof|fufu/);
  });

  it('sets calories safely and lands meals near the target', () => {
    const p = plan({});
    expect(p.dailyKcal).toBeGreaterThanOrEqual(minimumKcal(base));
    for (const day of p.mealPlan) {
      const total = [day.breakfast, day.lunch, day.dinner, ...day.snacks].reduce((s, x) => s + x.kcal, 0);
      expect(Math.abs(total - p.dailyKcal) / p.dailyKcal).toBeLessThan(0.35);
    }
    expect(applySafety(p, base).notes).toEqual([]); // already safe, nothing to clamp
  });

  it('gets close to the calorie and protein targets for different diets', () => {
    const cases: Partial<CoachProfile>[] = [
      {},
      { nationality: 'Ghanaian', dietary: ['Vegetarian'] },
      { dietary: ['Vegan'] },
      { sex: 'male', weightKg: 75, heightCm: 178, goalBuild: 'buildMuscle', mealsPerDay: 4 },
      { nationality: 'Kenyan', mealsPerDay: 2, weightKg: 90 },
    ];
    for (const extra of cases) {
      const p = plan(extra, 5);
      const days = p.mealPlan.map((d) => [d.breakfast, d.lunch, d.dinner, ...d.snacks]);
      const avg = (pick: (m: { kcal: number; proteinG: number }) => number) =>
        days.reduce((sum, meals) => sum + meals.reduce((s, m) => s + pick(m), 0), 0) / 7;
      expect(Math.abs(avg((m) => m.kcal) / p.dailyKcal - 1)).toBeLessThan(0.12);
      expect(avg((m) => m.proteinG) / p.dailyProteinG).toBeGreaterThan(0.7);
    }
  });

  it('never plans weight loss for an underweight user', () => {
    const thin = { ...base, weightKg: 45 };
    const t = targets(thin);
    expect(t.pace).toBeGreaterThan(0);
    expect(buildRulePlan({ profile: thin }, 1).bodySummary).toMatch(/gain/);
  });

  it('makes workouts harder or easier from regenerate feedback', () => {
    const harder = buildRulePlan({ profile: { ...base, experience: 'intermediate' }, history: { feedback: 'workouts are too easy' } }, 3);
    const easier = buildRulePlan({ profile: { ...base, experience: 'intermediate' }, history: { feedback: 'too hard, I am sore' } }, 3);
    expect(allExercises(harder)).not.toEqual(allExercises(easier));
    expect(harder.bodySummary).toMatch(/updated plan/);
  });
});

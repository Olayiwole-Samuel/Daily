// A hard-coded but valid plan, returned when the server has no ANTHROPIC_API_KEY.
// It lets the whole app (onboarding, plan screens, session player) be tried
// without spending anything on the AI. The app labels it as a sample.
// (Folders starting with "_" inside /api are not turned into endpoints by Vercel.)
import type { AiPlan, CoachProfile, DayMeals, Meal } from '../../src/coach/schema.js';

const meal = (name: string, foods: [string, string][], kcal: number, proteinG: number): Meal => ({
  name,
  foods: foods.map(([item, portion]) => ({ item, portion })),
  kcal,
  proteinG,
});

const BREAKFASTS = [
  meal('Moi moi and pap', [['Moi moi', '1 wrap (palm-sized)'], ['Pap (akamu) with milk', '1 medium cup']], 420, 22),
  meal('Boiled eggs and plantain', [['Boiled eggs', '2 eggs'], ['Boiled ripe plantain', '1 medium finger']], 400, 15),
  meal('Akara and oats', [['Akara (less oil)', '4 small balls'], ['Oats with milk', '1 cup']], 450, 20),
];
const LUNCHES = [
  meal('Beans and roasted plantain', [['Beans porridge (less oil)', '2 cooking spoons'], ['Roasted plantain (boli)', '1/2 medium']], 520, 24),
  meal('Jollof rice with chicken', [['Jollof rice', '2 cooking spoons'], ['Grilled chicken', '1 medium piece'], ['Salad', '1 handful']], 600, 35),
  meal('Ofada rice and fish', [['Ofada rice', '2 cooking spoons'], ['Ofada stew (less oil)', '1 small ladle'], ['Fish', '1 medium piece']], 580, 33),
];
const DINNERS = [
  meal('Eba with efo riro', [['Eba', '1 wrap (fist-sized)'], ['Efo riro', '1 ladle'], ['Fish', '1 medium piece']], 560, 32),
  meal('Amala with ewedu and gbegiri', [['Amala', '1 wrap (fist-sized)'], ['Ewedu and gbegiri', '1 ladle'], ['Lean beef', '2 small pieces']], 540, 30),
  meal('Yam and egg sauce', [['Boiled yam', '2 medium slices'], ['Egg and tomato sauce', '1 ladle (2 eggs)']], 500, 22),
];
const SNACKS = [
  meal('Fruit', [['Orange or banana', '1 medium']], 90, 1),
  meal('Groundnuts', [['Roasted groundnuts', '1 small handful']], 170, 7),
  meal('Garden egg', [['Garden eggs', '3 pieces']], 60, 2),
];

// Spread N training days across the week (e.g. 3 -> Mon, Wed, Fri).
function spreadDays(count: number): number[] {
  const presets: Record<number, number[]> = {
    1: [0],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.min(7, Math.max(1, count))];
}

export function samplePlan(profile: CoachProfile): AiPlan {
  const days = spreadDays(profile.daysPerWeek);
  const schedule = Array.from({ length: 7 }, (_, d): string | null => {
    const index = days.indexOf(d);
    return index === -1 ? null : index % 2 === 0 ? 'A' : 'B';
  });

  const mealPlan: DayMeals[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    breakfast: BREAKFASTS[day % 3],
    lunch: LUNCHES[day % 3],
    dinner: DINNERS[day % 3],
    snacks: profile.mealsPerDay > 3 ? [SNACKS[day % 3]] : [],
  }));

  return {
    bodySummary:
      'This is a SAMPLE plan so you can try the Coach. Add an Anthropic API key on the server to get a plan written for you. ' +
      'It assumes a home setup with no equipment and simple Nigerian meals.',
    weeklyPaceKg: profile.goalBuild === 'loseFat' ? -0.5 : profile.goalBuild === 'buildMuscle' ? 0.25 : 0,
    routines: [
      {
        id: 'A',
        name: 'Full body A',
        warmUp: '5 min: march on the spot, arm circles, 10 bodyweight squats.',
        coolDown: '5 min: slow walk, then stretch legs, chest and shoulders (20-30 s each).',
        estimatedMin: 30,
        exercises: [
          { id: 'a1', name: 'Bodyweight squat', sets: 3, reps: 12, restSec: 60, howTo: 'Sit back like into a chair, chest up, knees over toes.' },
          { id: 'a2', name: 'Incline push-up (hands on a table)', sets: 3, reps: 10, restSec: 60, howTo: 'Straight line from head to heels; lower chest to the edge.' },
          { id: 'a3', name: 'Glute bridge', sets: 3, reps: 12, restSec: 45, howTo: 'Squeeze your bum to lift hips; pause 1 s at the top.' },
          { id: 'a4', name: 'Plank', sets: 3, durationSec: 30, restSec: 45, howTo: 'Elbows under shoulders, brace your tummy, breathe.' },
        ],
      },
      {
        id: 'B',
        name: 'Full body B',
        warmUp: '5 min: easy jog on the spot, leg swings, hip circles.',
        coolDown: '5 min: deep breaths, hamstring and quad stretches.',
        estimatedMin: 30,
        exercises: [
          { id: 'b1', name: 'Reverse lunge', sets: 3, reps: 10, restSec: 60, howTo: 'Step back, both knees bend to about 90 degrees; alternate legs.' },
          { id: 'b2', name: 'Chair dip', sets: 3, reps: 8, restSec: 60, howTo: 'Hands on a sturdy chair, elbows point back, lower slowly.' },
          { id: 'b3', name: 'Superman hold', sets: 3, durationSec: 20, restSec: 45, howTo: 'Lie face down, lift arms and legs a little, look at the floor.' },
          { id: 'b4', name: 'Jumping jacks', sets: 3, durationSec: 40, restSec: 45, howTo: 'Land softly; step side to side instead if you need low impact.' },
        ],
      },
    ],
    schedule,
    progression: 'Weeks 1-2: add 2 reps (or 5 seconds) each week. Weeks 3-4: add a 4th set to the first two exercises.',
    dailyKcal: 1800,
    dailyProteinG: Math.round(profile.weightKg * 1.4),
    nutritionWhy: 'A moderate target with plenty of protein to keep you full and protect muscle. (Sample numbers, not personalised.)',
    mealPlan,
    swaps: [
      { instead: 'Fried dodo', have: 'Boiled or roasted plantain' },
      { instead: 'Lots of oil in stew', have: 'Measure oil: 1-2 tablespoons per pot' },
      { instead: 'Soft drinks', have: 'Water, zobo without sugar, or tiger nut drink' },
    ],
    groceryList: [
      { section: 'Grains and swallows', items: ['Ofada rice', 'Long-grain rice', 'Garri', 'Yam', 'Oats'] },
      { section: 'Beans and legumes', items: ['Brown beans', 'Black-eyed beans (for moi moi and akara)', 'Groundnuts'] },
      { section: 'Protein', items: ['Eggs', 'Fresh or frozen fish', 'Chicken', 'Lean beef'] },
      { section: 'Vegetables', items: ['Ugu or spinach', 'Ewedu', 'Tomatoes and peppers', 'Onions', 'Garden eggs'] },
      { section: 'Fruit', items: ['Plantain', 'Oranges', 'Bananas'] },
    ],
    tips: [
      'Drink a glass of water before each meal.',
      'Aim for 7-8 hours of sleep; it makes hunger easier to manage.',
      'At parties, start with protein and vegetables, then a small portion of rice.',
    ],
  };
}

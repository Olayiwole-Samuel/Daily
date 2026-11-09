// The free planner: builds a complete plan from the user's answers with rules
// and built-in lists. No AI, no API key, no cost. The output has the same shape
// as an AI plan, so every screen works the same.
import type { AiPlan, CoachPlan, CoachProfile, CoachRequest } from '../schema.js';
import { applySafety, effectiveGoal, isUnderweight, maintenanceKcal, minimumKcal } from '../safety.js';
import { buildMeals } from './meals.js';
import { buildWorkouts } from './workouts.js';
import { cuisineFor, SWAPS } from './foods.js';
import { makeRng } from './random.js';

const GOAL_TEXT: Record<CoachProfile['goalBuild'], string> = {
  loseFat: 'losing fat steadily while keeping your strength',
  leanToned: 'getting leaner and firmer, with a little more muscle',
  buildMuscle: 'building muscle and strength',
  athletic: 'all-round fitness: strength, stamina and speed',
  maintain: 'staying where you are and feeling good',
};

// Calories, protein and weekly pace for the goal.
export function targets(profile: CoachProfile) {
  const maintenance = maintenanceKcal(profile);
  const goal = effectiveGoal(profile);
  const gentle = profile.health.hasCondition;
  let kcal: number;
  let pace: number;

  if (isUnderweight(profile)) {
    kcal = maintenance + 250; // gentle gain
    pace = 0.25;
  } else if (goal === 'loseFat') {
    kcal = maintenance - (gentle ? 300 : 500);
    pace = gentle ? -0.3 : -0.5;
  } else if (goal === 'leanToned') {
    kcal = maintenance - 250;
    pace = -0.25;
  } else if (goal === 'buildMuscle') {
    kcal = maintenance + 250;
    pace = 0.25;
  } else {
    kcal = maintenance;
    pace = 0;
  }

  kcal = Math.max(minimumKcal(profile), Math.round(kcal / 50) * 50);
  // 1.2-1.6 g per kg: enough to support the goal, and reachable with everyday food.
  // Plant-based diets use 1.2 g/kg: still plenty, and reachable from beans and grains.
  const plantBased = profile.dietary.some((d) => /vegan|vegetarian/i.test(d));
  const proteinPerKg = plantBased ? 1.2 : goal === 'buildMuscle' ? 1.6 : goal === 'maintain' ? 1.2 : 1.4;
  // ...but never more than 30% of calories, which everyday meals can't reach.
  const protein = Math.round(Math.min(profile.weightKg * proteinPerKg, (kcal * 0.3) / 4));
  return { maintenance, kcal, pace, protein, goal };
}

function bodySummary(profile: CoachProfile, t: ReturnType<typeof targets>, isRegenerate: boolean): string {
  const parts: string[] = [];
  parts.push(
    `You're starting at ${profile.weightKg} kg and ${profile.heightCm} cm, and your body uses about ${t.maintenance} kcal a day to stay the same weight.`,
  );
  if (isUnderweight(profile)) {
    parts.push('Your weight is on the lighter side for your height, so this plan focuses on strength and eating enough to gain gently, not on losing weight.');
  } else {
    parts.push(`Your goal means ${GOAL_TEXT[t.goal]}.`);
  }
  if (profile.waistCm && profile.waistCm / profile.heightCm > 0.5) {
    parts.push('Your waist measurement suggests you carry some weight around the middle, which is very common; steady walking, strength work and fewer sugary drinks help most here.');
  }
  if (t.pace < 0) parts.push(`A realistic pace is about ${Math.abs(t.pace)} kg a week; slower weeks are normal.`);
  if (t.pace > 0) parts.push(`Expect slow, steady change: about ${t.pace} kg a week.`);
  if (profile.health.hasCondition) parts.push('Because you mentioned a health condition, everything here is low impact. Please check this plan with your doctor before starting.');
  if (isRegenerate) parts.push('This is an updated plan based on your latest weigh-in and workouts.');
  return parts.join(' ');
}

function proteinFoods(profile: CoachProfile): string {
  const diet = profile.dietary.map((d) => d.toLowerCase());
  if (diet.includes('vegan')) return 'beans, lentils, moi moi, groundnuts';
  if (diet.includes('vegetarian')) return 'beans, eggs, moi moi, yoghurt';
  return 'beans, eggs, fish, chicken';
}

function tips(profile: CoachProfile, t: ReturnType<typeof targets>): string[] {
  const list = [
    'Drink a glass of water before each meal and keep a bottle with you.',
    'Aim for 7-8 hours of sleep: tired days make hunger and cravings stronger.',
    `Get protein at every meal (${proteinFoods(profile)}) to reach about ${t.protein} g a day.`,
  ];
  if (profile.activity === 'sedentary') list.push('Add a 10-minute walk after lunch or dinner: it adds up fast.');
  if (t.pace < 0) list.push('At parties or eating out, start with protein and vegetables, then a small portion of rice or swallow.');
  if (t.pace > 0) list.push('If you struggle to eat enough, add a snack like groundnuts, yoghurt or an extra egg.');
  list.push('Plan tomorrow’s meals the night before so you are not caught hungry with no plan.');
  return list.slice(0, 5);
}

// Reads the free-text feedback from Regenerate ("too easy", "too hard", ...).
function levelShift(feedback: string | undefined): number {
  const text = (feedback ?? '').toLowerCase();
  if (/(too )?easy|harder|more challeng|bored of (the )?workout/.test(text)) return 1;
  if (/(too )?hard|tired|sore|pain|easier|struggl/.test(text)) return -1;
  return 0;
}

export function buildRulePlan(request: Pick<CoachRequest, 'profile' | 'history'>, seed: number): AiPlan {
  const { profile, history } = request;
  const rng = makeRng(seed);
  const t = targets(profile);
  const workouts = buildWorkouts(profile, rng, { levelShift: levelShift(history?.feedback) });
  const meals = buildMeals(profile, t.kcal, t.protein, rng);
  const cuisine = cuisineFor(profile.nationality);

  const why =
    t.pace < 0
      ? `About ${t.maintenance - t.kcal} kcal below what your body uses, a gentle gap you can keep up. Protein of ${t.protein} g helps you stay full and keep muscle.`
      : t.pace > 0
        ? `A small surplus (about ${t.kcal - t.maintenance} kcal) gives your body what it needs to build, without much extra fat. Protein of ${t.protein} g supports muscle.`
        : `Matched to what your body uses, so your weight stays steady. Protein of ${t.protein} g keeps you strong.`;

  return {
    bodySummary: bodySummary(profile, t, !!history),
    estimateNote:
      cuisine === 'general' ? `Meals use common foods. Local menus are built in for Nigerian, Ghanaian and East African food; others use general meals for now.` : undefined,
    weeklyPaceKg: t.pace,
    routines: workouts.routines,
    schedule: workouts.schedule,
    progression: workouts.progression,
    dailyKcal: t.kcal,
    dailyProteinG: t.protein,
    nutritionWhy: why,
    mealPlan: meals.mealPlan,
    swaps: SWAPS[cuisine],
    groceryList: meals.groceryList,
    tips: tips(profile, t),
  };
}


// A finished, safety-checked plan ready to save. Used by the server when no AI
// key is set, and by the app itself when it can't reach the server (offline).
export function createRulePlan(request: Pick<CoachRequest, 'profile' | 'history'>, seed: number): CoachPlan {
  const { plan, notes } = applySafety(buildRulePlan(request, seed), request.profile);
  return { ...plan, createdAt: new Date().toISOString(), safetyNotes: notes, source: 'rules' };
}

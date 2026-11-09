// Health and diet guardrails, enforced in CODE (not just asked of the AI).
// The server runs these on every plan; they're pure functions so they're easy to test.
//
// Imports use a ".js" extension because the Vercel server function runs this file as
// a native ES module, where Node needs the extension. TypeScript maps it to schema.ts.
import type { AiPlan, CoachProfile, GoalBuild } from './schema.js';

export const KCAL_FLOOR = { male: 1500, female: 1200 } as const;
export const MAX_DEFICIT_KCAL = 500;
export const MAX_LOSS_KG_PER_WEEK = 1;
export const UNDERWEIGHT_BMI = 18.5;

export function bmi(profile: Pick<CoachProfile, 'heightCm' | 'weightKg'>): number {
  const m = profile.heightCm / 100;
  return profile.weightKg / (m * m);
}

// Mifflin-St Jeor: the standard estimate of calories burned at complete rest (BMR).
export function bmrMifflin(profile: Pick<CoachProfile, 'sex' | 'heightCm' | 'weightKg' | 'age'>): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === 'male' ? base + 5 : base - 161;
}

const ACTIVITY_FACTOR: Record<CoachProfile['activity'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

// Estimated calories to keep weight the same (BMR x activity).
export function maintenanceKcal(profile: CoachProfile): number {
  return Math.round(bmrMifflin(profile) * ACTIVITY_FACTOR[profile.activity]);
}

export function isUnderweight(profile: CoachProfile): boolean {
  return bmi(profile) < UNDERWEIGHT_BMI;
}

// The goal we actually plan for: no fat-loss plans for someone already underweight.
export function effectiveGoal(profile: CoachProfile): GoalBuild {
  return isUnderweight(profile) && profile.goalBuild === 'loseFat' ? 'maintain' : profile.goalBuild;
}

// Lowest calorie target allowed for this person: the higher of the sex-based floor
// and maintenance minus the max deficit. Underweight: never below maintenance.
export function minimumKcal(profile: CoachProfile): number {
  const maintenance = maintenanceKcal(profile);
  if (isUnderweight(profile)) return maintenance;
  return Math.max(KCAL_FLOOR[profile.sex], maintenance - MAX_DEFICIT_KCAL);
}

// Rejects inputs we won't plan for, with a kind message. null = OK.
export function checkProfile(profile: CoachProfile): string | null {
  if (profile.age < 18) {
    return 'The Coach is for adults (18+). For now, focus on regular meals, plenty of water, good sleep, and moving in ways you enjoy, like sports or walking with friends.';
  }
  const b = bmi(profile);
  if (b < 12 || b > 80) {
    return 'Those height and weight numbers look unusual. Please double-check them (and the units) and try again.';
  }
  return null;
}

export interface SafetyResult {
  plan: AiPlan;
  notes: string[]; // shown to the user so changes are transparent
}

// Clamp the AI's plan to the guardrails. Returns a corrected copy plus notes
// explaining anything that changed.
export function applySafety(plan: AiPlan, profile: CoachProfile): SafetyResult {
  const notes: string[] = [];
  const next: AiPlan = { ...plan };
  const minKcal = minimumKcal(profile);

  if (next.dailyKcal < minKcal) {
    notes.push(
      isUnderweight(profile)
        ? `Your calorie target was raised to ${minKcal} kcal, enough to maintain or gently gain weight.`
        : `Your calorie target was raised to ${minKcal} kcal so the deficit stays gentle and safe.`,
    );
    next.dailyKcal = minKcal;
  }

  // Pace: never faster than ~1 kg/week loss; no loss at all when underweight.
  if (isUnderweight(profile) && next.weeklyPaceKg < 0) {
    next.weeklyPaceKg = 0;
    notes.push('This plan focuses on maintaining or gently gaining, not losing weight.');
  } else if (next.weeklyPaceKg < -MAX_LOSS_KG_PER_WEEK) {
    next.weeklyPaceKg = -MAX_LOSS_KG_PER_WEEK;
    notes.push('Weekly pace capped at 1 kg loss per week, which is a sustainable maximum.');
  }

  if (profile.health.hasCondition) {
    notes.push('You mentioned a health condition, injury or pregnancy. Please check this plan with your doctor before starting.');
  }

  // Protein: keep it in a sensible range (about 0.8-2.2 g per kg).
  const proteinMin = Math.round(profile.weightKg * 0.8);
  const proteinMax = Math.round(profile.weightKg * 2.2);
  next.dailyProteinG = Math.min(proteinMax, Math.max(proteinMin, Math.round(next.dailyProteinG)));
  next.dailyKcal = Math.round(next.dailyKcal);

  return { plan: next, notes };
}

// Structural checks that a JSON schema can't express. Returns problems (empty = OK);
// the server sends these back to the AI on its one retry.
export function findPlanProblems(plan: AiPlan, profile: CoachProfile): string[] {
  const problems: string[] = [];
  if (plan.routines.length < 2 || plan.routines.length > 4) problems.push('routines must contain 2 to 4 routines');
  if (plan.schedule.length !== 7) problems.push('schedule must have exactly 7 entries (Monday to Sunday)');
  const ids = new Set(plan.routines.map((r) => r.id));
  plan.schedule.forEach((id, day) => {
    if (id !== null && !ids.has(id)) problems.push(`schedule[${day}] refers to unknown routine id "${id}"`);
  });
  const trainingDays = plan.schedule.filter((id) => id !== null).length;
  if (trainingDays > profile.daysPerWeek) problems.push(`schedule has ${trainingDays} training days but the user can train ${profile.daysPerWeek} days`);
  if (plan.mealPlan.length !== 7) problems.push('mealPlan must have exactly 7 days');
  if (plan.tips.length < 3 || plan.tips.length > 5) problems.push('tips must have 3 to 5 items');
  for (const r of plan.routines) {
    if (r.exercises.length === 0) problems.push(`routine "${r.id}" has no exercises`);
    for (const e of r.exercises) {
      if (e.reps === undefined && e.durationSec === undefined) problems.push(`exercise "${e.name}" needs reps or durationSec`);
    }
  }
  return problems;
}

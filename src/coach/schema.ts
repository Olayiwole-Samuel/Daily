// Zod schemas for the AI Coach, shared by the browser app and the server function.
// One source of truth: TypeScript types are derived from these with z.infer, so the
// client and server can never disagree about the shape of a plan.
//
// IMPORTANT: this file must not import other project files. The Vercel server
// function imports it directly, and keeping it standalone keeps that simple.
import { z } from 'zod';

// ---------- Profile (what the user tells us) ----------

export const GoalBuildSchema = z.enum(['loseFat', 'leanToned', 'buildMuscle', 'athletic', 'maintain']);
export type GoalBuild = z.infer<typeof GoalBuildSchema>;

export const CoachProfileSchema = z.object({
  goalBuild: GoalBuildSchema,
  age: z.number().int().min(10).max(100),
  sex: z.enum(['male', 'female']),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  waistCm: z.number().min(40).max(200).optional(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'very']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerSession: z.number().int().min(15).max(120),
  place: z.enum(['home', 'gym', 'outdoors']),
  equipment: z.array(z.string().max(60)).max(30),
  nationality: z.string().min(2).max(60),
  dislikes: z.array(z.string().max(60)).max(30),
  dietary: z.array(z.string().max(60)).max(20),
  budget: z.enum(['low', 'medium', 'high']),
  mealsPerDay: z.number().int().min(2).max(6),
  health: z.object({
    hasCondition: z.boolean(),
    notes: z.string().max(500).optional(),
  }),
  photoProvided: z.boolean(),
});
export type CoachProfile = z.infer<typeof CoachProfileSchema>;

// ---------- Plan pieces ----------
// These schemas are also sent to Claude as the required output format (structured
// outputs), so they stay simple: no min/max rules here. Counts and safety limits
// are checked in code on the server afterwards.

export const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.number().int(),
  reps: z.number().int().optional(), // either reps...
  durationSec: z.number().int().optional(), // ...or a timed hold/interval
  restSec: z.number().int(),
  weightKg: z.number().optional(),
  howTo: z.string(), // one-line form cue
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const RoutineSchema = z.object({
  id: z.string(),
  name: z.string(),
  warmUp: z.string(),
  coolDown: z.string(),
  exercises: z.array(ExerciseSchema),
  estimatedMin: z.number().int(),
});
export type Routine = z.infer<typeof RoutineSchema>;

// Index = weekday (0 = Monday ... 6 = Sunday); value = routine id, or null for rest.
// (An array of 7 is easier to validate and read than an object keyed "0".."6".)
export const WorkoutScheduleSchema = z.array(z.string().nullable());
export type WorkoutSchedule = z.infer<typeof WorkoutScheduleSchema>;

export const MealSchema = z.object({
  name: z.string(),
  foods: z.array(z.object({ item: z.string(), portion: z.string() })),
  kcal: z.number(),
  proteinG: z.number(),
});
export type Meal = z.infer<typeof MealSchema>;

export const DayMealsSchema = z.object({
  day: z.number().int(), // 0 = Monday
  breakfast: MealSchema,
  lunch: MealSchema,
  dinner: MealSchema,
  snacks: z.array(MealSchema),
});
export type DayMeals = z.infer<typeof DayMealsSchema>;

// Exactly what Claude must return.
export const AiPlanSchema = z.object({
  bodySummary: z.string(),
  estimateNote: z.string().optional(),
  weeklyPaceKg: z.number(), // negative = loss per week, positive = gain
  routines: z.array(RoutineSchema),
  schedule: WorkoutScheduleSchema,
  progression: z.string(),
  dailyKcal: z.number(),
  dailyProteinG: z.number(),
  nutritionWhy: z.string(),
  mealPlan: z.array(DayMealsSchema),
  swaps: z.array(z.object({ instead: z.string(), have: z.string() })),
  groceryList: z.array(z.object({ section: z.string(), items: z.array(z.string()) })),
  tips: z.array(z.string()),
});
export type AiPlan = z.infer<typeof AiPlanSchema>;

// What the app stores: the AI plan plus things the server adds.
export const CoachPlanSchema = AiPlanSchema.extend({
  createdAt: z.string(),
  safetyNotes: z.array(z.string()), // e.g. "Calories raised to a safe minimum"
  demo: z.boolean().optional(), // true when the server had no API key (sample plan)
});
export type CoachPlan = z.infer<typeof CoachPlanSchema>;

// ---------- Tracking (device only) ----------

export const SetLogSchema = z.object({
  done: z.boolean(),
  reps: z.number().optional(),
  durationSec: z.number().optional(),
  weightKg: z.number().optional(),
});
export type SetLog = z.infer<typeof SetLogSchema>;

export const WorkoutSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  routineId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  exercises: z.array(z.object({ exerciseId: z.string(), sets: z.array(SetLogSchema) })),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export const WeighInSchema = z.object({ id: z.string(), date: z.string(), kg: z.number() });
export type WeighIn = z.infer<typeof WeighInSchema>;

// ---------- API request / response ----------

export const CoachRequestSchema = z.object({
  deviceId: z.string().min(8).max(100),
  profile: CoachProfileSchema,
  // JPEG compressed on the device. ~300 KB of image is ~400 KB of base64.
  photo: z
    .object({
      mediaType: z.literal('image/jpeg'),
      data: z.string().max(600_000),
    })
    .optional(),
  // Sent when regenerating, so the new plan can build on how things went.
  history: z
    .object({
      latestWeighInKg: z.number().optional(),
      startWeightKg: z.number().optional(),
      sessionSummary: z.string().max(1500).optional(),
      feedback: z.string().max(500).optional(),
    })
    .optional(),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export type CoachErrorCode = 'invalid_input' | 'under_18' | 'rate_limited' | 'ai_failed' | 'server_error';

export type CoachResponse =
  | { ok: true; plan: CoachPlan; remainingToday: number }
  | { ok: false; code: CoachErrorCode; message: string };

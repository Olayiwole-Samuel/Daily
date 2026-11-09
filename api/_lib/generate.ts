// Calls Claude to write the plan, with structured outputs, one retry, and refusal handling.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AiPlanSchema, type AiPlan, type CoachRequest } from '../../src/coach/schema.js';
import { bmi, effectiveGoal, findPlanProblems, isUnderweight, maintenanceKcal, minimumKcal } from '../../src/coach/safety.js';

// The model the spec asks for: reads photos (vision) and follows a JSON schema well.
const MODEL = 'claude-sonnet-5-5';

// The coach's standing instructions. Kept constant (no dates or per-user text) so
// the same text is sent every time.
const SYSTEM_PROMPT = `You are a supportive fitness and nutrition coach inside a personal goals app. You write one complete weekly plan for one adult.

Tone: neutral, warm and encouraging. Never shame, judge or use negative words about anyone's body. Describe body shape plainly and kindly (for example "carries more weight around the middle").

Photo (only if one is attached): use it only to describe general body shape and where weight is carried. If you mention body fat, give a range and label it clearly as a rough visual estimate, never as fact, and put that in estimateNote. Base every number on the typed details, not the photo.

Workouts:
- Use only exercises possible with the stated place and equipment.
- Fit the stated number of training days (put rest days, as null, in the schedule) and the stated minutes per session.
- schedule is 7 entries, Monday first; each entry is a routine id or null for rest.
- 2 to 4 routines. Each has a warm-up, exercises and a cool-down, and an estimatedMin that fits the session length.
- Each exercise has a short unique id, sets, either reps or durationSec (not both), restSec, an optional weightKg, and a one-line form cue in howTo.
- Beginners get easier versions (incline push-ups, assisted squats, shorter holds).
- progression: a simple rule for the next 4 weeks.

Meals:
- Use common, affordable, everyday foods from the user's nationality or cuisine, within their budget. For Nigerian, for example: beans, moi moi, akara, plantain, yam, ofada or jollof rice, eba, amala or fufu with efo riro or okra soup, fish, chicken, eggs, suya, garden egg, fruits. Avoid foods they could not easily buy.
- Respect dislikes and dietary needs strictly (vegetarian, halal, no pork, allergies).
- Give portions in everyday local measures (a fist-sized wrap of eba, cooking spoons of rice, a medium piece of fish), plus approximate kcal and protein per meal.
- mealPlan has 7 days (day 0 = Monday) with breakfast, lunch, dinner and snacks; the number of snacks fits the meals per day the user wants.
- Daily totals should be close to dailyKcal.
- swaps: healthier versions of favourite local dishes (boiled or roasted plantain instead of fried dodo, less oil in stews).
- groceryList: one week of shopping grouped by market section.

Targets and safety:
- Use the computed numbers in the request. dailyKcal must not go below the given minimum. Fat loss pace is at most 0.5 to 1 kg per week (weeklyPaceKg is negative for loss, positive for gain, 0 to maintain). Muscle gain is slower (about 0.25 kg per week).
- If the user is underweight, do not plan any weight loss: plan to maintain or gently gain, and explain this kindly.
- If the user reports a medical condition, injury or pregnancy: keep everything gentle and low impact, avoid anything that could aggravate what they described, and say clearly in bodySummary to check with a doctor before starting.

tips: 3 to 5 short, specific habits for this person (water, sleep, eating out, and so on).

Write in plain, simple English. Output only the JSON object that matches the schema.`;

const GOAL_LABELS: Record<string, string> = {
  loseFat: 'Lose fat',
  leanToned: 'Lean and toned',
  buildMuscle: 'Build muscle',
  athletic: 'Athletic',
  maintain: 'Maintain',
};

// The per-user part: their answers plus numbers we computed, so the AI aims at
// targets that will already pass our safety checks.
function buildUserText(request: CoachRequest): string {
  const { profile, history } = request;
  const goal = effectiveGoal(profile);
  const lines = [
    'Write my plan. My details:',
    JSON.stringify({ ...profile, health: profile.health }, null, 2),
    '',
    'Computed for you:',
    `- BMI: ${bmi(profile).toFixed(1)}${isUnderweight(profile) ? ' (underweight range: no weight loss)' : ''}`,
    `- Estimated maintenance: about ${maintenanceKcal(profile)} kcal per day`,
    `- Minimum allowed dailyKcal: ${minimumKcal(profile)}`,
    `- Goal to plan for: ${GOAL_LABELS[goal]}${goal !== profile.goalBuild ? ` (changed from ${GOAL_LABELS[profile.goalBuild]} because of the BMI)` : ''}`,
  ];
  if (history) {
    lines.push('', 'This is a new version of an earlier plan. How it went:');
    if (history.startWeightKg !== undefined) lines.push(`- Starting weight: ${history.startWeightKg} kg`);
    if (history.latestWeighInKg !== undefined) lines.push(`- Latest weigh-in: ${history.latestWeighInKg} kg`);
    if (history.sessionSummary) lines.push(`- Training: ${history.sessionSummary}`);
    if (history.feedback) lines.push(`- My feedback: ${history.feedback}`);
    lines.push('Progress the plan sensibly from here.');
  }
  if (request.photo) lines.push('', 'A current photo is attached.');
  return lines.join('\n');
}

export type GenerateResult =
  | { ok: true; plan: AiPlan }
  | { ok: false; reason: 'refusal' | 'invalid'; detail: string };

export async function generatePlan(client: Anthropic, request: CoachRequest): Promise<GenerateResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (request.photo) {
    // Image first, then the text that refers to it. Sent for this request only; never stored.
    content.push({ type: 'image', source: { type: 'base64', media_type: request.photo.mediaType, data: request.photo.data } });
  }
  content.push({ type: 'text', text: buildUserText(request) });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content }];

  let lastProblems: string[] = [];
  // At most 2 attempts: the first, and one retry that is told what was wrong.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Structured outputs: the reply must match AiPlanSchema.
      // Medium effort keeps the wait reasonable for a long plan.
      output_config: { effort: 'medium', format: betaZodOutputFormat(AiPlanSchema) },
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, reason: 'refusal', detail: response.stop_details?.category ?? 'declined' };
    }

    const plan = response.parsed_output;
    if (response.stop_reason === 'max_tokens' || !plan) {
      lastProblems = ['The plan was cut off before it finished. Keep every text field shorter so the whole plan fits.'];
    } else {
      lastProblems = findPlanProblems(plan, request.profile);
      if (lastProblems.length === 0) return { ok: true, plan };
    }

    // Retry: show Claude its own answer and exactly what to fix.
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: `Please fix these problems and return the complete corrected plan:\n- ${lastProblems.join('\n- ')}`,
    });
  }
  return { ok: false, reason: 'invalid', detail: lastProblems.join('; ') };
}

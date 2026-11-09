// POST /api/coach — builds a personal workout + meal plan with Claude.
//
// Runs on the server (a Vercel serverless function), so the Anthropic API key in
// process.env.ANTHROPIC_API_KEY never reaches the browser.
// Privacy: the photo is used for this one request only. It is never saved or logged.
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CoachRequestSchema, type AiPlan, type CoachPlan, type CoachResponse } from '../src/coach/schema.js';
import { applySafety, checkProfile, findPlanProblems } from '../src/coach/safety.js';
import { generatePlan } from './_lib/generate.js';
import { samplePlan } from './_lib/samplePlan.js';

// ---------- Abuse limit: 5 plans per device per day ----------
// LIMITATION: this lives in the function's memory. Vercel may run several copies
// and restarts them often, so it is a soft limit, not a guarantee. For a hard
// limit, store the counts in a database such as Upstash Redis (Vercel Marketplace).
const DAILY_LIMIT = 5;
const usage = new Map<string, { day: string; count: number }>();

function usedToday(deviceId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const record = usage.get(deviceId);
  return record && record.day === today ? record.count : 0;
}

function recordUse(deviceId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  usage.set(deviceId, { day: today, count: usedToday(deviceId) + 1 });
}

function send(res: VercelResponse, status: number, body: CoachResponse): void {
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { ok: false, code: 'invalid_input', message: 'Use POST.' });
    return;
  }

  // 1. Check the input shape (numbers in sensible ranges, photo size, etc.).
  const body: unknown = req.body;
  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    send(res, 400, { ok: false, code: 'invalid_input', message: `Please check your details (${issue.path.join('.') || 'request'}: ${issue.message}).` });
    return;
  }
  const request = parsed.data;

  // 2. Adults only, and numbers that make sense.
  const profileProblem = checkProfile(request.profile);
  if (profileProblem) {
    send(res, 400, { ok: false, code: request.profile.age < 18 ? 'under_18' : 'invalid_input', message: profileProblem });
    return;
  }

  // 3. Daily limit per device.
  if (usedToday(request.deviceId) >= DAILY_LIMIT) {
    send(res, 429, { ok: false, code: 'rate_limited', message: `You've made ${DAILY_LIMIT} plans today. Try again tomorrow.` });
    return;
  }

  // 4. Get a plan: from Claude, or the built-in sample when no key is set.
  let aiPlan: AiPlan;
  const demo = !process.env.ANTHROPIC_API_KEY;
  if (demo) {
    aiPlan = samplePlan(request.profile);
  } else {
    try {
      const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
      const result = await generatePlan(client, request);
      if (!result.ok) {
        console.error('Coach plan failed:', result.reason, result.detail); // no profile or photo in logs
        send(res, 502, {
          ok: false,
          code: 'ai_failed',
          message:
            result.reason === 'refusal'
              ? "The coach couldn't write this plan. Try changing your health notes or details, then try again."
              : "The coach's answer didn't come out right. Please try again.",
        });
        return;
      }
      aiPlan = result.plan;
    } catch (error) {
      // Typed SDK errors, most specific first. Only the status/message is logged.
      if (error instanceof Anthropic.AuthenticationError) {
        console.error('Anthropic API key rejected');
        send(res, 500, { ok: false, code: 'server_error', message: 'The coach is not set up correctly on the server.' });
      } else if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)) {
        console.error('Anthropic busy:', error.status);
        send(res, 503, { ok: false, code: 'ai_failed', message: 'The coach is busy right now. Please try again in a minute.' });
      } else if (error instanceof Anthropic.APIError) {
        console.error('Anthropic API error:', error.status, error.message);
        send(res, 502, { ok: false, code: 'ai_failed', message: 'Something went wrong creating your plan. Please try again.' });
      } else {
        console.error('Coach server error:', error instanceof Error ? error.message : 'unknown');
        send(res, 500, { ok: false, code: 'server_error', message: 'Something went wrong on our side. Please try again.' });
      }
      return;
    }
  }

  // 5. Safety rules again, in code, whatever the AI said.
  const { plan: safePlan, notes } = applySafety(aiPlan, request.profile);
  const problems = findPlanProblems(safePlan, request.profile);
  if (problems.length > 0) {
    console.error('Plan failed final checks:', problems.join('; '));
    send(res, 502, { ok: false, code: 'ai_failed', message: "The coach's answer didn't come out right. Please try again." });
    return;
  }

  recordUse(request.deviceId);
  const plan: CoachPlan = { ...safePlan, createdAt: new Date().toISOString(), safetyNotes: notes, demo: demo || undefined };
  send(res, 200, { ok: true, plan, remainingToday: DAILY_LIMIT - usedToday(request.deviceId) });
}

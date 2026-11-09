// Browser side of the Coach API: sends the request, turns every failure into a
// friendly message, and falls back to the free planner on the phone when offline.
import type { CoachInfo, CoachPlan, CoachRequest, CoachResponse } from './schema';
import { CoachPlanSchema } from './schema';
import { createRulePlan } from './rules/planner';
import { newId } from '../lib/dates';

const DEVICE_KEY = 'weekly-goals-device-id';

// A random id for this device, used only for the "5 AI plans per day" limit.
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return newId(); // storage blocked: a fresh id per session is fine
  }
}

// Is AI switched on (server has an API key)? If we can't tell, assume not:
// then photos are never sent anywhere.
export async function getCoachInfo(): Promise<CoachInfo> {
  try {
    const response = await fetch('/api/coach');
    if (!response.ok) return { ai: false };
    const data = (await response.json()) as Partial<CoachInfo>;
    return { ai: data.ai === true };
  } catch {
    return { ai: false };
  }
}

export type PlanResult = { ok: true; plan: CoachPlan } | { ok: false; message: string };

export async function requestPlan(body: Omit<CoachRequest, 'deviceId'>): Promise<PlanResult> {
  let response: Response;
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, deviceId: getDeviceId() }),
    });
  } catch {
    // No connection: build the plan right here with the free planner.
    return { ok: true, plan: createRulePlan(body, Math.floor(Math.random() * 2 ** 31)) };
  }

  let data: CoachResponse;
  try {
    data = (await response.json()) as CoachResponse;
  } catch {
    return { ok: false, message: 'The coach took too long or sent an unexpected reply. Please try again.' };
  }
  if (!data.ok) return { ok: false, message: data.message };

  // Double-check the plan's shape before saving it, so a bad reply can't break screens.
  const checked = CoachPlanSchema.safeParse(data.plan);
  if (!checked.success) return { ok: false, message: "The plan didn't come out right. Please try again." };
  return { ok: true, plan: checked.data };
}

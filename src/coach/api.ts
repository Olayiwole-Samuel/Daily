// Browser side of the Coach API: sends the request, turns every failure into a
// friendly message.
import type { CoachPlan, CoachRequest, CoachResponse } from './schema';
import { CoachPlanSchema } from './schema';
import { newId } from '../lib/dates';

const DEVICE_KEY = 'weekly-goals-device-id';

// A random id for this device, used only for the "5 plans per day" limit.
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

export type PlanResult = { ok: true; plan: CoachPlan; remainingToday: number } | { ok: false; message: string };

export async function requestPlan(body: Omit<CoachRequest, 'deviceId'>): Promise<PlanResult> {
  let response: Response;
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, deviceId: getDeviceId() }),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the coach. Check your internet connection and try again." };
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
  return { ok: true, plan: checked.data, remainingToday: data.remainingToday };
}

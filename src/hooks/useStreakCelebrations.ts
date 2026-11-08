import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../state/AppContext';
import { getPerfectDayStreak, getStreak, milestoneReached } from '../lib/streaks';
import { useToday } from './useToday';

const NEON = ['#00f0ff', '#ff2bd6', '#39ff14', '#ffe600', '#b026ff', '#ff8a00'];

// Two cannons from the bottom corners, then a burst of stars from the middle.
export function neonConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shared = { colors: NEON, particleCount: 90, spread: 70, startVelocity: 60, ticks: 220 };
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.9 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.9 } });
  window.setTimeout(() => confetti({ colors: NEON, particleCount: 60, spread: 360, startVelocity: 30, shapes: ['star'], scalar: 1.4, origin: { y: 0.45 } }), 250);
}

// Key used in celebratedStreaks for the overall perfect-day streak.
export const PERFECT_DAY_KEY = 'perfect-day';

// Watches all streaks. When one reaches 3, 7, 14 or 30 and that milestone hasn't
// been celebrated yet, fires confetti, shows a toast, and records it so it fires once.
export function useStreakCelebrations() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const checks: { key: string; label: string; count: number; unit: string }[] = [];

    for (const goal of state.goals) {
      if (goal.archived) continue;
      const streak = getStreak(goal, state.entries, today);
      if (streak) {
        checks.push({ key: goal.id, label: goal.title, count: streak.current, unit: streak.unit === 'weeks' ? 'week' : 'day' });
      }
    }
    const perfect = getPerfectDayStreak(state.goals, state.entries, today);
    checks.push({ key: PERFECT_DAY_KEY, label: 'perfect days', count: perfect.current, unit: 'day' });

    for (const { key, label, count, unit } of checks) {
      const reached = milestoneReached(count);
      const celebrated = state.celebratedStreaks[key] ?? 0;
      if (reached > celebrated) {
        setMessage(`🔥 ${reached}-${unit} streak on ${label}!`);
        neonConfetti();
        dispatch({ type: 'MARK_CELEBRATED', key, milestone: reached });
        return; // one celebration at a time; the next runs after this state update
      }
      if (reached < celebrated) {
        // The streak broke since we celebrated. Lower the record so the same
        // milestones can be celebrated again when the user builds it back up.
        dispatch({ type: 'MARK_CELEBRATED', key, milestone: reached });
        return;
      }
    }
  }, [state.goals, state.entries, state.celebratedStreaks, today, dispatch]);

  return { message, clear: () => setMessage(null) };
}

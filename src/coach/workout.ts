// Workout helpers used by the plan screen and the session player. Pure functions, tested.
import type { Exercise, SetLog, WeighIn, WorkoutSchedule, WorkoutSession } from './schema';
import type { ISODate } from '../types';
import { weekdayIndex } from '../lib/dates';

// Which routine id (or null for rest) is planned for this date.
export function getRoutineForDate(schedule: WorkoutSchedule, date: ISODate): string | null {
  return schedule[weekdayIndex(date)] ?? null;
}

// Finished sessions, newest first.
function finishedNewestFirst(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((s) => s.finishedAt).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

// The sets logged for this exercise in the most recent session that included it.
export function getLastPerformance(sessions: WorkoutSession[], exerciseId: string): SetLog[] | null {
  for (const session of finishedNewestFirst(sessions)) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (log && log.sets.some((s) => s.done)) return log.sets;
  }
  return null;
}

// A gentle "try a bit more" hint: after 2 sessions in a row where every set was
// completed, suggest +2 reps (or +5 seconds). It's only a hint; nothing changes automatically.
export function suggestProgression(sessions: WorkoutSession[], exercise: Exercise): string | null {
  const recent = finishedNewestFirst(sessions)
    .map((s) => s.exercises.find((e) => e.exerciseId === exercise.id))
    .filter((e): e is { exerciseId: string; sets: SetLog[] } => e !== undefined)
    .slice(0, 2);
  if (recent.length < 2) return null;
  const allDone = recent.every((e) => e.sets.length >= exercise.sets && e.sets.every((s) => s.done));
  if (!allDone) return null;
  return exercise.durationSec !== undefined
    ? `Strong work! Try ${exercise.durationSec + 5} s this time.`
    : `Strong work! Try ${(exercise.reps ?? 0) + 2} reps this time.`;
}

export interface WeightTrend {
  startKg: number;
  latestKg: number;
  changeKg: number; // latest - start (negative = lost)
  points: { date: ISODate; kg: number }[]; // sorted oldest first
}

export function getWeightTrend(weighIns: WeighIn[]): WeightTrend | null {
  if (weighIns.length === 0) return null;
  const points = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map(({ date, kg }) => ({ date, kg }));
  const startKg = points[0].kg;
  const latestKg = points[points.length - 1].kg;
  return { startKg, latestKg, changeKg: Math.round((latestKg - startKg) * 10) / 10, points };
}

// Short text summary of recent training, sent to the AI when regenerating a plan.
export function summarizeRecentSessions(sessions: WorkoutSession[], sinceDate: ISODate): string {
  const recent = sessions.filter((s) => s.finishedAt && s.date >= sinceDate);
  if (recent.length === 0) return 'No workouts logged in the last 2 weeks.';
  let sets = 0;
  let done = 0;
  for (const s of recent) {
    for (const e of s.exercises) {
      sets += e.sets.length;
      done += e.sets.filter((x) => x.done).length;
    }
  }
  const rate = sets === 0 ? 0 : Math.round((done / sets) * 100);
  return `${recent.length} workouts in the last 2 weeks, ${rate}% of planned sets completed.`;
}

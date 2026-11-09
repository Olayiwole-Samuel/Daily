import { Link } from 'react-router-dom';
import { Dumbbell, Play } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { getRoutineForDate } from '../../coach/workout';
import type { ISODate } from '../../types';

// Shown inside Today's Workout goal card when an AI Coach plan exists:
// today's routine with a Start button, or "Rest day" with a make-up option.
export default function TodayWorkout({ date }: { date: ISODate }) {
  const { state } = useApp();
  const plan = state.coachPlan;
  if (!plan) return null;

  const routine = plan.routines.find((r) => r.id === getRoutineForDate(plan.schedule, date));
  const resumable = state.activeSession && plan.routines.some((r) => r.id === state.activeSession?.routineId) ? state.activeSession : undefined;
  const doneToday = state.sessions.some((s) => s.date === date && s.finishedAt);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-violet-100/60 p-2 text-sm dark:bg-white/5">
      <Dumbbell className="h-4 w-4 text-neon-cyan" aria-hidden />
      <span className="min-w-0 flex-1">{routine ? `${routine.name} · ${routine.estimatedMin} min` : 'Rest day'}</span>
      {resumable ? (
        <Link to={`/coach/session/${resumable.routineId}`} className="btn-primary min-h-[40px] px-3 text-sm">
          <Play className="h-4 w-4" aria-hidden /> Resume
        </Link>
      ) : doneToday ? null : routine ? (
        <Link to={`/coach/session/${routine.id}`} className="btn-primary min-h-[40px] px-3 text-sm">
          <Play className="h-4 w-4" aria-hidden /> Start workout
        </Link>
      ) : (
        <Link to="/coach" className="btn-secondary min-h-[40px] px-3 text-sm">
          Make-up workout
        </Link>
      )}
    </div>
  );
}

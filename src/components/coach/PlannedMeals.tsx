import { Link } from 'react-router-dom';
import { Utensils } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { weekdayIndex } from '../../lib/dates';
import type { ISODate } from '../../types';
import { DayMealsList } from '../../pages/coach/CoachPage';

// On the Food page: the AI Coach's planned meals for the chosen day, above the
// meal log, so you can log what you actually ate against the plan.
export default function PlannedMeals({ date }: { date: ISODate }) {
  const { state } = useApp();
  const day = state.coachPlan?.mealPlan.find((d) => d.day === weekdayIndex(date));
  if (!day || !state.coachPlan) return null;

  return (
    <details className="card group" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
        <span className="flex items-center gap-2">
          <Utensils className="h-5 w-5 text-neon-yellow" aria-hidden /> Planned meals
        </span>
        <span className="muted text-xs font-normal">{state.coachPlan.dailyKcal} kcal target · tap to hide</span>
      </summary>
      <DayMealsList day={day} />
      <Link to="/coach/meals" className="text-sm font-semibold text-neon-pink dark:text-neon-cyan">
        Week plan, swaps and grocery list →
      </Link>
    </details>
  );
}

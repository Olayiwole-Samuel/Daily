import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Goal } from '../types';
import { useApp } from '../state/AppContext';
import { useToday } from '../hooks/useToday';
import { addDaysISO, formatWeekRange, weekDays, weekStart } from '../lib/dates';
import { getDayStatus, getWeekProgress } from '../lib/progress';
import { getStreak } from '../lib/streaks';
import DateNav from '../components/DateNav';
import ProgressBar from '../components/ProgressBar';
import StreakBadge from '../components/StreakBadge';
import WeekGrid from '../components/WeekGrid';
import NeonEdge from '../components/NeonEdge';
import SwipeDays from '../components/SwipeDays';
import { motion } from 'framer-motion';

// The unit to show next to the numbers on each card.
function progressUnit(goal: Goal): string {
  switch (goal.type) {
    case 'daily':
    case 'journal':
      return 'days';
    case 'milestones':
      return 'milestones';
    default:
      return goal.unit ?? '';
  }
}

export default function WeekPage() {
  const { state } = useApp();
  const today = useToday();
  const thisWeek = weekStart(today);
  const [picked, setPicked] = useState<string | null>(null);
  const week = picked ?? thisWeek;
  const days = weekDays(week);
  const isFutureWeek = week > thisWeek;

  const goals = state.goals.filter((g) => !g.archived);

  return (
    <div className="space-y-5">
      <DateNav
        label={formatWeekRange(week)}
        sublabel={week === thisWeek ? 'This week' : week < thisWeek ? 'Past week' : 'Upcoming week'}
        onPrev={() => setPicked(addDaysISO(week, -7))}
        onNext={() => setPicked(addDaysISO(week, 7))}
        prevLabel="Previous week"
        nextLabel="Next week"
        onReset={week !== thisWeek ? () => setPicked(null) : undefined}
        resetLabel="Back to this week"
      />

      <SwipeDays swipeKey={week} onPrev={() => setPicked(addDaysISO(week, -7))} onNext={() => setPicked(addDaysISO(week, 7))}>
      <div className="space-y-5">

      {goals.length === 0 && (
        <div className="card text-center">
          <p className="muted">No goals yet.</p>
          <Link to="/goals" className="btn-primary mt-4">
            Set up goals
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {goals.map((goal, i) => {
          const progress = getWeekProgress(goal, state.entries, week, today);
          const statuses = days.map((d) => getDayStatus(goal, state.entries, d, today));
          const streak = getStreak(goal, state.entries, today);
          const unit = progressUnit(goal);
          const complete = progress.target > 0 && progress.actual >= progress.target;
          // Status label: done beats on-track; future weeks and empty targets get no label.
          const status =
            isFutureWeek || progress.target === 0 ? null : complete ? 'Done' : progress.onTrack ? 'On track' : 'Behind';

          return (
            <motion.li
              key={goal.id}
              className="card relative space-y-3 overflow-hidden pl-5"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 240, damping: 22 }}
            >
              <NeonEdge color={goal.color} />
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 font-semibold">{goal.title}</h2>
                {status && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      status === 'Behind'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {status}
                  </span>
                )}
                <StreakBadge streak={streak} />
              </div>

              {progress.target > 0 ? (
                <div className="space-y-1">
                  <ProgressBar value={progress.actual} max={progress.target} color={goal.color} label={`${goal.title} progress`} />
                  <p className="muted text-sm">
                    {progress.actual}/{progress.target} {unit}
                  </p>
                </div>
              ) : (
                <p className="muted text-sm">Nothing planned this week.</p>
              )}

              <WeekGrid statuses={statuses} color={goal.color} />
            </motion.li>
          );
        })}
      </ul>
      </div>
      </SwipeDays>
    </div>
  );
}

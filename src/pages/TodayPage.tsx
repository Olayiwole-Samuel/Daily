import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useToday } from '../hooks/useToday';
import { neonConfetti } from '../hooks/useStreakCelebrations';
import { addDaysISO, formatLong } from '../lib/dates';
import { getDueGoals, getGoalsForDate, goalStartDate, isGoalDoneOnDate, milestonesForDate } from '../lib/progress';
import { getPerfectDayStreak } from '../lib/streaks';
import DateNav from '../components/DateNav';
import ProgressRing from '../components/ProgressRing';
import GoalCard from '../components/GoalCard';
import SwipeDays from '../components/SwipeDays';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

// Hype line under the ring. A ternary chain picks the message by how far along you are.
function hypeLine(done: number, total: number): string {
  if (total === 0) return 'Rest day. Recharge those tubes.';
  const left = total - done;
  return done === total
    ? 'All done. Absolute legend. 👑'
    : done === 0
      ? `${total} goals. Let's get it. ⚡`
      : left === 1
        ? 'One more. Finish strong! 🔥'
        : done / total >= 0.5
          ? `${left} to go. You're cooking. 🔥`
          : `${left} to go. Warming up… ✨`;
}

export default function TodayPage() {
  const { state } = useApp();
  const { user } = useAuth();
  const today = useToday();
  // null means "follow today", so the page rolls over at midnight by itself.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;

  // Cards to show: scheduled that weekday, existed by then, and (for milestone
  // goals) with at least one milestone to show on that day.
  const goals = getGoalsForDate(state.goals, date).filter(
    (g) => date >= goalStartDate(g, state.entries) && (g.type !== 'milestones' || milestonesForDate(g, date).length > 0),
  );
  const due = getDueGoals(state.goals, state.entries, date);
  const doneCount = due.filter((g) => isGoalDoneOnDate(g, state.entries, date)).length;
  const perfect = getPerfectDayStreak(state.goals, state.entries, today);
  const allDone = due.length > 0 && doneCount === due.length;

  // Confetti the moment the day flips to 100% (not when you merely open a finished day).
  const wasAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasAllDone.current) neonConfetti();
    wasAllDone.current = allDone;
  }, [allDone]);
  // Switching days shouldn't count as "just finished".
  useEffect(() => {
    wasAllDone.current = allDone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const label = date === today ? 'Today' : date === addDaysISO(today, -1) ? 'Yesterday' : date === addDaysISO(today, 1) ? 'Tomorrow' : formatLong(date);
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-5">
      <motion.p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-neon-pink" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {greeting()}, {firstName}
      </motion.p>

      <DateNav
        label={label}
        sublabel={formatLong(date)}
        onPrev={() => setPicked(addDaysISO(date, -1))}
        onNext={() => setPicked(addDaysISO(date, 1))}
        prevLabel="Previous day"
        nextLabel="Next day"
        onReset={date !== today ? () => setPicked(null) : undefined}
        resetLabel="Back to today"
      />

      <SwipeDays swipeKey={date} onPrev={() => setPicked(addDaysISO(date, -1))} onNext={() => setPicked(addDaysISO(date, 1))}>
      <div className="space-y-5">
      <motion.section
        className="card flex items-center gap-5"
        aria-label="Day summary"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <ProgressRing done={doneCount} total={due.length} />
        <div className="min-w-0 space-y-2">
          <motion.p key={hypeLine(doneCount, due.length)} className="text-lg font-bold leading-snug" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {hypeLine(doneCount, due.length)}
          </motion.p>
          <p className="flex items-center gap-2 text-sm">
            <Flame
              className={`h-6 w-6 shrink-0 ${perfect.current > 0 ? 'animate-flame-dance fill-yellow-300 text-orange-500' : 'text-slate-400'}`}
              style={perfect.current > 0 ? { filter: 'drop-shadow(0 0 6px #ff8a00)' } : undefined}
              aria-hidden
            />
            <span>
              <strong className="text-base text-orange-500 dark:text-orange-300">{perfect.current}</strong> perfect {perfect.current === 1 ? 'day' : 'days'} in a row
            </span>
          </p>
          <p className="muted text-xs">Best: {perfect.best}</p>
        </div>
      </motion.section>

      {date > today && <p className="muted text-center text-sm">This day hasn't happened yet, so it's view-only. 👀</p>}

      {state.goals.length === 0 ? (
        <div className="card text-center">
          <p className="text-lg font-bold">No goals yet</p>
          <p className="muted mt-1 text-sm">Add goals or load your week template to get started.</p>
          <Link to="/goals" className="btn-primary mt-4">
            Set up goals ✨
          </Link>
        </div>
      ) : goals.length === 0 ? (
        <p className="muted text-center">No goals scheduled for this day.</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal, i) => (
            <GoalCard key={`${goal.id}-${date}`} goal={goal} date={date} today={today} index={i} />
          ))}
        </ul>
      )}
      </div>
      </SwipeDays>
    </div>
  );
}

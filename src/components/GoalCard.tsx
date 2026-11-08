import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import type { Goal, ISODate } from '../types';
import { useApp } from '../state/AppContext';
import { motion } from 'framer-motion';
import { getEntry, isGoalDoneOnDate, milestonesForDate, weekTotal, weeklyTarget } from '../lib/progress';
import { getStreak } from '../lib/streaks';
import { weekStart } from '../lib/dates';
import StreakBadge from './StreakBadge';
import DailyCheck from './goal-controls/DailyCheck';
import CountCheck from './goal-controls/CountCheck';
import NumberInput from './goal-controls/NumberInput';
import MilestoneList from './goal-controls/MilestoneList';
import JournalInput from './goal-controls/JournalInput';

interface Props {
  goal: Goal;
  date: ISODate;
  today: ISODate;
  index: number; // position in the list, for the staggered entrance
}

// One goal on the Today screen: header, then the right control for its type.
export default function GoalCard({ goal, date, today, index }: Props) {
  const { state, dispatch } = useApp();
  const entry = getEntry(state.entries, goal.id, date);
  const streak = getStreak(goal, state.entries, today);
  const isFuture = date > today; // can't tick off days that haven't happened

  const setDone = (done: boolean) => dispatch({ type: 'SET_ENTRY', goalId: goal.id, date, patch: { done } });
  // useCallback keeps the same function between renders, so JournalInput's
  // save timer isn't restarted by unrelated re-renders.
  const setText = useCallback(
    (text: string) => dispatch({ type: 'SET_ENTRY', goalId: goal.id, date, patch: { text } }),
    [dispatch, goal.id, date],
  );

  function renderControl() {
    switch (goal.type) {
      case 'daily':
        return <DailyCheck checked={!!entry?.done} onChange={setDone} color={goal.color} label={`${goal.title} done`} disabled={isFuture} />;
      case 'weeklyCount':
        return (
          <CountCheck
            checked={!!entry?.done}
            onChange={setDone}
            color={goal.color}
            label={`${goal.title} done`}
            disabled={isFuture}
            weekCount={weekTotal(goal, state.entries, weekStart(date))}
            target={weeklyTarget(goal)}
            unit={goal.unit}
          />
        );
      case 'numberTarget':
        return (
          <NumberInput
            value={entry?.value}
            onChange={(value) => dispatch({ type: 'SET_ENTRY', goalId: goal.id, date, patch: { value } })}
            weekTotal={weekTotal(goal, state.entries, weekStart(date))}
            target={weeklyTarget(goal)}
            unit={goal.unit}
            disabled={isFuture}
          />
        );
      case 'milestones':
        return (
          <MilestoneList
            milestones={milestonesForDate(goal, date)}
            date={date}
            color={goal.color}
            disabled={isFuture}
            onToggle={(milestoneId) => dispatch({ type: 'TOGGLE_MILESTONE', goalId: goal.id, milestoneId, date })}
          />
        );
      case 'journal':
        return <JournalInput key={date} value={entry?.text ?? ''} onChange={setText} disabled={isFuture} label={`${goal.title} entry`} />;
    }
  }

  // The template's "Log my meals" goal gets a shortcut to the Food page.
  const linksToFood = /meal|food/i.test(goal.title);

  const done = isGoalDoneOnDate(goal, state.entries, date);

  return (
    <motion.li
      layout
      className="card relative overflow-hidden pl-5"
      // Cards slide up one after another; finished cards glow in their colour.
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: done ? `0 0 0 1px ${goal.color}66, 0 0 14px ${goal.color}22` : '0 0 0 1px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)',
      }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
      whileHover={{ y: -2 }}
    >
      {/* Neon tube down the left edge */}
      <span
        aria-hidden
        className="absolute inset-y-3 left-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: goal.color, boxShadow: `0 0 6px ${goal.color}88` }}
      />
      {/* Soft colour wash in the corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: goal.color }}
      />
      <div className="relative mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{goal.title}</h2>
          {goal.note && <p className="muted text-sm">{goal.note}</p>}
        </div>
        <StreakBadge streak={streak} />
      </div>
      <div className="relative">{renderControl()}</div>
      {linksToFood && (
        <Link
          to="/food"
          className="relative mt-1 inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold hover:underline"
          style={{ color: goal.color }}
        >
          <UtensilsCrossed className="h-4 w-4" aria-hidden /> Open food log →
        </Link>
      )}
    </motion.li>
  );
}

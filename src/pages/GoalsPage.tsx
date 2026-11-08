import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Sparkles } from 'lucide-react';
import type { Goal } from '../types';
import { GOAL_TYPE_LABELS } from '../types';
import { useApp } from '../state/AppContext';
import GoalForm, { emptyGoal } from '../components/GoalForm';
import ConfirmDialog from '../components/ConfirmDialog';
import NeonEdge from '../components/NeonEdge';
import BottomSheet from '../components/BottomSheet';
import { motion } from 'framer-motion';
import { ALL_DAYS, WEEKDAY_SHORT, todayISO } from '../lib/dates';

// "Every day", "Mon–Fri", or a list like "Mon, Wed, Fri".
function describeDays(goal: Goal): string {
  const days = goal.scheduledDays;
  if (days.length === ALL_DAYS.length) return 'Every day';
  if (days.join() === '0,1,2,3,4') return 'Mon–Fri';
  return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

function describeTarget(goal: Goal): string | null {
  if (goal.type === 'weeklyCount' || goal.type === 'numberTarget') return `${goal.target} ${goal.unit ?? ''}/week`.replace(' /', '/');
  if (goal.type === 'milestones') return `${goal.milestones?.length ?? 0} milestones`;
  return null;
}

export default function GoalsPage() {
  const { state, dispatch } = useApp();
  // The goal being added or edited. It stays set while the sheet slides away,
  // so the form doesn't vanish mid-animation; `formOpen` controls visibility.
  const [editing, setEditingGoal] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const setEditing = (goal: Goal | null) => {
    if (goal) setEditingGoal(goal);
    setFormOpen(goal !== null);
  };
  const [archiveTarget, setArchiveTarget] = useState<Goal | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = state.goals.filter((g) => !g.archived);
  const archived = state.goals.filter((g) => g.archived);
  const isNew = editing !== null && !state.goals.some((g) => g.id === editing.id);

  function save(goal: Goal) {
    dispatch(isNew ? { type: 'ADD_GOAL', goal } : { type: 'UPDATE_GOAL', goal });
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <BottomSheet open={formOpen} onClose={() => setEditing(null)} title={isNew ? 'New goal ✨' : 'Edit goal'} tall>
        {/* key resets the form's local state for each goal */}
        {editing && <GoalForm key={editing.id} initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
      </BottomSheet>

      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">Goals</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing(emptyGoal())}>
          <Plus className="h-5 w-5" aria-hidden /> Add goal
        </button>
      </div>

      {active.length === 0 && (
        <div className="card space-y-3 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-neon-cyan animate-glow-pulse [--glow:#00f0ff]" aria-hidden />
          <p className="font-medium">No goals yet</p>
          <p className="muted text-sm">Start from your week plan (7 goals plus eating rules) or add your own.</p>
          <button type="button" className="btn-primary w-full" onClick={() => dispatch({ type: 'LOAD_TEMPLATE', today: todayISO() })}>
            Load my week template
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {active.map((goal, i) => (
          <motion.li
            key={goal.id}
            className="card relative flex items-center gap-3 overflow-hidden pl-5"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <NeonEdge color={goal.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{goal.title}</p>
              <p className="muted text-sm">
                {GOAL_TYPE_LABELS[goal.type]} · {describeDays(goal)}
                {describeTarget(goal) && ` · ${describeTarget(goal)}`}
              </p>
              {goal.note && <p className="muted text-sm">{goal.note}</p>}
            </div>
            <button type="button" className="icon-btn" aria-label={`Edit ${goal.title}`} onClick={() => setEditing(goal)}>
              <Pencil className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" className="icon-btn" aria-label={`Archive ${goal.title}`} onClick={() => setArchiveTarget(goal)}>
              <Archive className="h-5 w-5" aria-hidden />
            </button>
          </motion.li>
        ))}
      </ul>

      {archived.length > 0 && (
        <div>
          <button type="button" className="muted text-sm font-medium underline-offset-2 hover:underline" onClick={() => setShowArchived((s) => !s)} aria-expanded={showArchived}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2">
              {archived.map((goal) => (
                <li key={goal.id} className="card flex items-center gap-3 opacity-70">
                  <p className="flex-1 truncate">{goal.title}</p>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Restore ${goal.title}`}
                    onClick={() => dispatch({ type: 'ARCHIVE_GOAL', goalId: goal.id, archived: false })}
                  >
                    <ArchiveRestore className="h-5 w-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`Archive "${archiveTarget?.title ?? ''}"?`}
        message="It will be hidden from Today and Week. Its history is kept, and you can restore it any time."
        confirmLabel="Archive"
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) dispatch({ type: 'ARCHIVE_GOAL', goalId: archiveTarget.id, archived: true });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}

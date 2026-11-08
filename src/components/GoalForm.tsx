import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Goal, GoalType, Milestone, Weekday } from '../types';
import { GOAL_TYPE_LABELS } from '../types';
import { ALL_DAYS, WEEKDAY_SHORT, newId, todayISO } from '../lib/dates';

export const GOAL_COLORS = ['#ff2bd6', '#00f0ff', '#39ff14', '#ffe600', '#b026ff', '#ff8a00', '#ff3864', '#00ffc6', '#6e7bff', '#ff9ff3'];

const TYPE_HELP: Record<GoalType, string> = {
  daily: 'Tick it off on each scheduled day.',
  weeklyCount: 'Tick it on any day; hit a number of times per week.',
  numberTarget: 'Log a number each day; it adds up toward a weekly total.',
  milestones: 'A list of things to finish, each with an optional planned day.',
  journal: 'Write one short entry per day.',
};

// Types that have a weekly target number.
const hasTarget = (type: GoalType) => type === 'weeklyCount' || type === 'numberTarget';

export function emptyGoal(): Goal {
  return {
    id: newId(),
    title: '',
    type: 'daily',
    color: GOAL_COLORS[0],
    scheduledDays: [...ALL_DAYS],
    archived: false,
    createdAt: todayISO(),
  };
}

interface Props {
  initial: Goal;
  onSave: (goal: Goal) => void;
  onCancel: () => void;
}

export default function GoalForm({ initial, onSave, onCancel }: Props) {
  // The form edits a local copy ("draft") and only saves on submit.
  const [draft, setDraft] = useState<Goal>(initial);
  const [error, setError] = useState<string | null>(null);

  // Small helper so each input can update one field.
  const set = <K extends keyof Goal>(key: K, value: Goal[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleDay = (day: Weekday) =>
    set(
      'scheduledDays',
      draft.scheduledDays.includes(day)
        ? draft.scheduledDays.filter((d) => d !== day)
        : [...draft.scheduledDays, day].sort((a, b) => a - b),
    );

  const milestones = draft.milestones ?? [];
  const setMilestone = (id: string, patch: Partial<Milestone>) =>
    set('milestones', milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return setError('Give the goal a title.');
    if (draft.scheduledDays.length === 0) return setError('Pick at least one day.');
    if (hasTarget(draft.type) && !(draft.target && draft.target > 0)) return setError('Set a weekly target above 0.');

    // Drop fields that don't apply to this type, and empty milestone rows.
    onSave({
      ...draft,
      title: draft.title.trim(),
      note: draft.note?.trim() || undefined,
      unit: hasTarget(draft.type) ? draft.unit?.trim() || undefined : undefined,
      target: hasTarget(draft.type) ? draft.target : undefined,
      milestones:
        draft.type === 'milestones'
          ? milestones.filter((m) => m.title.trim()).map((m) => ({ ...m, title: m.title.trim(), plannedDate: m.plannedDate || undefined }))
          : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-2" noValidate>
      <div>
        <label htmlFor="goal-title" className="label">
          Title
        </label>
        <input id="goal-title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Read the book" autoFocus />
      </div>

      <div>
        <label htmlFor="goal-type" className="label">
          Type
        </label>
        <select id="goal-type" className="input" value={draft.type} onChange={(e) => set('type', e.target.value as GoalType)}>
          {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((t) => (
            <option key={t} value={t}>
              {GOAL_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="muted mt-1 text-sm">{TYPE_HELP[draft.type]}</p>
      </div>

      {hasTarget(draft.type) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="goal-target" className="label">
              Weekly target
            </label>
            <input
              id="goal-target"
              type="number"
              inputMode="numeric"
              min={1}
              className="input"
              value={draft.target ?? ''}
              onChange={(e) => set('target', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="goal-unit" className="label">
              Unit
            </label>
            <input
              id="goal-unit"
              className="input"
              value={draft.unit ?? ''}
              onChange={(e) => set('unit', e.target.value)}
              placeholder={draft.type === 'numberTarget' ? 'pages' : 'times'}
            />
          </div>
        </div>
      )}

      <fieldset>
        <legend className="label">Show on</legend>
        <div className="grid grid-cols-7 gap-1">
          {ALL_DAYS.map((day) => {
            const on = draft.scheduledDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={`min-h-[44px] rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
                  on ? 'bg-gradient-to-br from-neon-pink to-neon-violet text-white shadow-neon-pink' : 'border border-violet-300 text-violet-700 dark:border-white/15 dark:text-violet-200'
                }`}
              >
                {WEEKDAY_SHORT[day]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={draft.color === c}
              onClick={() => set('color', c)}
              className={`h-9 w-9 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 ${
                draft.color === c ? 'ring-2 scale-110 ring-white ring-offset-2 ring-offset-night-900' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex items-center gap-2 text-sm">
            <span className="muted">Custom</span>
            <input type="color" value={draft.color} onChange={(e) => set('color', e.target.value)} className="h-9 w-12 cursor-pointer rounded bg-transparent" />
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="goal-note" className="label">
          Note <span className="muted font-normal">(optional)</span>
        </label>
        <input id="goal-note" className="input" value={draft.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="e.g. 6:00am" />
      </div>

      {draft.type === 'milestones' && (
        <fieldset>
          <legend className="label">Milestones</legend>
          <ul className="space-y-2">
            {milestones.map((m, i) => (
              // Wraps onto two lines on narrow phones: title on top, date + delete below.
              <li key={m.id} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  className="input basis-full sm:basis-auto sm:flex-1"
                  aria-label={`Milestone ${i + 1} title`}
                  value={m.title}
                  onChange={(e) => setMilestone(m.id, { title: e.target.value })}
                  placeholder="e.g. Arrow functions"
                />
                <input
                  type="date"
                  className="input min-w-0 flex-1 sm:w-44 sm:flex-none"
                  aria-label={`Milestone ${i + 1} planned day`}
                  value={m.plannedDate ?? ''}
                  onChange={(e) => setMilestone(m.id, { plannedDate: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn shrink-0"
                  aria-label={`Remove milestone ${i + 1}`}
                  onClick={() => set('milestones', milestones.filter((x) => x.id !== m.id))}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-2" onClick={() => set('milestones', [...milestones, { id: newId(), title: '' }])}>
            <Plus className="h-4 w-4" aria-hidden /> Add milestone
          </button>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save goal
        </button>
      </div>
    </form>
  );
}

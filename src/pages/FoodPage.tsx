import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { FoodEntry, Meal } from '../types';
import { MEALS } from '../types';
import { useApp } from '../state/AppContext';
import { useToday } from '../hooks/useToday';
import { addDaysISO, formatLong } from '../lib/dates';
import DateNav from '../components/DateNav';
import IOSSwitch from '../components/IOSSwitch';
import SwipeDays from '../components/SwipeDays';
import PlannedMeals from '../components/coach/PlannedMeals';

const MEAL_LABELS: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

// Eating rules: a read-only checklist that switches to an editor on demand.
function EatingRules() {
  const { state, dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(state.eatingRules);

  function save() {
    dispatch({ type: 'SET_EATING_RULES', rules: draft.map((r) => r.trim()).filter(Boolean) });
    setEditing(false);
  }

  return (
    <section className="card" aria-labelledby="rules-heading">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="rules-heading" className="font-semibold">
          Eating rules
        </h2>
        {!editing && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Edit eating rules"
            onClick={() => {
              setDraft(state.eatingRules);
              setEditing(true);
            }}
          >
            <Pencil className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((rule, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                aria-label={`Rule ${i + 1}`}
                value={rule}
                onChange={(e) => setDraft(draft.map((r, j) => (j === i ? e.target.value : r)))}
              />
              <button type="button" className="icon-btn shrink-0" aria-label={`Remove rule ${i + 1}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setDraft([...draft, ''])}>
              <Plus className="h-4 w-4" aria-hidden /> Add rule
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : state.eatingRules.length === 0 ? (
        <p className="muted text-sm">No rules yet. Tap the pencil to add some.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {state.eatingRules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface MealRowProps {
  meal: Meal;
  entry: FoodEntry | undefined;
  onText: (text: string) => void;
  onPlan: (onPlan: boolean) => void;
}

function MealRow({ meal, entry, onText, onPlan }: MealRowProps) {
  // Local text while typing; saved after a short pause (same idea as the journal).
  const saved = entry?.text ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => {
    if (text === saved) return;
    const timer = window.setTimeout(() => onText(text), 400);
    return () => window.clearTimeout(timer);
  }, [text, saved, onText]);

  const id = `meal-${meal}`;
  const plan = entry?.onPlan ?? false;

  return (
    <div className="card space-y-2">
      <label htmlFor={id} className="font-semibold">
        {MEAL_LABELS[meal]}
      </label>
      <input
        id={id}
        className="input"
        value={text}
        placeholder="What did you eat?"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== saved && onText(text)}
      />
      {/* iOS settings-style row: label on the left, switch on the right */}
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-violet-100 pt-2 dark:border-white/10">
        <span className="text-sm font-medium">{plan ? 'On plan ✅' : 'On plan?'}</span>
        <IOSSwitch checked={plan} onChange={onPlan} label={`${MEAL_LABELS[meal]} on plan`} />
      </div>
    </div>
  );
}

export default function FoodPage() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;

  const entryFor = (meal: Meal) => state.food.find((f) => f.date === date && f.meal === meal);

  return (
    <div className="space-y-4">
      <DateNav
        label={date === today ? 'Food today' : formatLong(date)}
        sublabel={date === today ? formatLong(date) : undefined}
        onPrev={() => setPicked(addDaysISO(date, -1))}
        onNext={() => setPicked(addDaysISO(date, 1))}
        prevLabel="Previous day"
        nextLabel="Next day"
        onReset={date !== today ? () => setPicked(null) : undefined}
        resetLabel="Back to today"
      />
      <EatingRules />
      <PlannedMeals date={date} />
      <SwipeDays swipeKey={date} onPrev={() => setPicked(addDaysISO(date, -1))} onNext={() => setPicked(addDaysISO(date, 1))}>
        <div className="space-y-4">
          {MEALS.map((meal) => (
            <MealRow
              // key includes the date so the local text resets when you change day
              key={`${date}-${meal}`}
              meal={meal}
              entry={entryFor(meal)}
              onText={(text) => dispatch({ type: 'SET_FOOD', date, meal, patch: { text } })}
              onPlan={(onPlan) => dispatch({ type: 'SET_FOOD', date, meal, patch: { onPlan } })}
            />
          ))}
        </div>
      </SwipeDays>
    </div>
  );
}

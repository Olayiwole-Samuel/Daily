import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Repeat, ShoppingBasket } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToday } from '../../hooks/useToday';
import { weekdayIndex, WEEKDAY_SHORT } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import SegmentedControl from '../../components/SegmentedControl';
import { Disclaimer } from '../../components/coach/Controls';
import { DayMealsList } from './CoachPage';

export default function MealsPage() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [day, setDay] = useState(String(weekdayIndex(today)));
  const plan = state.coachPlan;

  if (!plan) {
    return (
      <div className="card text-center">
        <p>No meal plan yet.</p>
        <Link to="/coach" className="btn-primary mt-3">Go to Coach</Link>
      </div>
    );
  }

  const meals = plan.mealPlan.find((d) => String(d.day) === day);
  const dayTotal = meals ? [meals.breakfast, meals.lunch, meals.dinner, ...meals.snacks].reduce((sum, m) => sum + m.kcal, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/coach" className="icon-btn" aria-label="Back to My plan">
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Link>
        <h1 className="page-title">Meals</h1>
      </div>

      <SegmentedControl
        label="Day"
        value={day}
        onChange={setDay}
        options={WEEKDAY_SHORT.map((label, i) => ({ value: String(i), label: label.slice(0, 2) }))}
      />

      {meals && (
        <section className="card" aria-label={`${WEEKDAY_SHORT[Number(day)]} meals`}>
          <p className="muted text-sm">
            About <strong className="text-slate-900 dark:text-white">{Math.round(dayTotal)} kcal</strong> today · target {plan.dailyKcal}
          </p>
          <DayMealsList day={meals} />
        </section>
      )}

      {plan.swaps.length > 0 && (
        <section className="card space-y-2" aria-labelledby="swaps">
          <h2 id="swaps" className="flex items-center gap-2 font-bold">
            <Repeat className="h-5 w-5 text-neon-lime" aria-hidden /> Healthier swaps
          </h2>
          <ul className="space-y-2 text-sm">
            {plan.swaps.map((s, i) => (
              <li key={i} className="rounded-2xl bg-violet-100/60 p-2 dark:bg-white/5">
                <span className="muted line-through">{s.instead}</span> → <span className="font-semibold">{s.have}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3" aria-labelledby="grocery">
        <h2 id="grocery" className="flex items-center gap-2 font-bold">
          <ShoppingBasket className="h-5 w-5 text-neon-orange" aria-hidden /> Grocery list
        </h2>
        {plan.groceryList.map((group) => (
          <div key={group.section}>
            <h3 className="muted mb-1 text-xs font-semibold uppercase tracking-wider">{group.section}</h3>
            <ul>
              {group.items.map((item) => {
                const key = `${group.section}|${item}`;
                const checked = state.groceryChecked.includes(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => {
                        haptic();
                        dispatch({ type: 'TOGGLE_GROCERY', key });
                      }}
                      className="flex min-h-[44px] w-full items-center gap-3 text-left text-sm"
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-neon-lime bg-neon-lime' : 'border-violet-300 dark:border-white/25'}`} aria-hidden>
                        {checked && <Check className="h-4 w-4 text-night-950" strokeWidth={3} />}
                      </span>
                      <span className={checked ? 'muted line-through' : ''}>{item}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      <Disclaimer />
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Bot, ChevronRight, Dumbbell, LineChart, Loader2, Pencil, Play, RefreshCw, ShieldCheck, Target, Utensils } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToday } from '../../hooks/useToday';
import { requestPlan } from '../../coach/api';
import { getRoutineForDate, getWeightTrend, summarizeRecentSessions } from '../../coach/workout';
import { addDaysISO, weekDays, weekStart, weekdayIndex, WEEKDAY_SHORT } from '../../lib/dates';
import type { DayMeals, Meal } from '../../coach/schema';
import BottomSheet from '../../components/BottomSheet';
import { Disclaimer } from '../../components/coach/Controls';

export function MealLine({ label, meal }: { label: string; meal: Meal }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          <span className="muted mr-2 text-xs uppercase tracking-wider">{label}</span>
          {meal.name}
        </p>
        <span className="muted shrink-0 text-xs tabular-nums">
          {Math.round(meal.kcal)} kcal · {Math.round(meal.proteinG)} g protein
        </span>
      </div>
      <ul className="muted mt-1 text-sm">
        {meal.foods.map((f, i) => (
          <li key={i}>
            {f.item} <span className="text-neon-pink dark:text-pink-300">— {f.portion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayMealsList({ day }: { day: DayMeals }) {
  return (
    <div className="divide-y divide-violet-100 dark:divide-white/10">
      <MealLine label="Breakfast" meal={day.breakfast} />
      <MealLine label="Lunch" meal={day.lunch} />
      <MealLine label="Dinner" meal={day.dinner} />
      {day.snacks.map((s, i) => (
        <MealLine key={i} label="Snack" meal={s} />
      ))}
    </div>
  );
}

function CoachIntro() {
  return (
    <div className="space-y-5">
      <h1 className="page-title">AI Coach</h1>
      <motion.div className="card space-y-4 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-pink via-neon-violet to-neon-cyan">
          <Bot className="h-8 w-8 text-white" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-bold">Your personal workout and meal plan</p>
          <p className="muted mt-1 text-sm">
            Answer a few questions (about 2 minutes). The coach builds a weekly workout plan for your space and time, and meals from your own country's foods.
          </p>
        </div>
        <ul className="space-y-2 text-left text-sm">
          <li className="flex gap-2"><Dumbbell className="h-5 w-5 shrink-0 text-neon-cyan" aria-hidden /> Guided workouts with a rest timer</li>
          <li className="flex gap-2"><Utensils className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden /> 7-day meal plan in everyday local portions</li>
          <li className="flex gap-2"><LineChart className="h-5 w-5 shrink-0 text-neon-lime" aria-hidden /> Weigh-ins and progress</li>
        </ul>
        <Link to="/coach/start" className="btn-primary w-full">
          Get started
        </Link>
        <p className="muted text-xs">For adults 18+. General guidance, not medical advice.</p>
      </motion.div>
    </div>
  );
}

export default function CoachPage() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const navigate = useNavigate();
  const [regenOpen, setRegenOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const plan = state.coachPlan;
  const profile = state.coachProfile;
  if (!plan || !profile) return <CoachIntro />;

  const todayRoutineId = getRoutineForDate(plan.schedule, today);
  const todayRoutine = plan.routines.find((r) => r.id === todayRoutineId);
  const todayMeals = plan.mealPlan.find((d) => d.day === weekdayIndex(today));
  const doneToday = state.sessions.some((s) => s.date === today && s.finishedAt);
  const resumable = state.activeSession && plan.routines.some((r) => r.id === state.activeSession?.routineId) ? state.activeSession : undefined;
  const linkable = state.goals.filter((g) => !g.archived && (g.type === 'daily' || g.type === 'weeklyCount'));
  const pace = plan.weeklyPaceKg;

  async function regenerate() {
    if (!profile) return;
    setRegenBusy(true);
    setRegenError(null);
    const trend = getWeightTrend(state.weighIns);
    // Use the latest weigh-in as the current weight, so targets follow progress.
    const updatedProfile = trend ? { ...profile, weightKg: trend.latestKg, photoProvided: false } : { ...profile, photoProvided: false };
    const result = await requestPlan({
      profile: updatedProfile,
      history: {
        startWeightKg: trend?.startKg,
        latestWeighInKg: trend?.latestKg,
        sessionSummary: summarizeRecentSessions(state.sessions, addDaysISO(today, -14)),
        feedback: feedback.trim() || undefined,
      },
    });
    setRegenBusy(false);
    if (!result.ok) {
      setRegenError(result.message);
      return;
    }
    dispatch({ type: 'SET_COACH_PROFILE', profile: updatedProfile });
    dispatch({ type: 'SET_COACH_PLAN', plan: result.plan });
    setRegenOpen(false);
    setFeedback('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">My plan</h1>
        <button type="button" className="btn-secondary min-h-[40px] px-3 text-sm" onClick={() => navigate('/coach/start?edit=1')}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit details
        </button>
      </div>

      {plan.demo && (
        <p className="flex gap-2 rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
          Sample plan: the server has no AI key yet, so this isn't personalised.
        </p>
      )}

      {/* Today's workout */}
      <section className="card space-y-3" aria-labelledby="today-workout">
        <h2 id="today-workout" className="flex items-center gap-2 font-bold">
          <Dumbbell className="h-5 w-5 text-neon-cyan" aria-hidden /> Today's workout
        </h2>
        {resumable ? (
          <Link to={`/coach/session/${resumable.routineId}`} className="btn-primary w-full">
            <Play className="h-5 w-5" aria-hidden /> Resume workout
          </Link>
        ) : todayRoutine ? (
          <>
            <p>
              <span className="font-semibold">{todayRoutine.name}</span> <span className="muted">· about {todayRoutine.estimatedMin} min · {todayRoutine.exercises.length} exercises</span>
            </p>
            {doneToday ? (
              <p className="font-semibold text-neon-lime">Done for today. Nice work! 💪</p>
            ) : (
              <Link to={`/coach/session/${todayRoutine.id}`} className="btn-primary w-full">
                <Play className="h-5 w-5" aria-hidden /> Start workout
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="muted">Rest day. Recovery is part of the plan.</p>
            <div className="flex flex-wrap gap-2">
              {plan.routines.map((r) => (
                <Link key={r.id} to={`/coach/session/${r.id}`} className="btn-secondary min-h-[40px] text-sm">
                  Make-up: {r.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* This week */}
      <section className="card" aria-labelledby="week-schedule">
        <h2 id="week-schedule" className="mb-3 font-bold">This week</h2>
        <ol className="grid grid-cols-7 gap-1">
          {weekDays(weekStart(today)).map((date, i) => {
            const routine = plan.routines.find((r) => r.id === plan.schedule[i]);
            const done = state.sessions.some((s) => s.date === date && s.finishedAt);
            const isToday = date === today;
            return (
              <li
                key={date}
                className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-center ${isToday ? 'bg-neon-cyan/10 ring-1 ring-neon-cyan/60' : ''}`}
                aria-label={`${WEEKDAY_SHORT[i]}: ${routine ? routine.name : 'rest'}${done ? ', done' : ''}`}
              >
                <span className="muted text-[11px] font-semibold">{WEEKDAY_SHORT[i]}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done ? 'bg-neon-lime text-night-950' : routine ? 'border-2 border-neon-pink text-neon-pink' : 'muted border border-dashed border-violet-200 dark:border-white/15'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : routine ? routine.id.slice(0, 2) : '–'}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="muted mt-2 text-xs">{plan.routines.map((r) => `${r.id.slice(0, 2)} = ${r.name}`).join(' · ')}</p>
      </section>

      {/* Body summary + targets */}
      <section className="card space-y-3" aria-labelledby="summary">
        <h2 id="summary" className="flex items-center gap-2 font-bold">
          <Target className="h-5 w-5 text-neon-pink" aria-hidden /> Your starting point
        </h2>
        <p className="text-sm leading-relaxed">{plan.bodySummary}</p>
        {plan.estimateNote && <p className="muted text-xs italic">{plan.estimateNote}</p>}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-violet-100/60 p-2 dark:bg-white/5">
            <p className="text-xl font-bold tabular-nums">{plan.dailyKcal}</p>
            <p className="muted text-xs">kcal / day</p>
          </div>
          <div className="rounded-2xl bg-violet-100/60 p-2 dark:bg-white/5">
            <p className="text-xl font-bold tabular-nums">{plan.dailyProteinG} g</p>
            <p className="muted text-xs">protein / day</p>
          </div>
          <div className="rounded-2xl bg-violet-100/60 p-2 dark:bg-white/5">
            <p className="text-xl font-bold tabular-nums">{pace === 0 ? '±0' : `${pace > 0 ? '+' : ''}${pace}`} kg</p>
            <p className="muted text-xs">per week</p>
          </div>
        </div>
        <p className="muted text-sm">{plan.nutritionWhy}</p>
        {plan.safetyNotes.length > 0 && (
          <ul className="space-y-1 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-sm">
            {plan.safetyNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 translate-y-0.5 text-neon-cyan" aria-hidden /> {n}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's meals */}
      {todayMeals && (
        <section className="card" aria-labelledby="today-meals">
          <div className="flex items-center justify-between">
            <h2 id="today-meals" className="flex items-center gap-2 font-bold">
              <Utensils className="h-5 w-5 text-neon-yellow" aria-hidden /> Today's meals
            </h2>
            <Link to="/coach/meals" className="flex items-center text-sm font-semibold text-neon-pink dark:text-neon-cyan">
              Full week <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <DayMealsList day={todayMeals} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/coach/meals" className="btn-secondary">
          <Utensils className="h-4 w-4" aria-hidden /> Meals
        </Link>
        <Link to="/coach/progress" className="btn-secondary">
          <LineChart className="h-4 w-4" aria-hidden /> Progress
        </Link>
      </div>

      {/* How to progress + tips */}
      <section className="card space-y-2" aria-labelledby="progress-rule">
        <h2 id="progress-rule" className="font-bold">Next 4 weeks</h2>
        <p className="text-sm">{plan.progression}</p>
        <h3 className="pt-2 font-bold">Tips for you</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {plan.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      {/* Link to the Part 1 Workout goal */}
      <section className="card space-y-2">
        <label htmlFor="workout-goal" className="font-bold">Finishing a workout ticks</label>
        <select
          id="workout-goal"
          className="input"
          value={state.workoutGoalId ?? ''}
          onChange={(e) => dispatch({ type: 'SET_WORKOUT_GOAL', goalId: e.target.value || undefined })}
        >
          <option value="">Nothing (don't link)</option>
          {linkable.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <p className="muted text-xs">This updates that goal's weekly progress and streak.</p>
      </section>

      <button type="button" className="btn-secondary w-full" onClick={() => setRegenOpen(true)}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Regenerate plan
      </button>
      <Disclaimer />

      <BottomSheet open={regenOpen} onClose={() => !regenBusy && setRegenOpen(false)} title="New plan">
        <div className="space-y-4 pb-2">
          <p className="muted text-sm">
            The coach will use your latest weigh-in and how your recent workouts went. Anything to change?
          </p>
          <label htmlFor="feedback" className="sr-only">Feedback for the coach</label>
          <textarea
            id="feedback"
            className="input"
            rows={3}
            maxLength={500}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. workouts feel too easy, I'm bored of beans, I can only train 2 days now"
          />
          {regenError && <p role="alert" className="text-sm font-medium text-red-500">{regenError}</p>}
          <button type="button" className="btn-primary min-h-[52px] w-full" onClick={regenerate} disabled={regenBusy}>
            {regenBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Writing your new plan… (about a minute)
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5" aria-hidden /> Regenerate
              </>
            )}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

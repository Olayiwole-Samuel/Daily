import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Mic, Play } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useToday } from '../hooks/useToday';
import { overdueGoals } from '../sync/shared';
import { weekdayIndex } from '../lib/dates';
import { getRoutineForDate } from '../coach/workout';
import { isGoalDoneOnDate, milestonesForDate } from '../lib/progress';
import { haptic } from '../lib/haptics';
import type { Goal } from '../types';

// ---- Speech recognition (Chrome, Edge, Safari 14.1+). Minimal types: the
// standard isn't in TypeScript's built-in browser types yet. ----
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognizerCtor = new () => Recognizer;
function getRecognizer(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function chime() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') return void ctx.close(); // browsers block sound before any tap
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.4);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    // no sound available
  }
}

// When a goal's time arrives and it isn't done, this covers the WHOLE app and
// blocks everything behind it until you finish the goal or ask it to stop.
// It can't cover other apps: phones don't allow that for web apps.
export default function GoalTakeover() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const location = useLocation();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [stopText, setStopText] = useState('');
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const recognizer = useRef<Recognizer | null>(null);

  // Re-check every 15 seconds (and when the app comes back to the screen).
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    const onVisible = () => setTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const due = overdueGoals(state.goals, state.entries, state.stoppedTakeovers ?? [], today, weekdayIndex(today), minutesNow()).filter((g) => {
    // Weekly goals: nothing to nag about once this week's target is reached.
    if ((g.type === 'weeklyCount' || g.type === 'numberTarget') && isGoalDoneOnDate(g, state.entries, today)) return false;
    // The coach-linked Workout goal: rest days are part of the plan.
    if (g.id === state.workoutGoalId && state.coachPlan && getRoutineForDate(state.coachPlan.schedule, today) === null) return false;
    return true;
  });
  // Don't interrupt a workout that's already under way.
  const goal: Goal | undefined = location.pathname.startsWith('/coach/session') ? undefined : due[0];
  void tick; // tick only forces the re-check above

  // While open: block the app behind (inert = no taps, no keyboard focus), buzz and chime.
  useEffect(() => {
    if (!goal) return;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    navigator.vibrate?.([300, 150, 300]);
    chime();
    const chimeTimer = window.setInterval(chime, 15_000);
    setStopText('');
    setHeard(null);
    setValue('');
    return () => {
      root?.removeAttribute('inert');
      window.clearInterval(chimeTimer);
      recognizer.current?.stop();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
    // Only re-run when a different goal takes over, not on every re-render.
  }, [goal?.id]);

  const stop = useCallback(() => {
    if (!goal) return;
    haptic();
    dispatch({ type: 'STOP_TAKEOVER', key: `${goal.id}|${today}` });
  }, [goal, today, dispatch]);

  // "Ask it to stop" by voice: listen for the word "stop".
  function listen() {
    const Ctor = getRecognizer();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .toLowerCase();
      setHeard(text);
      if (/\bstop\b/.test(text)) {
        r.stop();
        stop();
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognizer.current = r;
    setListening(true);
    r.start();
  }

  // Go full screen on the first tap, where the browser allows it.
  function goFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }

  if (!goal) return null;

  const isWorkout = goal.id === state.workoutGoalId && state.coachPlan;
  const routineId = isWorkout && state.coachPlan ? getRoutineForDate(state.coachPlan.schedule, today) : null;
  const milestones = goal.type === 'milestones' ? milestonesForDate(goal, today) : [];
  const setEntry = (patch: { done?: boolean; value?: number; text?: string }) => {
    haptic();
    dispatch({ type: 'SET_ENTRY', goalId: goal.id, date: today, patch });
  };

  return createPortal(
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="takeover-title"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-night-950 px-6 py-10 text-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onPointerDown={goFullscreen}
    >
      {/* Pulsing neon rings in the goal's colour */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: goal.color }}
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 3, repeat: Infinity, delay: i, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        <p className="font-mono text-5xl font-bold tabular-nums" style={{ color: goal.color, textShadow: `0 0 18px ${goal.color}88` }}>
          {goal.reminderTime}
        </p>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">It's time</p>
          <h1 id="takeover-title" className="mt-2 text-4xl font-bold leading-tight">
            {goal.title}
          </h1>
          {goal.note && <p className="mt-2 text-white/70">{goal.note}</p>}
        </div>

        {/* Do it right here */}
        <div className="space-y-3">
          {isWorkout && routineId ? (
            <button type="button" className="btn-primary min-h-[60px] w-full text-lg" onClick={() => navigate(`/coach/session/${routineId}`)}>
              <Play className="h-6 w-6" aria-hidden /> Start workout
            </button>
          ) : null}

          {(goal.type === 'daily' || goal.type === 'weeklyCount') && (
            <button type="button" className="btn-primary min-h-[60px] w-full text-lg" onClick={() => setEntry({ done: true })}>
              <Check className="h-6 w-6" aria-hidden /> Done
            </button>
          )}

          {goal.type === 'numberTarget' && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(value);
                if (n > 0) setEntry({ value: n });
              }}
            >
              <label htmlFor="takeover-number" className="sr-only">How many {goal.unit ?? ''}?</label>
              <input id="takeover-number" inputMode="numeric" className="input bg-white/10 text-center text-white" placeholder={`How many ${goal.unit ?? ''}?`} value={value} onChange={(e) => setValue(e.target.value)} />
              <button type="submit" className="btn-primary shrink-0">Log</button>
            </form>
          )}

          {goal.type === 'journal' && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (value.trim()) setEntry({ text: value.trim() });
              }}
            >
              <label htmlFor="takeover-journal" className="sr-only">Your entry</label>
              <textarea id="takeover-journal" rows={3} className="input bg-white/10 text-white" placeholder="Write it here…" value={value} onChange={(e) => setValue(e.target.value)} />
              <button type="submit" className="btn-primary w-full">Save</button>
            </form>
          )}

          {goal.type === 'milestones' &&
            milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn-secondary min-h-[52px] w-full justify-start"
                onClick={() => dispatch({ type: 'TOGGLE_MILESTONE', goalId: goal.id, milestoneId: m.id, date: today })}
              >
                <Check className="h-5 w-5" aria-hidden /> {m.title}
              </button>
            ))}
        </div>

        {/* Ask it to stop: say "stop", or type it */}
        <div className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/70">Not now? Ask it to stop.</p>
          {getRecognizer() && (
            <button type="button" className="btn-secondary w-full" onClick={listen} disabled={listening}>
              <Mic className="h-5 w-5" aria-hidden /> {listening ? 'Listening… say "stop"' : 'Say "stop"'}
            </button>
          )}
          {heard && !/\bstop\b/.test(heard) && <p className="text-xs text-white/50">Heard: "{heard}"</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (stopText.trim().toLowerCase() === 'stop') stop();
            }}
          >
            <label htmlFor="takeover-stop" className="sr-only">Type stop to end the takeover</label>
            <input
              id="takeover-stop"
              className="input bg-white/10 text-center text-white"
              placeholder='Type "stop"'
              autoComplete="off"
              value={stopText}
              onChange={(e) => setStopText(e.target.value)}
            />
            <button type="submit" className="btn-secondary shrink-0" disabled={stopText.trim().toLowerCase() !== 'stop'}>
              Stop
            </button>
          </form>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

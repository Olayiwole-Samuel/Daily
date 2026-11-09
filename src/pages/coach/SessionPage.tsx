import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Flame, Lightbulb, Play, SkipForward, Timer, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToday } from '../../hooks/useToday';
import { getLastPerformance, suggestProgression } from '../../coach/workout';
import type { Exercise, SetLog, WorkoutSession } from '../../coach/schema';
import { newId } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { neonConfetti } from '../../hooks/useStreakCelebrations';
import BottomSheet from '../../components/BottomSheet';

// Which screen of the workout we're on.
type Phase = { kind: 'warmup' } | { kind: 'exercise'; index: number } | { kind: 'cooldown' } | { kind: 'summary' };

// ---------- Helpers ----------

function beep() {
  // A short tone with the Web Audio API (no sound files needed).
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // no audio available: the vibration and visual cue still work
  }
}

// Keeps the screen on during a workout, where the browser supports it.
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // not supported or not allowed (e.g. battery saver): ignore
      }
    };
    request();
    // The lock is dropped when the app goes to the background; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => undefined);
    };
  }, []);
}

// A countdown based on a target timestamp, so it stays accurate even if the
// phone briefly pauses the page.
function useCountdown(onDone: () => void) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setEndsAt(null);
        doneRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return {
    running: endsAt !== null,
    remaining,
    start: (seconds: number) => setEndsAt(Date.now() + seconds * 1000),
    add: (seconds: number) => setEndsAt((e) => (e === null ? e : e + seconds * 1000)),
    stop: () => setEndsAt(null),
  };
}

const target = (e: Exercise) => `${e.sets} × ${e.durationSec !== undefined ? `${e.durationSec} s` : `${e.reps} reps`}${e.weightKg ? ` @ ${e.weightKg} kg` : ''}`;

function formatLast(sets: SetLog[]): string {
  return sets
    .filter((s) => s.done)
    .map((s) => (s.durationSec !== undefined ? `${s.durationSec}s` : `${s.reps ?? '?'}`) + (s.weightKg ? `@${s.weightKg}kg` : ''))
    .join(', ');
}

// ---------- Page ----------

export default function SessionPage() {
  const { routineId } = useParams();
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const today = useToday();
  useWakeLock();

  const routine = state.coachPlan?.routines.find((r) => r.id === routineId);

  // Resume the unfinished session for this routine if there is one.
  const resumed = state.activeSession && state.activeSession.routineId === routineId ? state.activeSession : undefined;
  const [session, setSession] = useState<WorkoutSession | undefined>(resumed);
  const [phase, setPhase] = useState<Phase>(() => {
    if (!resumed || !routine) return { kind: 'warmup' };
    const next = routine.exercises.findIndex((ex) => {
      const log = resumed.exercises.find((l) => l.exerciseId === ex.id);
      return !log || log.sets.filter((s) => s.done).length < ex.sets;
    });
    return next === -1 ? { kind: 'cooldown' } : { kind: 'exercise', index: next };
  });
  const [confirmQuit, setConfirmQuit] = useState(false);
  // Per-set inputs the user may adjust before ticking (actual reps / seconds / kg).
  const [inputs, setInputs] = useState<Record<string, string>>({});

  // Save progress to app state after every change, so closing the app can't lose it.
  const save = useCallback(
    (next: WorkoutSession) => {
      setSession(next);
      dispatch({ type: 'SAVE_ACTIVE_SESSION', session: next });
    },
    [dispatch],
  );

  const exercise = phase.kind === 'exercise' && routine ? routine.exercises[phase.index] : undefined;
  const log = exercise && session ? session.exercises.find((e) => e.exerciseId === exercise.id) : undefined;
  const doneSets = log?.sets.filter((s) => s.done).length ?? 0;
  const exerciseComplete = exercise ? doneSets >= exercise.sets : false;

  const goNext = useCallback(() => {
    if (!routine) return;
    setPhase((p) => (p.kind === 'exercise' && p.index + 1 < routine.exercises.length ? { kind: 'exercise', index: p.index + 1 } : { kind: 'cooldown' }));
    setInputs({});
  }, [routine]);

  const rest = useCountdown(() => {
    beep();
    navigator.vibrate?.([200, 100, 200]);
    if (exerciseComplete) goNext();
  });

  const hold = useCountdown(() => {
    beep();
    navigator.vibrate?.(300);
    if (exercise) completeSet(exercise, exercise.durationSec);
  });

  const last = useMemo(() => (exercise ? getLastPerformance(state.sessions, exercise.id) : null), [exercise, state.sessions]);
  const hint = useMemo(() => (exercise ? suggestProgression(state.sessions, exercise) : null), [exercise, state.sessions]);

  if (!routine) {
    return (
      <div className="card text-center">
        <p>That workout isn't in your current plan.</p>
        <button type="button" className="btn-primary mt-3" onClick={() => navigate('/coach')}>Back to Coach</button>
      </div>
    );
  }

  function begin() {
    if (!routine) return;
    haptic();
    if (!session) {
      save({
        id: newId(),
        date: today,
        routineId: routine.id,
        startedAt: new Date().toISOString(),
        exercises: routine.exercises.map((e) => ({ exerciseId: e.id, sets: [] })),
      });
    }
    setPhase({ kind: 'exercise', index: 0 });
  }

  function completeSet(ex: Exercise, timedSeconds?: number) {
    if (!session) return;
    haptic();
    const setIndex = (session.exercises.find((e) => e.exerciseId === ex.id)?.sets.filter((s) => s.done).length ?? 0);
    const read = (key: string, fallback?: number) => {
      const raw = inputs[`${ex.id}-${setIndex}-${key}`];
      const n = raw === undefined || raw === '' ? fallback : Number(raw);
      return n === undefined || Number.isNaN(n) ? fallback : n;
    };
    const entry: SetLog = {
      done: true,
      reps: ex.durationSec === undefined ? read('reps', ex.reps) : undefined,
      durationSec: ex.durationSec !== undefined ? (timedSeconds ?? read('sec', ex.durationSec)) : undefined,
      weightKg: read('kg', ex.weightKg),
    };
    const next: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((e) => (e.exerciseId === ex.id ? { ...e, sets: [...e.sets, entry] } : e)),
    };
    save(next);

    const isLastSet = setIndex + 1 >= ex.sets;
    const isLastExercise = routine!.exercises[routine!.exercises.length - 1].id === ex.id;
    if (!(isLastSet && isLastExercise)) rest.start(ex.restSec);
    else setPhase({ kind: 'cooldown' });
  }

  function finish() {
    if (!session) return;
    const finished = { ...session, finishedAt: new Date().toISOString() };
    dispatch({ type: 'FINISH_SESSION', session: finished });
    neonConfetti();
    navigate('/coach');
  }

  function quit() {
    dispatch({ type: 'SAVE_ACTIVE_SESSION', session: undefined });
    navigate('/coach');
  }

  const allSets = session?.exercises.flatMap((e) => e.sets) ?? [];
  const totalPlanned = routine.exercises.reduce((n, e) => n + e.sets, 0);
  const progress = phase.kind === 'warmup' ? 0 : phase.kind === 'exercise' ? (allSets.length / totalPlanned) * 100 : 100;

  // Rendered in a portal on <body> so it covers the whole screen, above the tab bar.
  return createPortal(
    <div className="fixed inset-0 z-[35] flex flex-col bg-night-950 text-white" role="dialog" aria-modal="true" aria-label={`${routine.name} workout`}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button type="button" className="icon-btn text-white" aria-label="Leave workout" onClick={() => setConfirmQuit(true)}>
          <X className="h-6 w-6" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{routine.name}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-neon-pink to-neon-cyan" animate={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <AnimatePresence mode="wait">
          <motion.div key={phase.kind === 'exercise' ? `ex-${phase.index}` : phase.kind} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.2 }} className="mx-auto max-w-md space-y-5 pt-4">
            {phase.kind === 'warmup' && (
              <>
                <p className="text-sm font-semibold uppercase tracking-widest text-neon-yellow">Warm-up</p>
                <p className="text-xl leading-relaxed">{routine.warmUp}</p>
                <p className="text-white/60">
                  {routine.exercises.length} exercises · about {routine.estimatedMin} min
                </p>
                <button type="button" className="btn-primary min-h-[60px] w-full text-lg" onClick={begin}>
                  <Play className="h-6 w-6" aria-hidden /> I'm warmed up, let's go
                </button>
              </>
            )}

            {phase.kind === 'exercise' && exercise && (
              <>
                <p className="text-sm font-semibold uppercase tracking-widest text-neon-cyan">
                  Exercise {phase.index + 1} of {routine.exercises.length}
                </p>
                <h2 className="text-3xl font-bold">{exercise.name}</h2>
                <p className="text-lg text-white/80">{exercise.howTo}</p>
                <p className="text-lg">
                  Target: <strong>{target(exercise)}</strong> · rest {exercise.restSec} s
                </p>
                {last && <p className="text-sm text-white/60">Last time: {formatLast(last)}</p>}
                {hint && (
                  <p className="flex gap-2 rounded-2xl border border-neon-lime/40 bg-neon-lime/10 p-3 text-sm">
                    <Lightbulb className="h-5 w-5 shrink-0 text-neon-lime" aria-hidden /> {hint}
                  </p>
                )}

                <ol className="space-y-2">
                  {Array.from({ length: exercise.sets }, (_, i) => {
                    const setLog = log?.sets[i];
                    const isCurrent = i === doneSets && !rest.running && !hold.running;
                    const key = (k: string) => `${exercise.id}-${i}-${k}`;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-2 rounded-2xl border p-2 ${setLog?.done ? 'border-neon-lime/50 bg-neon-lime/10' : isCurrent ? 'border-neon-cyan/60 bg-white/5' : 'border-white/10'}`}
                      >
                        <span className="w-12 shrink-0 text-center text-sm font-semibold text-white/70">Set {i + 1}</span>
                        {setLog?.done ? (
                          <span className="flex-1 font-semibold">
                            {setLog.durationSec !== undefined ? `${setLog.durationSec} s` : `${setLog.reps} reps`}
                            {setLog.weightKg ? ` @ ${setLog.weightKg} kg` : ''}
                          </span>
                        ) : (
                          <div className="flex flex-1 gap-2">
                            {exercise.durationSec === undefined ? (
                              <input
                                aria-label={`Set ${i + 1} reps`}
                                inputMode="numeric"
                                className="input min-w-0 bg-white/5 py-2 text-center text-white"
                                placeholder={`${exercise.reps} reps`}
                                value={inputs[key('reps')] ?? ''}
                                onChange={(e) => setInputs((v) => ({ ...v, [key('reps')]: e.target.value }))}
                              />
                            ) : (
                              <span className="flex flex-1 items-center text-white/70">{exercise.durationSec} s</span>
                            )}
                            {(exercise.weightKg !== undefined || state.coachProfile?.place === 'gym') && (
                              <input
                                aria-label={`Set ${i + 1} weight in kg`}
                                inputMode="decimal"
                                className="input w-20 shrink-0 bg-white/5 py-2 text-center text-white"
                                placeholder={exercise.weightKg ? `${exercise.weightKg} kg` : 'kg'}
                                value={inputs[key('kg')] ?? ''}
                                onChange={(e) => setInputs((v) => ({ ...v, [key('kg')]: e.target.value }))}
                              />
                            )}
                          </div>
                        )}
                        {!setLog?.done && isCurrent && (
                          exercise.durationSec !== undefined ? (
                            <button type="button" className="btn shrink-0 bg-neon-cyan text-night-950" onClick={() => hold.start(exercise.durationSec ?? 30)} aria-label={`Start ${exercise.durationSec} second timer for set ${i + 1}`}>
                              <Timer className="h-5 w-5" aria-hidden /> Go
                            </button>
                          ) : (
                            <button type="button" className="btn h-12 w-12 shrink-0 bg-neon-lime p-0 text-night-950" onClick={() => completeSet(exercise)} aria-label={`Set ${i + 1} done`}>
                              <Check className="h-6 w-6" strokeWidth={3} aria-hidden />
                            </button>
                          )
                        )}
                        {setLog?.done && <Check className="h-6 w-6 shrink-0 text-neon-lime" aria-hidden />}
                      </li>
                    );
                  })}
                </ol>

                {exerciseComplete && !rest.running && (
                  <button type="button" className="btn-primary min-h-[56px] w-full" onClick={goNext}>
                    Next <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                )}
                {!exerciseComplete && (
                  <button type="button" className="w-full text-center text-sm text-white/60 underline" onClick={goNext}>
                    Skip this exercise
                  </button>
                )}
              </>
            )}

            {phase.kind === 'cooldown' && (
              <>
                <p className="text-sm font-semibold uppercase tracking-widest text-neon-violet">Cool-down</p>
                <p className="text-xl leading-relaxed">{routine.coolDown}</p>
                <button type="button" className="btn-primary min-h-[60px] w-full text-lg" onClick={() => setPhase({ kind: 'summary' })}>
                  Done stretching <ChevronRight className="h-6 w-6" aria-hidden />
                </button>
              </>
            )}

            {phase.kind === 'summary' && session && (
              <div className="space-y-5 text-center">
                <Flame className="mx-auto h-16 w-16 animate-flame-dance fill-yellow-300 text-orange-500" aria-hidden />
                <h2 className="text-3xl font-bold">Workout complete!</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-2xl font-bold">{allSets.filter((s) => s.done).length}/{totalPlanned}</p>
                    <p className="text-sm text-white/60">sets</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-2xl font-bold">{Math.max(1, Math.round((Date.now() - Date.parse(session.startedAt)) / 60000))}</p>
                    <p className="text-sm text-white/60">minutes</p>
                  </div>
                </div>
                <button type="button" className="btn-primary min-h-[60px] w-full text-lg" onClick={finish}>
                  <Check className="h-6 w-6" aria-hidden /> Save workout
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rest / hold timer overlay: big numbers you can read from the floor */}
      <AnimatePresence>
        {(rest.running || hold.running) && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-night-950/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="timer"
            aria-live="polite"
          >
            <p className="text-lg font-semibold uppercase tracking-widest text-white/70">{hold.running ? 'Hold it!' : 'Rest'}</p>
            <p className={`font-bold tabular-nums ${hold.running ? 'text-neon-cyan' : 'text-neon-pink'}`} style={{ fontSize: 'min(40vw, 10rem)', lineHeight: 1 }}>
              {hold.running ? hold.remaining : rest.remaining}
            </p>
            {rest.running && exercise && !exerciseComplete && <p className="text-white/70">Next: set {doneSets + 1} of {exercise.sets}</p>}
            {rest.running && exerciseComplete && routine.exercises[phase.kind === 'exercise' ? phase.index + 1 : 0] && (
              <p className="text-white/70">Next: {routine.exercises[phase.kind === 'exercise' ? phase.index + 1 : 0]?.name}</p>
            )}
            <div className="flex gap-3">
              {rest.running && (
                <button type="button" className="btn-secondary" onClick={() => rest.add(15)}>
                  +15 s
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (hold.running) {
                    hold.stop();
                    if (exercise) completeSet(exercise, exercise.durationSec !== undefined ? exercise.durationSec - hold.remaining : undefined);
                  } else {
                    rest.stop();
                    if (exerciseComplete) goNext();
                  }
                }}
              >
                <SkipForward className="h-5 w-5" aria-hidden /> {hold.running ? 'Stop' : 'Skip rest'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Leave this workout?">
        <div className="space-y-2.5 pb-2">
          {session && (
            <button type="button" className="btn-primary min-h-[52px] w-full" onClick={() => navigate('/coach')}>
              Pause, resume later
            </button>
          )}
          {session && allSets.some((s) => s.done) && (
            <button
              type="button"
              className="btn-secondary min-h-[52px] w-full"
              onClick={() => {
                setConfirmQuit(false);
                setPhase({ kind: 'summary' });
              }}
            >
              Finish now with the sets I did
            </button>
          )}
          <button type="button" className="btn-danger min-h-[52px] w-full" onClick={quit}>
            {session ? 'Discard this workout' : 'Leave'}
          </button>
          <button type="button" className="btn-secondary min-h-[52px] w-full" onClick={() => setConfirmQuit(false)}>
            Keep going
          </button>
        </div>
      </BottomSheet>
    </div>,
    document.body,
  );
}

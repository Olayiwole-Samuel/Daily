import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Scale, Trash2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToday } from '../../hooks/useToday';
import { getWeightTrend, type WeightTrend } from '../../coach/workout';
import { compressPhoto } from '../../coach/photo';
import { formatLong, newId } from '../../lib/dates';

// A tiny line chart drawn with SVG: no chart library needed for one line.
function TrendLine({ trend }: { trend: WeightTrend }) {
  const W = 320;
  const H = 120;
  const pad = 12;
  const kgs = trend.points.map((p) => p.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const x = (i: number) => (trend.points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (trend.points.length - 1));
  const y = (kg: number) => pad + ((max - kg) * (H - 2 * pad)) / (max - min);
  const path = trend.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`Weight from ${trend.startKg} kg to ${trend.latestKg} kg`}>
      <defs>
        <linearGradient id="trend" x1="0" x2="1">
          <stop offset="0%" stopColor="#ff2bd6" />
          <stop offset="100%" stopColor="#00f0ff" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#trend)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {trend.points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.kg)} r="4" fill="#00f0ff" />
      ))}
    </svg>
  );
}

export default function ProgressPage() {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [kg, setKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const trend = getWeightTrend(state.weighIns);
  const routineName = (id: string) => state.coachPlan?.routines.find((r) => r.id === id)?.name ?? 'Workout';

  function addWeighIn(e: FormEvent) {
    e.preventDefault();
    const value = Number(kg);
    if (!(value >= 30 && value <= 300)) {
      setError('Enter your weight in kg (30-300).');
      return;
    }
    setError(null);
    dispatch({ type: 'ADD_WEIGH_IN', weighIn: { id: newId(), date: today, kg: Math.round(value * 10) / 10 } });
    setKg('');
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    try {
      // Small copy, kept only in this browser's storage. Never uploaded.
      const small = await compressPhoto(file, 480, 80 * 1024);
      dispatch({ type: 'SAVE_PHOTO', photo: { id: newId(), date: today, dataUrl: small.dataUrl } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
  }

  const sessions = [...state.sessions].filter((s) => s.finishedAt).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const photos = state.savedPhotos;
  const firstPhoto = photos[0];
  const latestPhoto = photos.length > 1 ? photos[photos.length - 1] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/coach" className="icon-btn" aria-label="Back to My plan">
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Link>
        <h1 className="page-title">Progress</h1>
      </div>

      <section className="card space-y-3" aria-labelledby="weight">
        <h2 id="weight" className="flex items-center gap-2 font-bold">
          <Scale className="h-5 w-5 text-neon-cyan" aria-hidden /> Weight
        </h2>
        {trend ? (
          <>
            <p className="text-sm">
              <span className="text-2xl font-bold tabular-nums">{trend.latestKg} kg</span>{' '}
              <span className={`font-semibold ${trend.changeKg < 0 ? 'text-neon-lime' : trend.changeKg > 0 ? 'text-neon-orange' : 'muted'}`}>
                {trend.changeKg === 0 ? 'no change' : `${trend.changeKg > 0 ? '+' : ''}${trend.changeKg} kg since start`}
              </span>
            </p>
            {trend.points.length > 1 && <TrendLine trend={trend} />}
          </>
        ) : (
          <p className="muted text-sm">No weigh-ins yet.</p>
        )}
        <form className="flex gap-2" onSubmit={addWeighIn}>
          <label htmlFor="weigh-in" className="sr-only">Today's weight in kg</label>
          <input id="weigh-in" className="input" inputMode="decimal" placeholder="Today's weight (kg)" value={kg} onChange={(e) => setKg(e.target.value)} />
          <button type="submit" className="btn-primary shrink-0">Log</button>
        </form>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <p className="muted text-xs">Weigh in at the same time of day, about once a week. Daily ups and downs are normal.</p>
        {state.weighIns.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">All weigh-ins</summary>
            <ul className="mt-2">
              {[...state.weighIns].sort((a, b) => (a.date < b.date ? 1 : -1)).map((w) => (
                <li key={w.id} className="flex items-center justify-between">
                  <span>{formatLong(w.date)}: <strong>{w.kg} kg</strong></span>
                  <button type="button" className="icon-btn" aria-label={`Delete weigh-in from ${formatLong(w.date)}`} onClick={() => dispatch({ type: 'DELETE_WEIGH_IN', id: w.id })}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="history">
        <h2 id="history" className="font-bold">Workouts done</h2>
        {sessions.length === 0 ? (
          <p className="muted text-sm">Your finished workouts will show up here.</p>
        ) : (
          <ul className="divide-y divide-violet-100 text-sm dark:divide-white/10">
            {sessions.slice(0, 20).map((s) => {
              const sets = s.exercises.flatMap((e) => e.sets);
              const done = sets.filter((x) => x.done).length;
              const minutes = s.finishedAt ? Math.max(1, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000)) : 0;
              return (
                <li key={s.id} className="flex justify-between py-2">
                  <span>
                    <strong>{routineName(s.routineId)}</strong>
                    <span className="muted"> · {formatLong(s.date)}</span>
                  </span>
                  <span className="muted tabular-nums">{done}/{sets.length} sets · {minutes} min</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="photos">
        <h2 id="photos" className="font-bold">Progress photos</h2>
        <p className="muted text-xs">Saved only on this phone, never uploaded. Delete them any time in Settings.</p>
        {firstPhoto && (
          <div className="grid grid-cols-2 gap-2">
            <figure>
              <img src={firstPhoto.dataUrl} alt={`Photo from ${formatLong(firstPhoto.date)}`} className="aspect-[3/4] w-full rounded-2xl object-cover" />
              <figcaption className="muted mt-1 text-center text-xs">Start · {formatLong(firstPhoto.date)}</figcaption>
            </figure>
            {latestPhoto ? (
              <figure>
                <img src={latestPhoto.dataUrl} alt={`Photo from ${formatLong(latestPhoto.date)}`} className="aspect-[3/4] w-full rounded-2xl object-cover" />
                <figcaption className="muted mt-1 text-center text-xs">Latest · {formatLong(latestPhoto.date)}</figcaption>
              </figure>
            ) : (
              <div className="muted flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-violet-200 p-3 text-center text-xs dark:border-white/15">
                Add another photo later to compare
              </div>
            )}
          </div>
        )}
        <button type="button" className="btn-secondary w-full" onClick={() => photoInput.current?.click()}>
          <Camera className="h-4 w-4" aria-hidden /> Add a progress photo
        </button>
        <input ref={photoInput} type="file" accept="image/*" className="hidden" aria-label="Choose a progress photo" onChange={(e) => addPhoto(e.target.files?.[0])} />
      </section>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Camera, Dumbbell, Flame, ImagePlus, Pencil, Scale, ShieldCheck, Sparkles, Trash2, Zap } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { CoachProfile, GoalBuild } from '../../coach/schema';
import { compressPhoto, type CompressedPhoto } from '../../coach/photo';
import { requestPlan } from '../../coach/api';
import { newId, todayISO } from '../../lib/dates';
import { ChoiceCard, Chip, Disclaimer, Stepper } from '../../components/coach/Controls';

// ---------- Options ----------

const GOALS: { value: GoalBuild; title: string; subtitle: string; icon: ReactNode; color: string }[] = [
  { value: 'loseFat', title: 'Lose fat', subtitle: 'Slim down steadily', icon: <Flame className="h-6 w-6" />, color: '#ff8a00' },
  { value: 'leanToned', title: 'Lean and toned', subtitle: 'Firm up, light muscle', icon: <Sparkles className="h-6 w-6" />, color: '#ff2bd6' },
  { value: 'buildMuscle', title: 'Build muscle', subtitle: 'Get bigger and stronger', icon: <Dumbbell className="h-6 w-6" />, color: '#00f0ff' },
  { value: 'athletic', title: 'Athletic', subtitle: 'Fit, fast, all-round', icon: <Zap className="h-6 w-6" />, color: '#39ff14' },
  { value: 'maintain', title: 'Maintain', subtitle: 'Stay where you are, feel good', icon: <Scale className="h-6 w-6" />, color: '#b026ff' },
];

const ACTIVITY: { value: CoachProfile['activity']; title: string; subtitle: string }[] = [
  { value: 'sedentary', title: 'Mostly sitting', subtitle: 'Desk job, little walking' },
  { value: 'light', title: 'Lightly active', subtitle: 'Some walking most days' },
  { value: 'moderate', title: 'Active', subtitle: 'On your feet or exercising 3-5 days' },
  { value: 'very', title: 'Very active', subtitle: 'Physical job or hard training most days' },
];

const EXPERIENCE: { value: CoachProfile['experience']; title: string; subtitle: string }[] = [
  { value: 'beginner', title: 'Beginner', subtitle: 'New or returning after a long break' },
  { value: 'intermediate', title: 'Intermediate', subtitle: 'Training on and off for months' },
  { value: 'advanced', title: 'Advanced', subtitle: 'Training regularly for years' },
];

const PLACES: { value: CoachProfile['place']; title: string }[] = [
  { value: 'home', title: 'Home' },
  { value: 'gym', title: 'Gym' },
  { value: 'outdoors', title: 'Outdoors' },
];

const EQUIPMENT = ['No equipment', 'Dumbbells', 'Resistance bands', 'Skipping rope', 'Pull-up bar', 'Kettlebell', 'Exercise mat', 'Bench', 'Full gym'];
const DIETARY = ['Vegetarian', 'Vegan', 'Halal', 'No pork', 'No beef', 'Lactose-free', 'Gluten-free', 'Nut allergy', 'Shellfish allergy', 'Diabetic-friendly'];
const CUISINES = ['Nigerian', 'Ghanaian', 'Kenyan', 'South African', 'Cameroonian', 'Ethiopian', 'Senegalese', 'Egyptian', 'Moroccan', 'Jamaican', 'British', 'American', 'Indian', 'Pakistani', 'Chinese', 'Filipino', 'Mexican', 'Brazilian', 'Italian'];

// ---------- Draft (form state) ----------
// Numbers are kept as strings while typing, so a half-typed "1" isn't rejected.

interface Draft {
  goalBuild?: GoalBuild;
  photo?: CompressedPhoto;
  photoConsent: boolean;
  savePhoto: boolean;
  age: string;
  sex?: 'male' | 'female';
  units: 'metric' | 'imperial';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string; // kg or lb depending on units
  waist: string; // cm or inches depending on units
  activity?: CoachProfile['activity'];
  experience?: CoachProfile['experience'];
  daysPerWeek: number;
  minutesPerSession: number;
  place?: CoachProfile['place'];
  equipment: string[];
  nationality: string;
  dislikes: string[];
  dietary: string[];
  budget?: CoachProfile['budget'];
  mealsPerDay: number;
  hasCondition?: boolean;
  healthNotes: string;
}

function emptyDraft(): Draft {
  return {
    photoConsent: false,
    savePhoto: false,
    age: '',
    units: 'metric',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    waist: '',
    daysPerWeek: 3,
    minutesPerSession: 30,
    equipment: [],
    nationality: 'Nigerian',
    dislikes: [],
    dietary: [],
    mealsPerDay: 3,
    healthNotes: '',
  };
}

function draftFromProfile(p: CoachProfile): Draft {
  return {
    ...emptyDraft(),
    goalBuild: p.goalBuild,
    age: String(p.age),
    sex: p.sex,
    heightCm: String(p.heightCm),
    weight: String(p.weightKg),
    waist: p.waistCm ? String(p.waistCm) : '',
    activity: p.activity,
    experience: p.experience,
    daysPerWeek: p.daysPerWeek,
    minutesPerSession: p.minutesPerSession,
    place: p.place,
    equipment: p.equipment,
    nationality: p.nationality,
    dislikes: p.dislikes,
    dietary: p.dietary,
    budget: p.budget,
    mealsPerDay: p.mealsPerDay,
    hasCondition: p.health.hasCondition,
    healthNotes: p.health.notes ?? '',
  };
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const round1 = (n: number) => Math.round(n * 10) / 10;

// Converts whatever units were typed into the metric numbers the plan uses.
function bodyNumbers(d: Draft) {
  const heightCm = d.units === 'metric' ? num(d.heightCm) : (num(d.heightFt) * 12 + (num(d.heightIn) || 0)) * 2.54;
  const weightKg = d.units === 'metric' ? num(d.weight) : num(d.weight) * 0.453592;
  const waistRaw = num(d.waist);
  const waistCm = Number.isNaN(waistRaw) ? undefined : d.units === 'metric' ? waistRaw : waistRaw * 2.54;
  return { heightCm: round1(heightCm), weightKg: round1(weightKg), waistCm: waistCm === undefined ? undefined : round1(waistCm) };
}

// Returns a message if the step can't continue yet, else null.
function stepProblem(step: number, d: Draft): string | null {
  switch (step) {
    case 0:
      return d.goalBuild ? null : 'Pick the look you want.';
    case 1:
      return null; // photo is optional
    case 2: {
      const age = num(d.age);
      if (Number.isNaN(age)) return 'Enter your age.';
      if (age < 18) return 'under18';
      if (age > 100) return 'Please check your age.';
      if (!d.sex) return 'Choose male or female (used for calorie maths).';
      const { heightCm, weightKg, waistCm } = bodyNumbers(d);
      if (Number.isNaN(heightCm) || heightCm < 120 || heightCm > 230) return 'Enter your height (check the units).';
      if (Number.isNaN(weightKg) || weightKg < 30 || weightKg > 300) return 'Enter your weight (check the units).';
      if (waistCm !== undefined && (waistCm < 40 || waistCm > 200)) return 'Waist looks off; check it or leave it empty.';
      return null;
    }
    case 3:
      return d.activity && d.experience ? null : 'Choose your activity and experience.';
    case 4:
      return d.place ? null : 'Choose where you will train.';
    case 5:
      if (d.nationality.trim().length < 2) return 'Tell us your nationality or cuisine.';
      return d.budget ? null : 'Choose a food budget.';
    case 6:
      if (d.hasCondition === undefined) return 'Answer yes or no.';
      if (d.hasCondition && d.healthNotes.trim().length < 3) return 'Tell us briefly what to be careful with.';
      return null;
    default:
      return null;
  }
}

function toProfile(d: Draft): CoachProfile {
  const { heightCm, weightKg, waistCm } = bodyNumbers(d);
  return {
    goalBuild: d.goalBuild!,
    age: Math.round(num(d.age)),
    sex: d.sex!,
    heightCm,
    weightKg,
    waistCm,
    activity: d.activity!,
    experience: d.experience!,
    daysPerWeek: d.daysPerWeek,
    minutesPerSession: d.minutesPerSession,
    place: d.place!,
    equipment: d.equipment,
    nationality: d.nationality.trim(),
    dislikes: d.dislikes,
    dietary: d.dietary,
    budget: d.budget!,
    mealsPerDay: d.mealsPerDay,
    health: { hasCondition: d.hasCondition!, notes: d.hasCondition ? d.healthNotes.trim() : undefined },
    photoProvided: !!d.photo,
  };
}

const STEP_TITLES = ['Your goal', 'Your starting point', 'Body details', 'Activity', 'Training setup', 'Food', 'Health check', 'Review'];

const LOADING_LINES = [
  'Reading your answers…',
  'Picking exercises for your space…',
  'Planning meals with foods you can buy…',
  'Balancing calories and protein…',
  'Writing your grocery list…',
  'Almost there, adding the finishing touches…',
];

// ---------- Small pieces ----------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="label mb-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function UnitToggle({ units, onChange }: { units: Draft['units']; onChange: (u: Draft['units']) => void }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Units">
      {(['metric', 'imperial'] as const).map((u) => (
        <Chip key={u} selected={units === u} onToggle={() => onChange(u)}>
          {u === 'metric' ? 'kg / cm' : 'lb / ft-in'}
        </Chip>
      ))}
    </div>
  );
}

// ---------- The page ----------

export default function CoachStartPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1' && !!state.coachProfile;

  const [draft, setDraft] = useState<Draft>(() => (editing && state.coachProfile ? draftFromProfile(state.coachProfile) : emptyDraft()));
  // Editing jumps straight to Review, where every section has an Edit button.
  const [step, setStep] = useState(editing ? 7 : 0);
  const [showError, setShowError] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);
  const [dislikeInput, setDislikeInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleIn = (key: 'equipment' | 'dietary' | 'dislikes', value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value] }));

  const problem = stepProblem(step, draft);

  // Cycle the friendly loading lines while the plan is being written.
  useEffect(() => {
    if (!submitting) return;
    const timer = window.setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 4000);
    return () => window.clearInterval(timer);
  }, [submitting]);

  function next() {
    if (problem) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setStep((s) => Math.min(7, s + 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setShowError(false);
    if (step === 0) navigate('/coach');
    else setStep((s) => s - 1);
  }

  async function onPhotoChosen(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      set('photo', await compressPhoto(file));
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
  }

  async function createPlan() {
    const profile = toProfile(draft);
    setSubmitting(true);
    setSubmitError(null);
    setLoadingLine(0);
    dispatch({ type: 'SET_COACH_PROFILE', profile });

    const result = await requestPlan({
      profile,
      photo: draft.photo ? { mediaType: 'image/jpeg', data: draft.photo.base64 } : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }

    dispatch({ type: 'SET_COACH_PLAN', plan: result.plan });
    // The starting weight becomes the first point on the Progress chart.
    if (state.weighIns.length === 0) {
      dispatch({ type: 'ADD_WEIGH_IN', weighIn: { id: newId(), date: todayISO(), kg: profile.weightKg } });
    }
    // Opt-in only: keep a small copy of the photo on this device for comparison later.
    if (draft.photo && draft.savePhoto) {
      const file = await fetch(draft.photo.dataUrl).then((r) => r.blob());
      const small = await compressPhoto(new File([file], 'photo.jpg', { type: 'image/jpeg' }), 480, 80 * 1024);
      dispatch({ type: 'SAVE_PHOTO', photo: { id: newId(), date: todayISO(), dataUrl: small.dataUrl } });
    }
    navigate('/coach');
  }

  // ---------- Loading screen ----------
  if (submitting) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
        <motion.div
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink via-neon-violet to-neon-cyan"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Dumbbell className="h-10 w-10 text-white" aria-hidden />
        </motion.div>
        <div>
          <h1 className="page-title">Building your plan</h1>
          <AnimatePresence mode="wait">
            <motion.p key={loadingLine} className="muted mt-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {LOADING_LINES[loadingLine]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="muted max-w-xs text-xs">This usually takes about a minute. Keep the app open.</p>
      </div>
    );
  }

  const progress = ((step + 1) / STEP_TITLES.length) * 100;
  const body = bodyNumbers(draft);

  return (
    <div className="space-y-5">
      {/* Header + progress bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" onClick={back} aria-label={step === 0 ? 'Back to Coach' : 'Previous step'}>
            <ArrowLeft className="h-6 w-6" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="muted text-xs font-semibold uppercase tracking-widest">
              Step {step + 1} of {STEP_TITLES.length}
            </p>
            <h1 className="page-title text-2xl">{STEP_TITLES[step]}</h1>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-white/10" role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-neon-pink to-neon-cyan" animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="card space-y-5">
          {/* 1. Goal build */}
          {step === 0 && (
            <div className="space-y-2" role="radiogroup" aria-label="Goal">
              <p className="muted text-sm">What do you want to look and feel like?</p>
              {GOALS.map((g) => (
                <ChoiceCard key={g.value} selected={draft.goalBuild === g.value} onSelect={() => set('goalBuild', g.value)} title={g.title} subtitle={g.subtitle} icon={g.icon} color={g.color} />
              ))}
            </div>
          )}

          {/* 2. Photo (optional) with consent */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-sm">
                <ShieldCheck className="h-6 w-6 shrink-0 text-neon-cyan" aria-hidden />
                <div className="space-y-1">
                  <p className="font-semibold">A photo is optional</p>
                  <p className="muted">
                    If you add one, it's shrunk on your phone, sent <strong>once</strong> to the AI to describe your general body shape, and
                    <strong> never saved on our server</strong>. Your numbers, not the photo, set your targets.
                  </p>
                </div>
              </div>

              {!draft.photo ? (
                <>
                  <label className="flex min-h-[48px] items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5 accent-pink-500" checked={draft.photoConsent} onChange={(e) => set('photoConsent', e.target.checked)} />
                    I understand and want to add a photo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn-secondary" disabled={!draft.photoConsent} onClick={() => cameraInput.current?.click()}>
                      <Camera className="h-5 w-5" aria-hidden /> Camera
                    </button>
                    <button type="button" className="btn-secondary" disabled={!draft.photoConsent} onClick={() => fileInput.current?.click()}>
                      <ImagePlus className="h-5 w-5" aria-hidden /> Gallery
                    </button>
                  </div>
                  <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" aria-label="Take a photo" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                  <input ref={fileInput} type="file" accept="image/*" className="hidden" aria-label="Choose a photo" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                  {photoError && <p role="alert" className="text-sm text-red-500">{photoError}</p>}
                  <button type="button" className="w-full text-center text-sm font-semibold text-neon-pink underline-offset-2 hover:underline dark:text-neon-cyan" onClick={() => setStep(2)}>
                    Skip, I'll enter details
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <img src={draft.photo.dataUrl} alt="Your photo preview" className="mx-auto max-h-72 rounded-2xl object-contain" />
                  <label className="flex min-h-[48px] items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5 accent-pink-500" checked={draft.savePhoto} onChange={(e) => set('savePhoto', e.target.checked)} />
                    Save on this phone for progress comparison (never uploaded)
                  </label>
                  <button type="button" className="btn-secondary w-full" onClick={() => set('photo', undefined)}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Body details */}
          {step === 2 && (
            <div className="space-y-4">
              <UnitToggle units={draft.units} onChange={(u) => set('units', u)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="age" className="label">Age</label>
                  <input id="age" className="input" inputMode="numeric" value={draft.age} onChange={(e) => set('age', e.target.value)} placeholder="e.g. 28" />
                </div>
                <div>
                  <span className="label">Sex</span>
                  <div className="flex gap-2" role="radiogroup" aria-label="Sex">
                    <Chip selected={draft.sex === 'male'} onToggle={() => set('sex', 'male')}>Male</Chip>
                    <Chip selected={draft.sex === 'female'} onToggle={() => set('sex', 'female')}>Female</Chip>
                  </div>
                </div>
              </div>
              {draft.units === 'metric' ? (
                <div>
                  <label htmlFor="height" className="label">Height (cm)</label>
                  <input id="height" className="input" inputMode="decimal" value={draft.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="e.g. 172" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ft" className="label">Height (ft)</label>
                    <input id="ft" className="input" inputMode="numeric" value={draft.heightFt} onChange={(e) => set('heightFt', e.target.value)} placeholder="5" />
                  </div>
                  <div>
                    <label htmlFor="in" className="label">(in)</label>
                    <input id="in" className="input" inputMode="numeric" value={draft.heightIn} onChange={(e) => set('heightIn', e.target.value)} placeholder="8" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="weight" className="label">Weight ({draft.units === 'metric' ? 'kg' : 'lb'})</label>
                  <input id="weight" className="input" inputMode="decimal" value={draft.weight} onChange={(e) => set('weight', e.target.value)} placeholder={draft.units === 'metric' ? 'e.g. 78' : 'e.g. 172'} />
                </div>
                <div>
                  <label htmlFor="waist" className="label">
                    Waist ({draft.units === 'metric' ? 'cm' : 'in'}) <span className="muted font-normal">optional</span>
                  </label>
                  <input id="waist" className="input" inputMode="decimal" value={draft.waist} onChange={(e) => set('waist', e.target.value)} />
                </div>
              </div>
              {draft.photo && <p className="muted text-xs">We still need these numbers: the photo only helps describe body shape.</p>}
              {problem === 'under18' && (
                <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 p-3 text-sm">
                  <p className="font-semibold">The Coach is for adults (18+)</p>
                  <p className="muted mt-1">
                    For now, the best plan is simple: regular meals with lots of fruit and vegetables, plenty of water, good sleep, and moving in ways you enjoy, like sports, dancing or walking with friends. Your Goals and Food tabs still work for building those habits.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. Activity + experience */}
          {step === 3 && (
            <div className="space-y-5">
              <Section title="How active are you day to day?">
                {ACTIVITY.map((a) => (
                  <ChoiceCard key={a.value} selected={draft.activity === a.value} onSelect={() => set('activity', a.value)} title={a.title} subtitle={a.subtitle} />
                ))}
              </Section>
              <Section title="Your training experience">
                {EXPERIENCE.map((x) => (
                  <ChoiceCard key={x.value} selected={draft.experience === x.value} onSelect={() => set('experience', x.value)} title={x.title} subtitle={x.subtitle} color="#ff2bd6" />
                ))}
              </Section>
            </div>
          )}

          {/* 5. Training setup */}
          {step === 4 && (
            <div className="space-y-5">
              <Stepper label="Days per week" value={draft.daysPerWeek} onChange={(v) => set('daysPerWeek', v)} min={1} max={7} />
              <Stepper label="Minutes per session" value={draft.minutesPerSession} onChange={(v) => set('minutesPerSession', v)} min={15} max={120} step={5} suffix="min" />
              <Section title="Where will you train?">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Place">
                  {PLACES.map((p) => (
                    <Chip key={p.value} selected={draft.place === p.value} onToggle={() => set('place', p.value)}>
                      {p.title}
                    </Chip>
                  ))}
                </div>
              </Section>
              <Section title="Equipment you have">
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map((e) => (
                    <Chip key={e} selected={draft.equipment.includes(e)} onToggle={() => toggleIn('equipment', e)}>
                      {e}
                    </Chip>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* 6. Food */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="nationality" className="label">Nationality or cuisine</label>
                <input id="nationality" className="input" list="cuisines" value={draft.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Nigerian" />
                <datalist id="cuisines">
                  {CUISINES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="muted mt-1 text-xs">Your meals will use everyday foods from this cuisine.</p>
              </div>
              <Section title="Dietary needs">
                <div className="flex flex-wrap gap-2">
                  {DIETARY.map((d) => (
                    <Chip key={d} selected={draft.dietary.includes(d)} onToggle={() => toggleIn('dietary', d)}>
                      {d}
                    </Chip>
                  ))}
                </div>
              </Section>
              <div>
                <label htmlFor="dislike" className="label">Foods you dislike</label>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = dislikeInput.trim();
                    if (v && !draft.dislikes.includes(v)) set('dislikes', [...draft.dislikes, v]);
                    setDislikeInput('');
                  }}
                >
                  <input id="dislike" className="input" value={dislikeInput} onChange={(e) => setDislikeInput(e.target.value)} placeholder="e.g. okra" />
                  <button type="submit" className="btn-secondary shrink-0">Add</button>
                </form>
                {draft.dislikes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.dislikes.map((d) => (
                      <Chip key={d} selected onToggle={() => toggleIn('dislikes', d)}>
                        {d} ✕
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
              <Section title="Food budget">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Budget">
                  {(['low', 'medium', 'high'] as const).map((b) => (
                    <Chip key={b} selected={draft.budget === b} onToggle={() => set('budget', b)}>
                      {b === 'low' ? 'Tight' : b === 'medium' ? 'Medium' : 'Comfortable'}
                    </Chip>
                  ))}
                </div>
              </Section>
              <Stepper label="Meals per day" value={draft.mealsPerDay} onChange={(v) => set('mealsPerDay', v)} min={2} max={6} />
            </div>
          )}

          {/* 7. Health check */}
          {step === 6 && (
            <div className="space-y-4">
              <p>Do you have any injury, medical condition, pregnancy, or advice from a doctor to limit exercise?</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Health condition">
                <Chip selected={draft.hasCondition === false} onToggle={() => set('hasCondition', false)}>No</Chip>
                <Chip selected={draft.hasCondition === true} onToggle={() => set('hasCondition', true)}>Yes</Chip>
              </div>
              {draft.hasCondition && (
                <div>
                  <label htmlFor="health" className="label">What should we be careful with?</label>
                  <textarea id="health" className="input" rows={3} maxLength={500} value={draft.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} placeholder="e.g. bad left knee, high blood pressure, 5 months pregnant" />
                  <p className="muted mt-1 text-xs">Your plan will be gentler, and we'll suggest checking with your doctor before you start.</p>
                </div>
              )}
            </div>
          )}

          {/* 8. Review */}
          {step === 7 && (
            <div className="space-y-3">
              {(
                [
                  [0, 'Goal', GOALS.find((g) => g.value === draft.goalBuild)?.title],
                  [1, 'Photo', draft.photo ? `Added${draft.savePhoto ? ', saved on this phone' : ''}` : 'Skipped'],
                  [2, 'Body', `${draft.age} yrs, ${draft.sex ?? '?'}, ${body.heightCm} cm, ${body.weightKg} kg${body.waistCm ? `, waist ${body.waistCm} cm` : ''}`],
                  [3, 'Activity', `${ACTIVITY.find((a) => a.value === draft.activity)?.title ?? '?'} · ${draft.experience ?? '?'}`],
                  [4, 'Training', `${draft.daysPerWeek} days × ${draft.minutesPerSession} min · ${draft.place ?? '?'}${draft.equipment.length ? ` · ${draft.equipment.join(', ')}` : ''}`],
                  [5, 'Food', `${draft.nationality} · ${draft.budget ?? '?'} budget · ${draft.mealsPerDay} meals${draft.dietary.length ? ` · ${draft.dietary.join(', ')}` : ''}${draft.dislikes.length ? ` · no ${draft.dislikes.join(', ')}` : ''}`],
                  [6, 'Health', draft.hasCondition ? draft.healthNotes : 'Nothing to note'],
                ] as [number, string, string | undefined][]
              ).map(([target, label, value]) => (
                <div key={label} className="flex items-start gap-3 border-b border-violet-100 pb-3 last:border-0 dark:border-white/10">
                  <div className="min-w-0 flex-1">
                    <p className="muted text-xs font-semibold uppercase tracking-wider">{label}</p>
                    <p className="text-sm">{value}</p>
                  </div>
                  <button type="button" className="icon-btn" aria-label={`Edit ${label}`} onClick={() => setStep(target)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {submitError && (
                <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">
                  {submitError}
                </p>
              )}
              <button type="button" className="btn-primary min-h-[52px] w-full text-base" onClick={createPlan}>
                <Sparkles className="h-5 w-5" aria-hidden /> {editing ? 'Update my plan' : 'Create my plan'}
              </button>
              <Disclaimer />
            </div>
          )}

          {showError && problem && problem !== 'under18' && (
            <p role="alert" className="text-sm font-medium text-red-500 dark:text-red-400">
              {problem}
            </p>
          )}

          {step < 7 && (
            <button type="button" className="btn-primary w-full" onClick={next} disabled={problem === 'under18'}>
              Continue
            </button>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}

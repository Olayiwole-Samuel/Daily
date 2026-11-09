// Free workout planner: picks exercises from a built-in library to fit the
// user's place, equipment, level and time. No AI involved.
import type { CoachProfile, Exercise, Routine, WorkoutSchedule } from '../schema.js';
import { shuffle, type Rng } from './random.js';

type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'core' | 'cardio';
type Gear = 'dumbbells' | 'bands' | 'pullupbar' | 'kettlebell' | 'bench' | 'rope' | 'machines' | 'barbell';

interface ExerciseDef {
  key: string;
  name: string;
  pattern: Pattern;
  level: 1 | 2 | 3; // 1 = easiest
  needs?: Gear[]; // needs ANY one of these; empty = bodyweight
  alsoNeeds?: Gear[]; // and ALL of these (e.g. dumbbells AND a bench)
  lowImpact: boolean; // safe with joint issues / pregnancy (no jumping)
  timed?: boolean; // done for seconds instead of reps
  howTo: string;
}

const LIBRARY: ExerciseDef[] = [
  // Squat
  { key: 'chair-squat', name: 'Chair squat (sit to stand)', pattern: 'squat', level: 1, lowImpact: true, howTo: 'Sit back to a chair, tap it lightly, stand up through your heels.' },
  { key: 'bw-squat', name: 'Bodyweight squat', pattern: 'squat', level: 1, lowImpact: true, howTo: 'Sit back like into a chair, chest up, knees follow your toes.' },
  { key: 'band-squat', name: 'Banded squat', pattern: 'squat', level: 1, needs: ['bands'], lowImpact: true, howTo: 'Stand on the band, hold it at your shoulders, squat and push the floor away.' },
  { key: 'goblet-squat', name: 'Goblet squat', pattern: 'squat', level: 2, needs: ['dumbbells', 'kettlebell'], lowImpact: true, howTo: 'Hold the weight at your chest, elbows inside knees at the bottom.' },
  { key: 'leg-press', name: 'Leg press', pattern: 'squat', level: 2, needs: ['machines'], lowImpact: true, howTo: 'Feet shoulder-width, lower until knees are at 90 degrees, don’t lock out.' },
  { key: 'pause-squat', name: 'Pause squat (3 s at the bottom)', pattern: 'squat', level: 2, lowImpact: true, howTo: 'Squat down, hold still for 3 seconds, drive up.' },
  { key: 'jump-squat', name: 'Jump squat', pattern: 'squat', level: 3, lowImpact: false, howTo: 'Squat, jump up, land softly back into the squat.' },
  { key: 'back-squat', name: 'Barbell back squat', pattern: 'squat', level: 3, needs: ['barbell'], lowImpact: true, howTo: 'Bar on upper back, brace, sit down between your hips, stand tall.' },
  // Hinge
  { key: 'glute-bridge', name: 'Glute bridge', pattern: 'hinge', level: 1, lowImpact: true, howTo: 'Squeeze your bum to lift your hips; pause 1 second at the top.' },
  { key: 'band-goodmorning', name: 'Banded good morning', pattern: 'hinge', level: 1, needs: ['bands'], lowImpact: true, howTo: 'Band behind your neck, push hips back with a flat back, stand up.' },
  { key: 'sl-bridge', name: 'Single-leg glute bridge', pattern: 'hinge', level: 2, lowImpact: true, howTo: 'One foot down, other leg up; lift hips without twisting.' },
  { key: 'hip-thrust', name: 'Hip thrust (shoulders on a bench)', pattern: 'hinge', level: 2, needs: ['bench'], lowImpact: true, howTo: 'Shoulders on the bench, chin tucked, lift hips until your body is flat.' },
  { key: 'db-rdl', name: 'Dumbbell Romanian deadlift', pattern: 'hinge', level: 2, needs: ['dumbbells'], lowImpact: true, howTo: 'Soft knees, push hips back, weights slide down your thighs, flat back.' },
  { key: 'kb-swing', name: 'Kettlebell swing', pattern: 'hinge', level: 3, needs: ['kettlebell'], lowImpact: false, howTo: 'Snap your hips forward to float the bell to chest height; arms stay loose.' },
  { key: 'deadlift', name: 'Barbell deadlift', pattern: 'hinge', level: 3, needs: ['barbell'], lowImpact: true, howTo: 'Bar over mid-foot, flat back, push the floor away and stand tall.' },
  // Push
  { key: 'wall-pushup', name: 'Wall push-up', pattern: 'push', level: 1, lowImpact: true, howTo: 'Hands on the wall at chest height, body straight, chest to the wall.' },
  { key: 'incline-pushup', name: 'Incline push-up (hands on a table)', pattern: 'push', level: 1, lowImpact: true, howTo: 'Straight line from head to heels; lower your chest to the edge.' },
  { key: 'band-press', name: 'Banded chest press', pattern: 'push', level: 1, needs: ['bands'], lowImpact: true, howTo: 'Band behind your back, press both hands forward until arms are straight.' },
  { key: 'machine-press', name: 'Machine chest press', pattern: 'push', level: 1, needs: ['machines'], lowImpact: true, howTo: 'Handles at chest height, press out, control the way back.' },
  { key: 'pushup', name: 'Push-up', pattern: 'push', level: 2, lowImpact: true, howTo: 'Hands under shoulders, body straight, chest close to the floor.' },
  { key: 'db-floor-press', name: 'Dumbbell floor press', pattern: 'push', level: 2, needs: ['dumbbells'], lowImpact: true, howTo: 'Lie on the floor, elbows at 45 degrees, press the weights up together.' },
  { key: 'db-bench', name: 'Dumbbell bench press', pattern: 'push', level: 2, needs: ['dumbbells'], alsoNeeds: ['bench'], lowImpact: true, howTo: 'On a bench, feet planted, lower to chest level and press up.' },
  { key: 'db-shoulder', name: 'Dumbbell shoulder press', pattern: 'push', level: 2, needs: ['dumbbells'], lowImpact: true, howTo: 'Weights at your shoulders, press overhead without arching your back.' },
  { key: 'chair-dip', name: 'Chair dip', pattern: 'push', level: 2, lowImpact: true, howTo: 'Hands on a sturdy chair, elbows point back, lower slowly.' },
  { key: 'decline-pushup', name: 'Decline push-up (feet raised)', pattern: 'push', level: 3, lowImpact: true, howTo: 'Feet on a step or chair, body straight, lower with control.' },
  // Pull
  { key: 'prone-yt', name: 'Prone Y-T raise', pattern: 'pull', level: 1, lowImpact: true, howTo: 'Lie face down, thumbs up, lift arms into a Y then a T; squeeze shoulder blades.' },
  { key: 'superman', name: 'Superman hold', pattern: 'pull', level: 1, lowImpact: true, timed: true, howTo: 'Lie face down, lift arms and legs a little, look at the floor.' },
  { key: 'band-row', name: 'Banded row', pattern: 'pull', level: 1, needs: ['bands'], lowImpact: true, howTo: 'Anchor the band, pull elbows back past your ribs, squeeze.' },
  { key: 'band-apart', name: 'Banded pull-apart', pattern: 'pull', level: 1, needs: ['bands'], lowImpact: true, howTo: 'Arms straight in front, pull the band apart to your chest.' },
  { key: 'lat-pulldown', name: 'Lat pulldown', pattern: 'pull', level: 1, needs: ['machines'], lowImpact: true, howTo: 'Pull the bar to your upper chest, elbows down and back.' },
  { key: 'table-row', name: 'Inverted row under a sturdy table', pattern: 'pull', level: 2, lowImpact: true, howTo: 'Lie under the table edge, body straight, pull your chest up to it.' },
  { key: 'db-row', name: 'One-arm dumbbell row', pattern: 'pull', level: 2, needs: ['dumbbells'], lowImpact: true, howTo: 'Hand on a chair, flat back, pull the weight to your hip.' },
  { key: 'cable-row', name: 'Seated cable row', pattern: 'pull', level: 2, needs: ['machines'], lowImpact: true, howTo: 'Sit tall, pull the handle to your belly, shoulders down.' },
  { key: 'negative-pullup', name: 'Negative pull-up (slow lower)', pattern: 'pull', level: 2, needs: ['pullupbar'], lowImpact: true, howTo: 'Jump or step to the top, lower yourself over 3-5 seconds.' },
  { key: 'pullup', name: 'Pull-up', pattern: 'pull', level: 3, needs: ['pullupbar'], lowImpact: true, howTo: 'Hang with straight arms, pull your chest to the bar, lower slowly.' },
  // Lunge
  { key: 'split-squat', name: 'Split squat (hold a wall)', pattern: 'lunge', level: 1, lowImpact: true, howTo: 'One foot forward, one back, lower the back knee straight down.' },
  { key: 'step-up', name: 'Step-up onto a stair', pattern: 'lunge', level: 1, lowImpact: true, howTo: 'Whole foot on the step, push through that heel to stand up.' },
  { key: 'reverse-lunge', name: 'Reverse lunge', pattern: 'lunge', level: 2, lowImpact: true, howTo: 'Step back, both knees bend to about 90 degrees; alternate legs.' },
  { key: 'db-lunge', name: 'Dumbbell reverse lunge', pattern: 'lunge', level: 2, needs: ['dumbbells'], lowImpact: true, howTo: 'Weights at your sides, step back, front knee over the ankle.' },
  { key: 'bulgarian', name: 'Bulgarian split squat', pattern: 'lunge', level: 3, lowImpact: true, howTo: 'Back foot on a chair, lower straight down, front heel stays down.' },
  // Core
  { key: 'dead-bug', name: 'Dead bug', pattern: 'core', level: 1, lowImpact: true, howTo: 'Low back pressed down, lower opposite arm and leg slowly.' },
  { key: 'bird-dog', name: 'Bird dog', pattern: 'core', level: 1, lowImpact: true, howTo: 'On hands and knees, reach opposite arm and leg, keep hips level.' },
  { key: 'knee-plank', name: 'Plank on knees', pattern: 'core', level: 1, lowImpact: true, timed: true, howTo: 'Elbows under shoulders, straight line from head to knees.' },
  { key: 'plank', name: 'Plank', pattern: 'core', level: 2, lowImpact: true, timed: true, howTo: 'Elbows under shoulders, brace your tummy, breathe.' },
  { key: 'side-plank', name: 'Side plank', pattern: 'core', level: 2, lowImpact: true, timed: true, howTo: 'Elbow under shoulder, hips high; switch sides halfway.' },
  { key: 'mountain', name: 'Mountain climbers', pattern: 'core', level: 3, lowImpact: false, timed: true, howTo: 'From a push-up position, drive knees to chest quickly.' },
  { key: 'hollow', name: 'Hollow hold', pattern: 'core', level: 3, lowImpact: true, timed: true, howTo: 'Lie on your back, lift shoulders and legs, low back pressed down.' },
  // Cardio / conditioning
  { key: 'march', name: 'Fast march on the spot', pattern: 'cardio', level: 1, lowImpact: true, timed: true, howTo: 'Lift knees to hip height, swing your arms.' },
  { key: 'step-jack', name: 'Step jacks', pattern: 'cardio', level: 1, lowImpact: true, timed: true, howTo: 'Step one foot out as arms go up; alternate sides.' },
  { key: 'stairs', name: 'Stair climbs', pattern: 'cardio', level: 1, lowImpact: true, timed: true, howTo: 'Walk up briskly, hold the rail, walk down carefully.' },
  { key: 'jacks', name: 'Jumping jacks', pattern: 'cardio', level: 2, lowImpact: false, timed: true, howTo: 'Land softly on the balls of your feet.' },
  { key: 'high-knees', name: 'High knees', pattern: 'cardio', level: 2, lowImpact: false, timed: true, howTo: 'Run on the spot, knees up to hip height.' },
  { key: 'skipping', name: 'Skipping rope', pattern: 'cardio', level: 2, needs: ['rope'], lowImpact: false, timed: true, howTo: 'Small jumps, wrists turn the rope, stay on your toes.' },
  { key: 'burpee', name: 'Burpees', pattern: 'cardio', level: 3, lowImpact: false, timed: true, howTo: 'Squat, hands down, step or jump back, return and stand tall.' },
];

// Which gear the user has, from their place and equipment chips.
export function availableGear(profile: CoachProfile): Set<Gear> {
  const gear = new Set<Gear>();
  const has = (word: string) => profile.equipment.some((e) => e.toLowerCase().includes(word));
  if (has('dumbbell')) gear.add('dumbbells');
  if (has('band')) gear.add('bands');
  if (has('pull-up') || has('pullup')) gear.add('pullupbar');
  if (has('kettlebell')) gear.add('kettlebell');
  if (has('bench')) gear.add('bench');
  if (has('rope')) gear.add('rope');
  if (profile.place === 'gym' || has('full gym')) {
    (['dumbbells', 'bench', 'machines', 'barbell', 'pullupbar', 'kettlebell'] as Gear[]).forEach((g) => gear.add(g));
  }
  return gear;
}

export interface WorkoutOptions {
  levelShift: number; // +1 when feedback says "too easy", -1 for "too hard"
}

function userLevel(profile: CoachProfile, options: WorkoutOptions): number {
  const base = profile.experience === 'beginner' ? 1 : profile.experience === 'intermediate' ? 2 : 3;
  const cap = profile.health.hasCondition ? 2 : 3; // keep it gentler with a health condition
  return Math.min(cap, Math.max(1, base + options.levelShift));
}

// Routine "templates": which movement goes in each slot.
function routineTemplates(profile: CoachProfile): { id: string; name: string; slots: Pattern[] }[] {
  const extraCardio = profile.goalBuild === 'loseFat' || profile.goalBuild === 'athletic';
  const finisher: Pattern[] = extraCardio ? ['cardio'] : [];
  if (profile.daysPerWeek === 4) {
    return [
      { id: 'U1', name: 'Upper body A', slots: ['push', 'pull', 'push', 'pull', 'core', ...finisher] },
      { id: 'L1', name: 'Lower body A', slots: ['squat', 'hinge', 'lunge', 'core', ...finisher] },
      { id: 'U2', name: 'Upper body B', slots: ['pull', 'push', 'pull', 'push', 'core', ...finisher] },
      { id: 'L2', name: 'Lower body B', slots: ['hinge', 'lunge', 'squat', 'core', ...finisher] },
    ];
  }
  if (profile.daysPerWeek >= 5) {
    return [
      { id: 'P', name: 'Push + core', slots: ['push', 'push', 'squat', 'core', ...finisher] },
      { id: 'PL', name: 'Pull + core', slots: ['pull', 'pull', 'hinge', 'core', ...finisher] },
      { id: 'LG', name: 'Legs + conditioning', slots: ['squat', 'lunge', 'hinge', 'cardio', 'core'] },
    ];
  }
  return [
    { id: 'A', name: 'Full body A', slots: ['squat', 'push', 'hinge', 'pull', 'core', ...finisher] },
    { id: 'B', name: 'Full body B', slots: ['lunge', 'pull', 'hinge', 'push', 'core', ...finisher] },
  ];
}

// Spreads N training days across the week so rest days fall in between.
export function trainingDays(count: number): number[] {
  const presets: Record<number, number[]> = {
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.min(7, Math.max(1, count))];
}

export interface WorkoutPart {
  routines: Routine[];
  schedule: WorkoutSchedule;
  progression: string;
}

export function buildWorkouts(profile: CoachProfile, rng: Rng, options: WorkoutOptions): WorkoutPart {
  const gear = availableGear(profile);
  const level = userLevel(profile, options);
  const gentle = profile.health.hasCondition;

  // Exercises this person can actually do, harder ones first.
  const doable = LIBRARY.filter(
    (e) =>
      e.level <= level &&
      (!gentle || e.lowImpact) &&
      (!e.needs || e.needs.some((g) => gear.has(g))) &&
      (!e.alsoNeeds || e.alsoNeeds.every((g) => gear.has(g))),
  );

  // Training numbers by goal and experience.
  const sets = profile.experience === 'beginner' ? 2 : profile.experience === 'intermediate' ? 3 : 4;
  const reps = profile.goalBuild === 'buildMuscle' ? 10 : profile.goalBuild === 'athletic' ? 10 : 12;
  const holdSec = level === 1 ? 20 : level === 2 ? 30 : 40;
  const strengthRest = profile.goalBuild === 'buildMuscle' ? 90 : 60;

  // How many exercises fit: ~10 min for warm-up + cool-down, the rest for work.
  const perExerciseMin = (sets * (40 + strengthRest)) / 60;
  const exerciseCount = Math.min(7, Math.max(3, Math.floor((profile.minutesPerSession - 10) / perExerciseMin)));

  const used = new Set<string>(); // spreads variety across all routines
  const routines: Routine[] = routineTemplates(profile).map((template) => {
    const exercises: Exercise[] = [];
    const slots = template.slots.slice(0, exerciseCount);
    slots.forEach((pattern, i) => {
      const forPattern = doable.filter((e) => e.pattern === pattern);
      if (forPattern.length === 0) return;
      // Stay within one level of the hardest suitable option, so variety never
      // means a much easier move. Then prefer unused ones; shuffle for variety.
      const topLevel = Math.max(...forPattern.map((e) => e.level));
      const candidates = forPattern.filter((e) => e.level >= Math.max(1, topLevel - 1));
      const best = shuffle(candidates, rng).sort((a, b) => {
        const fresh = Number(used.has(a.key)) - Number(used.has(b.key));
        return fresh !== 0 ? fresh : (b.level === topLevel ? 1 : 0) - (a.level === topLevel ? 1 : 0);
      });
      const pick = best.find((e) => !exercises.some((x) => x.name === e.name));
      if (!pick) return;
      used.add(pick.key);
      const isCardio = pick.pattern === 'cardio';
      exercises.push({
        id: `${template.id}-${i + 1}`,
        name: pick.name,
        sets: isCardio ? Math.max(2, sets) : sets,
        ...(pick.timed ? { durationSec: isCardio ? holdSec + 10 : holdSec } : { reps: pick.pattern === 'lunge' ? Math.round(reps * 0.8) : reps }),
        restSec: isCardio || pick.pattern === 'core' ? 45 : strengthRest,
        howTo: pick.howTo,
      });
    });
    const workSeconds = exercises.reduce((sum, e) => sum + e.sets * ((e.durationSec ?? (e.reps ?? 10) * 3) + e.restSec), 0);
    return {
      id: template.id,
      name: template.name,
      warmUp: gentle
        ? '5-8 min: slow march, gentle arm circles, easy hip circles. Move within a comfortable range.'
        : '5 min: march or jog on the spot, arm circles, leg swings, 10 easy squats.',
      coolDown: '5 min: slow walk and deep breaths, then stretch legs, chest and shoulders for 20-30 seconds each.',
      exercises,
      estimatedMin: Math.round(10 + workSeconds / 60),
    };
  });

  // Fill the training days in order, cycling through the routines.
  const days = trainingDays(profile.daysPerWeek);
  const schedule: WorkoutSchedule = Array.from({ length: 7 }, (_, d) => {
    const index = days.indexOf(d);
    return index === -1 ? null : routines[index % routines.length].id;
  });

  const progression = gentle
    ? 'Keep the same plan for 2 weeks. If everything feels comfortable, add 1-2 reps or 5 seconds per exercise. Check with your doctor before making it harder.'
    : profile.experience === 'beginner'
      ? 'Weeks 1-2: learn the moves and add 1-2 reps (or 5 seconds) each week. Weeks 3-4: add one more set to your first two exercises.'
      : 'Each week add 2 reps or 5 seconds. When you reach the top of the range easily, add a set or use a heavier weight and drop back to the starting reps.';

  return { routines, schedule, progression };
}

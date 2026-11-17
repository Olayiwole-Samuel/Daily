import { useEffect, useId, useMemo, useState } from 'react';
import { buildSkeleton, blendPose, easeInOut, GROUND_Y, LIMB, type Point, type Pose, type Skeleton } from '../../coach/figure/skeleton';
import { motionFor, usesWeight, type Motion, type Prop } from '../../coach/figure/motions';

// Works out the pose at time `phase` (0..1 through one repetition).
function poseAt(motion: Motion, phase: number): Pose {
  const frames = motion.frames;
  if (motion.loop === 'pingpong') {
    // A → B for the first half, B → A for the second.
    const t = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    return blendPose(frames[0], frames[frames.length - 1], easeInOut(t));
  }
  const position = phase * frames.length;
  const index = Math.floor(position) % frames.length;
  return blendPose(frames[index], frames[(index + 1) % frames.length], easeInOut(position - index));
}

const line = (a: Point, b: Point) => `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
const limb = (a: Point, b: Point, c: Point) => `${line(a, b)} L${c[0].toFixed(1)},${c[1].toFixed(1)}`;

function Props({ props, s, ropePhase }: { props: Prop[]; s: Skeleton; ropePhase: number }) {
  const stroke = '#b026ff';
  return (
    <g fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.85">
      {props.includes('chair') && <path d="M58,128 H86 M60,128 V185 M84,128 V185 M58,128 V88" />}
      {props.includes('step') && <rect x="118" y="158" width="44" height="27" rx="3" />}
      {props.includes('table') && <path d="M138,150 H196 M144,150 V185 M190,150 V185" />}
      {props.includes('bench') && <path d="M30,152 H132 M40,152 V185 M122,152 V185" />}
      {props.includes('seat') && <path d="M78,142 H120 M84,142 V185 M114,142 V185" />}
      {props.includes('bar') && <path d="M64,4 H146" strokeWidth="4" />}
      {props.includes('rope') && (
        // The rope swings from over the head to under the feet and back.
        <path
          d={`M${s.handNear[0]},${s.handNear[1]} Q100,${(30 + 160 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ropePhase))).toFixed(1)} ${s.handFar[0]},${s.handFar[1]}`}
          strokeWidth="2"
          stroke="#ffe600"
        />
      )}
    </g>
  );
}

// A small dumbbell drawn in the near hand.
function Weight({ at }: { at: Point }) {
  const [x, y] = at;
  return (
    <g fill="#ffe600" stroke="none">
      <rect x={x - 9} y={y - 1.5} width="18" height="3" rx="1.5" />
      <rect x={x - 11} y={y - 5} width="4" height="10" rx="1.5" />
      <rect x={x + 7} y={y - 5} width="4" height="10" rx="1.5" />
    </g>
  );
}

interface Props {
  name: string; // the exercise name, e.g. "Goblet squat"
  size?: number; // pixels (square)
  className?: string;
}

// A neon character that loops the exercise movement. Purely illustrative:
// screen readers get a short description instead.
export default function ExerciseFigure({ name, size = 200, className = '' }: Props) {
  const motion = useMemo(() => motionFor(name), [name]);
  const weight = usesWeight(name);
  const gradientId = useId().replace(/:/g, '');
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState(0.5); // 0.5 = the "working" pose, also used when motion is reduced

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPhase(((now - start) % motion.periodMs) / motion.periodMs);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motion, reduceMotion]);

  const s = buildSkeleton(poseAt(motion, phase), motion.elbowBend ?? -1, motion.kneeBend ?? 1);
  // A visor "eye" on the face, pointing the way the torso faces.
  const facing: Point = [Math.cos((s.torso * Math.PI) / 180), Math.sin((s.torso * Math.PI) / 180)];
  const eye: Point = [s.head[0] + facing[0] * 5, s.head[1] + facing[1] * 5 - 1];
  const toe = (foot: Point): Point => [foot[0] + 9, foot[1]];

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label={`Animated example: ${name}`}>
      <defs>
        {/* userSpaceOnUse: a gradient sized to each line would vanish on perfectly vertical lines */}
        <linearGradient id={`near-${gradientId}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#00f0ff" />
        </linearGradient>
        <filter id={`glow-${gradientId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Floor */}
      <line x1="10" y1={GROUND_Y + 2} x2="190" y2={GROUND_Y + 2} stroke="#ff2bd6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <Props props={motion.props ?? []} s={s} ropePhase={phase} />

      <g strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#glow-${gradientId})`}>
        {/* Far side (dimmer, behind the body) */}
        <g stroke="#b026ff" opacity="0.75">
          <path d={limb(s.shoulder, s.elbowFar, s.handFar)} strokeWidth="8" />
          <path d={limb(s.hip, s.kneeFar, s.footFar)} strokeWidth="9" />
          {s.footFar[1] > GROUND_Y - 4 && <path d={line(s.footFar, toe(s.footFar))} strokeWidth="6" />}
        </g>
        {/* Torso */}
        <path d={line(s.hip, s.shoulder)} stroke={`url(#near-${gradientId})`} strokeWidth="13" />
        {/* Near side */}
        <g stroke={`url(#near-${gradientId})`}>
          <path d={limb(s.hip, s.kneeNear, s.footNear)} strokeWidth="9" />
          {s.footNear[1] > GROUND_Y - 4 && <path d={line(s.footNear, toe(s.footNear))} strokeWidth="6" />}
          <path d={limb(s.shoulder, s.elbowNear, s.handNear)} strokeWidth="8" />
        </g>
        {/* Head with a visor */}
        <circle cx={s.head[0]} cy={s.head[1]} r={LIMB.head} fill="#05010f" stroke="#00f0ff" strokeWidth="3" />
        <circle cx={eye[0]} cy={eye[1]} r="2.6" fill="#ff2bd6" stroke="none" />
      </g>

      {weight && <Weight at={s.handNear} />}
    </svg>
  );
}

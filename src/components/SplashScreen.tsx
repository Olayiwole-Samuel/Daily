import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const DURATION_MS = 2800;
const STATUS_LINES = ['Charging neon tubes…', 'Counting your streaks…', 'Polishing your goals…', 'Hyping you up…'];
const TITLE = 'WEEKLY';
const SUBTITLE = 'GOALS';

// ---------- Warp-speed starfield on a <canvas> ----------
// Each star has a 3D position; every frame it moves toward the viewer (z shrinks)
// and we draw a streak from its previous screen position to the new one.
function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#00f0ff', '#ff2bd6', '#ffffff', '#b026ff', '#ffe600'];
    const stars = Array.from({ length: 260 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    let speed = 0.004;
    const start = performance.now();

    const tick = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.42;
      // Accelerate into "warp" over the first second.
      speed = Math.min(0.03, 0.004 + ((now - start) / 1000) * 0.02);

      // Paint a translucent layer instead of clearing, which leaves motion trails.
      ctx.fillStyle = 'rgba(5, 1, 15, 0.35)';
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        const px = cx + (s.x / s.z) * w * 0.25;
        const py = cy + (s.y / s.z) * h * 0.25;
        s.z -= speed;
        if (s.z <= 0.02) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = 1;
          continue;
        }
        const nx = cx + (s.x / s.z) * w * 0.25;
        const ny = cy + (s.y / s.z) * h * 0.25;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.4);
        ctx.lineWidth = (1 - s.z) * 2.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

// ---------- One neon-sign letter that "ignites" with a flicker ----------
function NeonLetter({ char, delay, color }: { char: string; delay: number; color: string }) {
  return (
    <motion.span
      className="neon-text-strong inline-block"
      style={{ color }}
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      // A real neon tube stutters before it stays lit.
      animate={{ opacity: [0, 1, 0.15, 1, 0.5, 1], y: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.7, times: [0, 0.2, 0.35, 0.5, 0.7, 1] }}
    >
      {char}
    </motion.span>
  );
}

// ---------- The logo: ring + arc + check that draw themselves ----------
function Logo() {
  const draw = (delay: number, duration = 0.8) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { delay, duration, ease: [0.65, 0, 0.35, 1] as const },
  });
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className="h-28 w-28 sm:h-32 sm:w-32"
      initial={{ scale: 0.6, rotate: -90 }}
      animate={{ scale: [0.6, 1.08, 1], rotate: 0 }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
      style={{ filter: 'drop-shadow(0 0 6px #00f0ff) drop-shadow(0 0 18px #ff2bd6)' }}
      aria-hidden
    >
      <motion.circle cx="100" cy="100" r="78" fill="none" stroke="#00f0ff" strokeWidth="9" strokeLinecap="round" {...draw(0.1)} />
      <motion.path d="M100 22 A78 78 0 0 1 178 100" fill="none" stroke="#ff2bd6" strokeWidth="12" strokeLinecap="round" {...draw(0.5, 0.5)} />
      <motion.path d="M64 102 L90 128 L138 76" fill="none" stroke="#39ff14" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" {...draw(0.85, 0.45)} />
    </motion.svg>
  );
}

// ---------- Synthwave sun: gradient disc with horizontal cut-out stripes ----------
// The mask is opaque except for thin transparent bands that get wider toward the bottom.
const SUN_MASK =
  'linear-gradient(180deg, #000 0 55%, transparent 55% 59%, #000 59% 67%, transparent 67% 72%, #000 72% 79%, transparent 79% 85%, #000 85% 90%, transparent 90% 96%, #000 96%)';

function SynthSun() {
  return (
    <motion.div
      aria-hidden
      // Centering uses motion's `x` because motion owns the transform property
      // (a Tailwind -translate-x-1/2 would be overwritten).
      className="absolute left-1/2 top-[66%] h-[46vmin] w-[46vmin] rounded-full"
      style={{
        background: 'linear-gradient(180deg, #ffe600 0%, #ff8a00 35%, #ff2bd6 75%, #b026ff 100%)',
        boxShadow: '0 0 60px rgba(255, 43, 214, .55), 0 0 140px rgba(255, 138, 0, .35)',
        WebkitMaskImage: SUN_MASK,
        maskImage: SUN_MASK,
      }}
      initial={{ x: '-50%', y: '40%', opacity: 0 }}
      animate={{ x: '-50%', y: '-15%', opacity: 0.9 }}
      transition={{ duration: 2.2, ease: 'easeOut' }}
    />
  );
}

// Full-screen intro shown each time the app opens. Tap anywhere to skip.
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const total = reduceMotion ? 700 : DURATION_MS;
  const [percent, setPercent] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  // Random ignition delays, picked once. (The component re-renders every frame
  // while the bar fills, so picking them during render would keep changing them.)
  const [jitter] = useState(() => Array.from({ length: TITLE.length + SUBTITLE.length }, () => Math.random() * 0.15));

  // Drive the progress counter and the rotating status line from one timer.
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      // Ease-out so it races early then "settles" at 100.
      setPercent(Math.round((1 - Math.pow(1 - t, 2.2)) * 100));
      setStatusIndex(Math.min(STATUS_LINES.length - 1, Math.floor(t * STATUS_LINES.length)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else window.setTimeout(onDone, 250);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone, total]);

  return (
    <motion.div
      role="status"
      aria-label="Loading Weekly Goals"
      onClick={onDone}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-night-950 text-white"
      exit={{ opacity: 0, scale: 1.25, filter: 'blur(12px)' }}
      transition={{ duration: 0.55, ease: [0.7, 0, 0.84, 0] }}
    >
      {!reduceMotion && <Starfield />}
      <SynthSun />
      <div className="neon-bg !z-0" aria-hidden>
        <div className="grid-floor !opacity-70" style={{ animationDuration: '0.9s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6">
        <Logo />

        <h1 className="mt-6 text-center font-neon text-4xl leading-tight tracking-wider sm:text-6xl">
          <span className="block">
            {TITLE.split('').map((c, i) => (
              <NeonLetter key={i} char={c} delay={0.6 + i * 0.07 + jitter[i]} color="#ff2bd6" />
            ))}
          </span>
          <span className="block">
            {SUBTITLE.split('').map((c, i) => (
              <NeonLetter key={i} char={c} delay={1.0 + i * 0.08 + jitter[TITLE.length + i]} color="#00f0ff" />
            ))}
          </span>
        </h1>

        <motion.p
          className="mt-3 text-sm font-semibold uppercase tracking-[0.4em] text-neon-yellow"
          style={{ textShadow: '0 0 10px rgba(255,230,0,.7)' }}
          initial={{ opacity: 0, letterSpacing: '1em' }}
          animate={{ opacity: 1, letterSpacing: '0.4em' }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          level up your week
        </motion.p>

        {/* Charging bar */}
        <div className="mt-10 w-64 sm:w-80">
          <div className="relative h-2.5 overflow-hidden rounded-full border border-white/15 bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-violet to-neon-cyan"
              style={{ width: `${percent}%`, boxShadow: '0 0 12px #ff2bd6, 0 0 24px #00f0ff' }}
            />
            <div className="absolute inset-y-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-violet-200/80">
            <motion.span key={statusIndex} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {STATUS_LINES[statusIndex]}
            </motion.span>
            <span className="tabular-nums text-neon-cyan">{percent}%</span>
          </div>
        </div>
      </div>

      <p className="absolute bottom-6 z-10 text-xs text-white/40">tap to skip</p>
    </motion.div>
  );
}

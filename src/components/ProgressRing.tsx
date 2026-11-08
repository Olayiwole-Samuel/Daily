import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

// A glowing pink→cyan ring that fills as goals get done.
// When everything is done it pulses and turns lime.
export default function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 112;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = total === 0 ? 0 : done / total;
  const complete = total > 0 && done === total;

  // The number in the middle counts up/down smoothly instead of jumping.
  const count = useMotionValue(done);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    const controls = animate(count, done, { duration: 0.5, ease: 'easeOut' });
    return () => controls.stop();
  }, [count, done]);

  return (
    <motion.div
      className="relative h-28 w-28 shrink-0"
      role="img"
      aria-label={`${done} of ${total} done`}
      animate={complete ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={complete ? { duration: 1.4, repeat: Infinity } : undefined}
    >
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={complete ? '#39ff14' : '#ff2bd6'} />
            <stop offset="100%" stopColor={complete ? '#00f0ff' : '#00f0ff'} />
          </linearGradient>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-violet-200 dark:stroke-white/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#ring-gradient)"
          filter="url(#ring-glow)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-2xl font-bold tabular-nums">
          <motion.span>{rounded}</motion.span>/{total}
        </span>
        <span className="muted text-xs uppercase tracking-widest">done</span>
      </div>
    </motion.div>
  );
}

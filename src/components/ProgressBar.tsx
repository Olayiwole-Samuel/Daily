import { motion } from 'framer-motion';

// A glowing bar in the goal's colour that springs to its width, with a shimmer sweep.
export default function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="relative h-3.5 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-white/10"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <motion.div
        className="relative h-full overflow-hidden rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: 'spring', stiffness: 70, damping: 16 }}
      >
        <span className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" aria-hidden />
      </motion.div>
    </div>
  );
}

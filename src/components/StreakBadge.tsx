import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import type { StreakInfo } from '../types';

// Flame + number. The flame dances and glows while the streak is alive; greyed out at 0.
// The number pops whenever it changes.
export default function StreakBadge({ streak }: { streak: StreakInfo | null }) {
  if (!streak) return null;
  const { current, best, unit, aliveToday } = streak;
  const word = unit === 'weeks' ? (current === 1 ? 'week' : 'weeks') : current === 1 ? 'day' : 'days';
  const active = current > 0;
  const title = `${current} ${word} streak, best ${best}${aliveToday && active ? '. Do it today to keep it going' : ''}`;

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-bold ${
        active
          ? 'border-orange-400/60 bg-orange-500/15 text-orange-600 shadow-[0_0_8px_rgba(255,138,0,.2)] dark:text-orange-300'
          : 'border-violet-200 bg-violet-100/50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-violet-200/50'
      }`}
    >
      <Flame
        className={`h-4 w-4 ${active ? 'animate-flame-dance fill-yellow-300 text-orange-500' : ''}`}
        style={active ? { filter: 'drop-shadow(0 0 4px #ff8a00)' } : undefined}
        aria-hidden
      />
      <motion.span key={current} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
        {current}
      </motion.span>
      <span className="font-normal">{unit === 'weeks' ? 'wk' : 'd'}</span>
    </span>
  );
}

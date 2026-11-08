import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { DayStatus } from '../lib/progress';
import { WEEKDAY_SHORT } from '../lib/dates';

const STATUS_TEXT: Record<DayStatus, string> = {
  done: 'done',
  missed: 'missed',
  today: 'today, not done yet',
  future: 'upcoming',
  off: 'not scheduled',
};

const STATUS_CLASS: Record<DayStatus, string> = {
  done: '',
  missed: 'border-red-400/60 bg-red-500/10 text-red-500',
  today: 'border-neon-cyan animate-pulse shadow-neon-cyan',
  future: 'border-violet-300 dark:border-white/15',
  off: 'border-dashed border-violet-200 dark:border-white/10',
};

// Seven dots, Mon..Sun. Done days light up in the goal's colour; they pop in one by one.
export default function WeekGrid({ statuses, color }: { statuses: DayStatus[]; color: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {statuses.map((status, i) => (
        <li key={i} className="flex flex-col items-center gap-1" aria-label={`${WEEKDAY_SHORT[i]}: ${STATUS_TEXT[status]}`}>
          <span className="muted text-[11px] font-semibold" aria-hidden>
            {WEEKDAY_SHORT[i][0]}
          </span>
          <motion.span
            aria-hidden
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${STATUS_CLASS[status]}`}
            style={status === 'done' ? { backgroundColor: color, borderColor: color, boxShadow: `0 0 6px ${color}55` } : undefined}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 15 }}
          >
            {status === 'done' && <Check className="h-4 w-4 text-night-950" strokeWidth={3.5} />}
            {status === 'missed' && <X className="h-3.5 w-3.5" strokeWidth={3} />}
          </motion.span>
        </li>
      ))}
    </ol>
  );
}

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { haptic } from '../../lib/haptics';

// Small building blocks for the Coach forms. All are real <button>s with
// aria-pressed, so screen readers announce them as toggle buttons.

export function ChoiceCard({
  selected,
  onSelect,
  title,
  subtitle,
  icon,
  color = '#00f0ff',
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        haptic();
        onSelect();
      }}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
        selected ? 'bg-white/80 dark:bg-white/10' : 'border-violet-200 bg-white/50 dark:border-white/10 dark:bg-white/[0.03]'
      }`}
      style={selected ? { borderColor: color, boxShadow: `0 0 12px ${color}33` } : undefined}
    >
      {icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22`, color }}>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {subtitle && <span className="muted block text-sm">{subtitle}</span>}
      </span>
    </motion.button>
  );
}

export function Chip({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic();
        onToggle();
      }}
      className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
        selected
          ? 'border-neon-pink bg-neon-pink/15 text-neon-pink dark:text-pink-200'
          : 'border-violet-200 text-slate-700 dark:border-white/15 dark:text-violet-100'
      }`}
    >
      {children}
    </button>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const change = (delta: number) => {
    haptic();
    onChange(Math.min(max, Math.max(min, value + delta)));
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <button type="button" className="icon-btn border border-violet-200 dark:border-white/15" aria-label={`Less ${label}`} onClick={() => change(-step)} disabled={value <= min}>
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <span className="min-w-[4.5rem] text-center text-lg font-bold tabular-nums" aria-live="polite">
          {value}
          {suffix && <span className="muted ml-1 text-sm font-normal">{suffix}</span>}
        </span>
        <button type="button" className="icon-btn border border-violet-200 dark:border-white/15" aria-label={`More ${label}`} onClick={() => change(step)} disabled={value >= max}>
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function Disclaimer() {
  return <p className="muted text-center text-xs">General guidance, not medical advice.</p>;
}

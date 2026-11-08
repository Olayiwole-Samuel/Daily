import { useId, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

// iOS segmented control: a grey track with a raised "thumb" that slides to the
// selected option. Generic over T so the value keeps its exact string type.
export default function SegmentedControl<T extends string>({ options, value, onChange, label }: Props<T>) {
  // Unique layoutId per control, so two controls on one page don't share a thumb.
  const thumbId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-xl bg-violet-100 p-0.5 dark:bg-white/10" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) haptic();
              onChange(option.value);
            }}
            className="relative flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_3px_8px_rgba(0,0,0,.12),0_3px_1px_rgba(0,0,0,.04)] dark:bg-white/20"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={`relative flex items-center gap-1.5 ${selected ? '' : 'muted'}`}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

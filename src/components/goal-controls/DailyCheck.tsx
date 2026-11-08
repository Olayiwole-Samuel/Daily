import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  color: string;
  label: string; // what's being ticked, for screen readers
  disabled?: boolean;
  text?: string;
}

const BURST_COUNT = 10;

// A big, thumb-friendly checkbox. A <button role="checkbox"> gives us full styling
// while staying keyboard and screen-reader accessible (Space/Enter toggle it).
// Ticking it pops the box, bursts particles in the goal's colour and buzzes the phone.
export default function DailyCheck({ checked, onChange, color, label, disabled, text }: Props) {
  // Bumping this number replays the burst animation (it's used as a React key).
  const [burst, setBurst] = useState(0);

  function toggle() {
    const next = !checked;
    if (next) {
      setBurst((b) => b + 1);
      haptic(); // tiny tick you can feel (iPhone and Android)
    }
    onChange(next);
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
      className="group flex min-h-[48px] w-full select-none items-center gap-3 rounded-2xl px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-not-allowed disabled:opacity-40"
    >
      <motion.span
        aria-hidden
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2"
        style={{
          borderColor: checked ? color : `${color}88`,
          backgroundColor: checked ? color : 'transparent',
          boxShadow: checked ? `0 0 8px ${color}55` : 'none',
        }}
        whileTap={{ scale: 0.8 }}
        animate={checked ? { scale: [1, 1.3, 0.92, 1], rotate: [0, -8, 6, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.45 }}
      >
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
              <Check className="h-6 w-6 text-night-950" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Particle burst + shockwave ring, replayed via key */}
        {burst > 0 && (
          <span key={burst} className="pointer-events-none absolute inset-0">
            <motion.span
              className="absolute inset-0 rounded-xl border-2"
              style={{ borderColor: color }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
            {Array.from({ length: BURST_COUNT }, (_, i) => {
              const angle = (i / BURST_COUNT) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: i % 2 ? color : '#ffffff', boxShadow: `0 0 4px ${color}`, marginLeft: -3, marginTop: -3 }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(angle) * 34, y: Math.sin(angle) * 34, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.6, ease: [0.1, 0.8, 0.3, 1] }}
                />
              );
            })}
          </span>
        )}
      </motion.span>

      <motion.span
        className={`font-medium transition-colors ${checked ? 'muted line-through decoration-2' : ''}`}
        style={checked ? { textDecorationColor: color } : undefined}
        animate={checked ? { x: [0, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {text ?? (checked ? 'Done!' : 'Mark as done')}
      </motion.span>
    </button>
  );
}

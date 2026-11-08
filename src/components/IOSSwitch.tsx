import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  color?: string;
}

// An iOS-style toggle: pill track, white knob that springs across (and stretches
// slightly while you press, like the real one).
export default function IOSSwitch({ checked, onChange, label, color = '#39ff14' }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className={`group relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
        checked ? '' : 'bg-slate-300 dark:bg-white/15'
      }`}
      style={checked ? { backgroundColor: color } : undefined}
    >
      <motion.span
        className="block h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.25)] group-active:w-[33px]"
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
        style={{ marginLeft: checked ? 'auto' : 0 }}
      />
    </button>
  );
}

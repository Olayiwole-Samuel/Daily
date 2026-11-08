import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics';
import { CalendarDays, CheckCircle2, ListTodo, Settings, UtensilsCrossed, type LucideIcon } from 'lucide-react';

const TABS: { to: string; label: string; icon: LucideIcon; color: string }[] = [
  { to: '/', label: 'Today', icon: CheckCircle2, color: '#00f0ff' },
  { to: '/week', label: 'Week', icon: CalendarDays, color: '#ff2bd6' },
  { to: '/goals', label: 'Goals', icon: ListTodo, color: '#39ff14' },
  { to: '/food', label: 'Food', icon: UtensilsCrossed, color: '#ffe600' },
  { to: '/settings', label: 'Settings', icon: Settings, color: '#b026ff' },
];

// Bottom tab bar on phones; turns into a left side nav from the md breakpoint up.
// The glowing pill behind the active tab slides between tabs (shared layoutId).
export default function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-20 rounded-3xl border border-violet-200 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-night-900/75 dark:shadow-[0_0_20px_rgba(176,38,255,.12)] md:sticky md:inset-auto md:top-0 md:h-screen md:w-60 md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0"
    >
      <p className="hidden px-6 pb-6 pt-8 font-neon text-xl leading-tight md:block">
        <span className="neon-text text-neon-pink">WEEKLY</span>
        <br />
        <span className="neon-text text-neon-cyan">GOALS</span>
      </p>
      <ul className="flex md:flex-col md:gap-1 md:px-3">
        {TABS.map(({ to, label, icon: Icon, color }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              onClick={haptic}
              className="relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan md:min-h-[48px] md:flex-row md:justify-start md:gap-3 md:px-4 md:text-sm"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-1 rounded-2xl"
                      style={{ background: `${color}22`, boxShadow: `0 0 10px ${color}22`, border: `1px solid ${color}55` }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <motion.span
                    className="relative"
                    animate={isActive ? { y: [0, -6, 0], scale: [1, 1.2, 1] } : { y: 0, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    whileTap={{ scale: 0.8 }}
                  >
                    <Icon
                      className="h-6 w-6 md:h-5 md:w-5"
                      style={isActive ? { color, filter: `drop-shadow(0 0 3px ${color}88)` } : undefined}
                      aria-hidden
                    />
                  </motion.span>
                  <span className={`relative ${isActive ? '' : 'text-slate-500 dark:text-violet-200/60'}`} style={isActive ? { color } : undefined}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

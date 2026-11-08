import { useRef, type ReactNode, type TouchEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { haptic } from '../lib/haptics';

interface Props {
  // The date (or week start) being shown. ISO dates sort as strings, so comparing
  // the new key with the old one tells us which way to slide.
  swipeKey: string;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
}

const MIN_DISTANCE = 60; // px a finger must travel to count as a swipe

// Swipe right for the previous day/week, left for the next, like flipping pages.
// The content slides in from the side you're heading toward.
export default function SwipeDays({ swipeKey, onPrev, onNext, children }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const previousKey = useRef(swipeKey);
  const direction = swipeKey >= previousKey.current ? 1 : -1;
  previousKey.current = swipeKey;

  function onTouchStart(e: TouchEvent) {
    // Don't hijack swipes that start in a text box (people select/move the caret there).
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) {
      start.current = null;
      return;
    }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    if (!start.current) return;
    const dx = e.changedTouches[0].clientX - start.current.x;
    const dy = e.changedTouches[0].clientY - start.current.y;
    start.current = null;
    // Mostly-horizontal movement only, so normal scrolling never flips the day.
    if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    haptic();
    if (dx > 0) onPrev();
    else onNext();
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={swipeKey}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ x: dir * 80, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (dir: number) => ({ x: dir * -80, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

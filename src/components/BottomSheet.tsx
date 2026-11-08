import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean; // for forms: nearly full height, scrolls inside
}

// An iOS-style sheet: slides up from the bottom, drag the grabber down to dismiss,
// tap the dimmed area or press Escape to close. While it's open the page behind
// shrinks back a little (see .sheet-open in index.css), like iOS modal sheets.
//
// It's rendered into <body> with a portal so page transforms can't affect its
// fixed positioning.
export default function BottomSheet({ open, onClose, title, children, tall }: Props) {
  const drag = useDragControls();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add('sheet-open');
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Move focus into the sheet so keyboard and screen-reader users land in it.
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('sheet-open');
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  // Dismiss if dragged far enough or flicked down fast enough.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-night-950/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`relative flex w-full max-w-lg flex-col rounded-t-[2rem] border border-white/10 bg-white/95 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-slate-900 shadow-[0_-10px_40px_rgba(176,38,255,.35)] backdrop-blur-2xl dark:bg-night-900/95 dark:text-slate-100 md:rounded-[2rem] md:pb-4 ${
              tall ? 'max-h-[92dvh]' : 'max-h-[80dvh]'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            // iOS sheets use a soft, slightly bouncy spring.
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            {/* Grabber: the only place a drag starts, so scrolling inside still works */}
            <div className="flex cursor-grab touch-none justify-center pb-2 pt-3 active:cursor-grabbing" onPointerDown={(e) => drag.start(e)}>
              <span className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-white/25" />
            </div>
            {title && (
              <h2 id={titleId} className="touch-none px-6 pb-2 text-center text-lg font-bold" onPointerDown={(e) => drag.start(e)}>
                {title}
              </h2>
            )}
            <div className="overflow-y-auto overscroll-contain px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

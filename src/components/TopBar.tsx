import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// iOS-style navigation bar: invisible at the top of the page, then a frosted
// bar with a small centered title fades in once you scroll past the big title.
// It also sits behind the status bar so scrolled content never clashes with the clock.
export default function TopBar({ title }: { title: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] transition-colors duration-300 md:hidden ${
        scrolled ? 'border-b border-violet-200/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-night-950/70' : 'bg-transparent'
      }`}
    >
      <div className="flex h-11 items-center justify-center">
        <AnimatePresence>
          {scrolled && (
            <motion.span
              key={title}
              className="text-[17px] font-semibold"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

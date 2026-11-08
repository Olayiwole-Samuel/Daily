import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// A neon message that springs in above the tab bar and hides itself after a few seconds.
export default function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          className="fixed inset-x-4 bottom-28 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-3xl border border-neon-pink/60 bg-night-900/95 px-5 py-4 text-white shadow-neon-pink backdrop-blur md:bottom-8"
          initial={{ opacity: 0, y: 60, scale: 0.6, rotate: -4 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: 30, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        >
          <p className="flex-1 text-lg font-bold">{message}</p>
          <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-full p-1 hover:bg-white/15">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

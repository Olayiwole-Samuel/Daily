import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  label: string;
  sublabel?: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  // Shown when you've moved away from today / this week, to jump back.
  onReset?: () => void;
  resetLabel?: string;
}

export default function DateNav({ label, sublabel, onPrev, onNext, prevLabel, nextLabel, onReset, resetLabel }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" className="icon-btn" onClick={onPrev} aria-label={prevLabel}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <div className="flex-1 text-center">
          <h1 className="page-title">{label}</h1>
          {sublabel && <p className="muted text-sm">{sublabel}</p>}
        </div>
        <button type="button" className="icon-btn" onClick={onNext} aria-label={nextLabel}>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
      {onReset && (
        <div className="mt-1 text-center">
          <button type="button" className="text-sm font-semibold text-neon-pink underline-offset-2 hover:underline dark:text-neon-cyan" onClick={onReset}>
            {resetLabel}
          </button>
        </div>
      )}
    </div>
  );
}

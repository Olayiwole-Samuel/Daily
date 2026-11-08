import DailyCheck from './DailyCheck';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  color: string;
  label: string;
  disabled?: boolean;
  weekCount: number;
  target: number;
  unit?: string;
}

// Same checkbox as a daily habit, plus how many times this week so far.
export default function CountCheck({ weekCount, target, unit, ...check }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <DailyCheck {...check} text={check.checked ? 'Done today' : 'Did it today'} />
      </div>
      <span className="muted shrink-0 text-sm">
        {weekCount}/{target} {unit ?? 'this week'}
      </span>
    </div>
  );
}

import { useId } from 'react';

interface Props {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  weekTotal: number;
  target: number;
  unit?: string;
  disabled?: boolean;
}

// Log today's amount; the weekly running total sits beside it.
export default function NumberInput({ value, onChange, weekTotal, target, unit, disabled }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-sm font-medium">
        Logged
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        disabled={disabled}
        className="input w-24 text-center"
        value={value ?? ''}
        placeholder="0"
        onChange={(e) => {
          const n = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
          onChange(n);
        }}
      />
      <span className="muted text-sm">{unit}</span>
      <span className="muted ml-auto text-sm">
        {weekTotal}/{target} this week
      </span>
    </div>
  );
}

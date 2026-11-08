import { useEffect, useId, useState } from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  label: string;
}

// Keeps the text locally while typing and saves after a short pause, so we don't
// save and recalculate streaks on every single keystroke.
// The parent gives this a `key` per date, so switching days resets the local text.
export default function JournalInput({ value, onChange, disabled, label }: Props) {
  const id = useId();
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 400);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        disabled={disabled}
        className="input resize-y"
        placeholder="What did you learn today?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onChange(text)}
      />
    </div>
  );
}

import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
  /** Used (clamped) when the field is empty/invalid on blur. */
  fallback: number;
  min: number;
  max: number;
}

/** Integer input that allows '' while editing and only clamps/falls back on blur. */
export default function NumberInput({
  value,
  onValueChange,
  fallback,
  min,
  max,
  ...rest
}: Props): React.ReactElement {
  const [text, setText] = useState<string | null>(null); // null = not editing, show value
  const commit = (raw: string): number => {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
  };
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={text ?? value}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n) && n >= min && n <= max) onValueChange(n);
      }}
      onBlur={(e) => {
        onValueChange(commit(e.target.value));
        setText(null);
        rest.onBlur?.(e);
      }}
    />
  );
}

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NumberInput from '../NumberInput';

function Harness({ onChange }: { onChange: (n: number) => void }): React.ReactElement {
  const [v, setV] = useState(5);
  return (
    <NumberInput
      aria-label="n"
      value={v}
      min={1}
      max={100}
      fallback={5}
      onValueChange={(n) => {
        setV(n);
        onChange(n);
      }}
    />
  );
}

describe('NumberInput', () => {
  it('lets you clear and type 2 without snapping to 52', () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2');
  });

  it('falls back on blur when empty', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input.value).toBe('5');
  });
});

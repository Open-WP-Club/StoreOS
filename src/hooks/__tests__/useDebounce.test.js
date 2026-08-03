import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));

    expect(result.current).toBe('initial');
  });

  it('should not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: 'updated', delay: 300 });

    // Before delay passes
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('initial');
  });

  it('should update value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: 'updated', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('should reset timer on value change', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: 'first', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'second', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Still should be initial because timer was reset
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now should be 'second' (300ms after last change)
    expect(result.current).toBe('second');
  });

  it('should use default delay of 300ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('updated');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('updated');
  });

  it('should work with numbers', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    rerender({ value: 42, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(42);
  });

  it('should work with objects', () => {
    const initial = { name: 'initial' };
    const updated = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initial, delay: 300 } }
    );

    rerender({ value: updated, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual(updated);
  });

  it('should work with arrays', () => {
    const initial = [1, 2, 3];
    const updated = [4, 5, 6];

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initial, delay: 300 } }
    );

    rerender({ value: updated, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual(updated);
  });

  it('should handle null and undefined', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: null, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBeNull();

    rerender({ value: undefined, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBeUndefined();
  });

  it('should cleanup timeout on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: 'updated', delay: 300 });

    // Unmount before timeout completes
    unmount();

    // This should not cause any errors
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });

  it('should handle rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // Simulate rapid typing
    for (let i = 0; i < 10; i++) {
      rerender({ value: `value-${i}`, delay: 300 });
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }

    // Should still be initial
    expect(result.current).toBe('initial');

    // Wait for debounce to complete
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should be the last value
    expect(result.current).toBe('value-9');
  });
});

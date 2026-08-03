import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  let dateNowCounter = 1000000000000;
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Use fake timers but keep Date.now manual so we can mock it with incrementing values
    vi.useFakeTimers({ doNotFake: ['Date'] });
    // Mock Date.now() to return incrementing values to prevent ID collisions
    dateNowCounter = 1000000000000;
    Date.now = vi.fn(() => dateNowCounter++);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // Restore Date.now
    Date.now = originalDateNow;
  });

  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it('should show a toast with default settings', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Test message',
      type: 'info',
      duration: 3000,
      id: expect.any(String),
    });
  });

  it('should show toast with custom type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Error message', 'error');
    });

    expect(result.current.toasts[0].type).toBe('error');
  });

  it('should show toast with custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Custom duration', 'success', 5000);
    });

    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('should auto-remove toast after duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'info', 3000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2999);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should not auto-remove toast when duration is 0', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Persistent message', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('should not auto-remove toast when duration is negative', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Persistent message', 'info', -1);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('should show multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First toast', 'info');
      result.current.showToast('Second toast', 'success');
      result.current.showToast('Third toast', 'error');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe('First toast');
    expect(result.current.toasts[1].message).toBe('Second toast');
    expect(result.current.toasts[2].message).toBe('Third toast');
  });

  it('should remove specific toast by id', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Toast 1', 'info', 0);
      result.current.showToast('Toast 2', 'info', 0);
      result.current.showToast('Toast 3', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(3);

    const toastToRemove = result.current.toasts[1];

    act(() => {
      result.current.removeToast(toastToRemove.id);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.find((t) => t.id === toastToRemove.id)).toBeUndefined();
  });

  it('should assign unique IDs to toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Toast 1');
      result.current.showToast('Toast 2');
      result.current.showToast('Toast 3');
    });

    const ids = result.current.toasts.map((t) => t.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should handle removing non-existent toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test toast', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(99999); // Non-existent ID
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('should handle rapid toast creation and removal', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      // Show 5 toasts rapidly
      for (let i = 0; i < 5; i++) {
        result.current.showToast(`Toast ${i}`, 'info', 100);
      }
    });

    expect(result.current.toasts).toHaveLength(5);

    // Advance time to remove all toasts
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle different toast types', () => {
    const { result } = renderHook(() => useToast());

    const types = ['info', 'success', 'error', 'warning'];

    act(() => {
      types.forEach((type) => {
        result.current.showToast(`${type} message`, type, 0);
      });
    });

    expect(result.current.toasts).toHaveLength(types.length);
    types.forEach((type, index) => {
      expect(result.current.toasts[index].type).toBe(type);
    });
  });

  it('should preserve toast order', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'info', 0);
    });

    act(() => {
      vi.advanceTimersByTime(10);
    });

    act(() => {
      result.current.showToast('Second', 'info', 0);
    });

    act(() => {
      vi.advanceTimersByTime(10);
    });

    act(() => {
      result.current.showToast('Third', 'info', 0);
    });

    expect(result.current.toasts[0].message).toBe('First');
    expect(result.current.toasts[1].message).toBe('Second');
    expect(result.current.toasts[2].message).toBe('Third');
  });

  it('should allow removing middle toast without affecting others', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'info', 0);
      result.current.showToast('Second', 'info', 0);
      result.current.showToast('Third', 'info', 0);
    });

    const middleToastId = result.current.toasts[1].id;

    act(() => {
      result.current.removeToast(middleToastId);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].message).toBe('First');
    expect(result.current.toasts[1].message).toBe('Third');
  });
});

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressiveLoading, sleep } from '../useProgressiveLoading';

describe('useProgressiveLoading', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should initialize with default loading state', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    expect(result.current.loadingState).toEqual({
      isLoading: false,
      loaded: 0,
      total: 0,
      progress: 0,
      dataType: '',
    });
  });

  it('should start loading with specified data type', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
    });

    expect(result.current.loadingState).toEqual({
      isLoading: true,
      loaded: 0,
      total: 100,
      progress: 0,
      dataType: 'products',
    });
  });

  it('should update progress correctly', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
    });

    act(() => {
      result.current.updateProgress(50, 100);
    });

    expect(result.current.loadingState.loaded).toBe(50);
    expect(result.current.loadingState.total).toBe(100);
    expect(result.current.loadingState.progress).toBe(50);
  });

  it('should calculate progress percentage correctly', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('orders', 200);
    });

    act(() => {
      result.current.updateProgress(75, 200);
    });

    expect(result.current.loadingState.progress).toBe(38); // 75/200 = 37.5 rounded to 38
  });

  it('should handle progress when total is 0', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 0);
    });

    act(() => {
      result.current.updateProgress(0, 0);
    });

    expect(result.current.loadingState.progress).toBe(0);
  });

  it('should finish loading and set progress to 100', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
      result.current.updateProgress(100, 100);
    });

    act(() => {
      result.current.finishLoading();
    });

    expect(result.current.loadingState.isLoading).toBe(false);
    expect(result.current.loadingState.progress).toBe(100);
  });

  it('should cancel loading', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
    });

    expect(result.current.loadingState.isLoading).toBe(true);

    act(() => {
      result.current.cancelLoading();
    });

    expect(result.current.loadingState.isLoading).toBe(false);
    expect(result.current.isCancelled()).toBe(true);
  });

  it('should not update progress when cancelled', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
      result.current.cancelLoading();
    });

    const progressBefore = result.current.loadingState.progress;

    act(() => {
      result.current.updateProgress(50, 100);
    });

    expect(result.current.loadingState.progress).toBe(progressBefore);
  });

  it('should reset cancel flag when starting new loading', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
      result.current.cancelLoading();
    });

    expect(result.current.isCancelled()).toBe(true);

    act(() => {
      result.current.startLoading('orders', 50);
    });

    expect(result.current.isCancelled()).toBe(false);
    expect(result.current.loadingState.isLoading).toBe(true);
  });

  it('should handle multiple progress updates', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('products', 100);
    });

    act(() => {
      result.current.updateProgress(25, 100);
    });
    expect(result.current.loadingState.progress).toBe(25);

    act(() => {
      result.current.updateProgress(50, 100);
    });
    expect(result.current.loadingState.progress).toBe(50);

    act(() => {
      result.current.updateProgress(75, 100);
    });
    expect(result.current.loadingState.progress).toBe(75);

    act(() => {
      result.current.updateProgress(100, 100);
    });
    expect(result.current.loadingState.progress).toBe(100);
  });

  it('should preserve dataType through progress updates', () => {
    const { result } = renderHook(() => useProgressiveLoading());

    act(() => {
      result.current.startLoading('orders', 50);
    });

    act(() => {
      result.current.updateProgress(25, 50);
    });

    expect(result.current.loadingState.dataType).toBe('orders');
  });
});

describe('sleep utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay for specified milliseconds', async () => {
    const promise = sleep(1000);

    vi.advanceTimersByTime(999);
    await Promise.resolve(); // Flush promises

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;

    expect(resolved).toBe(true);
  });

  it('should resolve immediately for 0 ms', async () => {
    const promise = sleep(0);
    vi.advanceTimersByTime(0);
    await promise;
    // If we get here without hanging, test passes
    expect(true).toBe(true);
  });
});

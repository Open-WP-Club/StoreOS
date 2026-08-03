import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useOnlineStatus from '../useOnlineStatus';
import useOffline from '../../stores/offlineStore';

// Mock the offlineStore
vi.mock('../../stores/offlineStore');

describe('useOnlineStatus', () => {
  let mockSetOnline;
  let mockCheckOnlineStatus;

  beforeEach(() => {
    // Reset mocks
    mockSetOnline = vi.fn();
    mockCheckOnlineStatus = vi.fn().mockResolvedValue(true);

    // Setup useOffline mock
    useOffline.mockImplementation((selector) => {
      const state = {
        setOnline: mockSetOnline,
        checkOnlineStatus: mockCheckOnlineStatus,
      };
      return selector(state);
    });

    // Set navigator.onLine to true by default
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with navigator.onLine value', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);
  });

  it('should initialize as offline when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(false);
  });

  it('should call setOnline on mount', () => {
    renderHook(() => useOnlineStatus());

    expect(mockSetOnline).toHaveBeenCalledWith(true);
  });

  it('should update isOnline when online event is fired', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(mockSetOnline).toHaveBeenCalledWith(true);
  });

  it('should update isOnline when offline event is fired', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('should remove event listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should provide checkStatus function that returns online status', async () => {
    mockCheckOnlineStatus.mockResolvedValue(true);

    const { result } = renderHook(() => useOnlineStatus());

    let status;
    await act(async () => {
      status = await result.current.checkStatus();
    });

    expect(status).toBe(true);
    expect(mockCheckOnlineStatus).toHaveBeenCalled();
  });

  it('should update isOnline after checkStatus returns', async () => {
    mockCheckOnlineStatus.mockResolvedValue(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true); // Initial value from navigator.onLine

    await act(async () => {
      await result.current.checkStatus();
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should handle multiple online/offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('should sync state with offlineStore on events', () => {
    renderHook(() => useOnlineStatus());

    mockSetOnline.mockClear();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(mockSetOnline).toHaveBeenCalledWith(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockSetOnline).toHaveBeenCalledWith(true);
  });

  it('should handle checkOnlineStatus returning false', async () => {
    mockCheckOnlineStatus.mockResolvedValue(false);

    const { result } = renderHook(() => useOnlineStatus());

    let status;
    await act(async () => {
      status = await result.current.checkStatus();
    });

    expect(status).toBe(false);
    expect(result.current.isOnline).toBe(false);
  });

  it('should return stable function references', () => {
    const { result, rerender } = renderHook(() => useOnlineStatus());

    const checkStatus1 = result.current.checkStatus;

    rerender();

    const checkStatus2 = result.current.checkStatus;

    expect(checkStatus1).toBe(checkStatus2);
  });
});

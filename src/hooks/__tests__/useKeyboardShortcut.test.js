import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut, useIsMac, getShortcutDisplay } from '../useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  let callback;

  beforeEach(() => {
    callback = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call callback when shortcut is pressed', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
  });

  it('should not call callback when wrong key is pressed', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'j',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should not call callback when modifier is missing', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: false,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle multiple key combinations', () => {
    renderHook(() => useKeyboardShortcut(['ctrl+k', 'cmd+k'], callback));

    // Test ctrl+k
    const ctrlEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(ctrlEvent);
    expect(callback).toHaveBeenCalledTimes(1);

    // Test cmd+k
    const cmdEvent = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(cmdEvent);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should handle shift modifier', () => {
    renderHook(() => useKeyboardShortcut('shift+enter', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle alt modifier', () => {
    renderHook(() => useKeyboardShortcut('alt+f', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      altKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple modifiers', () => {
    renderHook(() => useKeyboardShortcut('ctrl+shift+p', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback when disabled', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback, { enabled: false }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should prevent default when preventDefault is true', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback, { preventDefault: true }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not prevent default when preventDefault is false', () => {
    renderHook(() => useKeyboardShortcut('ctrl+k', callback, { preventDefault: false }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcut('ctrl+k', callback));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should update callback without re-registering listener', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useKeyboardShortcut('ctrl+k', cb),
      { initialProps: { cb: callback1 } }
    );

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    // Update callback
    rerender({ cb: callback2 });

    window.dispatchEvent(event);
    expect(callback1).toHaveBeenCalledTimes(1); // Still 1
    expect(callback2).toHaveBeenCalledTimes(1); // New callback called
  });

  it('should handle case-insensitive keys', () => {
    renderHook(() => useKeyboardShortcut('CTRL+K', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should match using event.code as fallback', () => {
    renderHook(() => useKeyboardShortcut('ctrl+keyp', callback));

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('useIsMac', () => {
  let originalPlatform;

  beforeEach(() => {
    originalPlatform = navigator.platform;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should return true on Mac platform', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true,
    });

    const { result } = renderHook(() => useIsMac());
    expect(result.current).toBe(true);
  });

  it('should return false on Windows platform', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true,
    });

    const { result } = renderHook(() => useIsMac());
    expect(result.current).toBe(false);
  });

  it('should return false on Linux platform', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Linux x86_64',
      writable: true,
    });

    const { result } = renderHook(() => useIsMac());
    expect(result.current).toBe(false);
  });
});

describe('getShortcutDisplay', () => {
  let originalPlatform;

  beforeEach(() => {
    originalPlatform = navigator.platform;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should format shortcut for Mac', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true,
    });

    expect(getShortcutDisplay('cmd+k')).toBe('⌘K');
    expect(getShortcutDisplay('ctrl+shift+p')).toBe('⌃⇧P');
    expect(getShortcutDisplay('alt+f')).toBe('⌥F');
  });

  it('should format shortcut for Windows/Linux', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true,
    });

    expect(getShortcutDisplay('ctrl+k')).toBe('Ctrl+K');
    expect(getShortcutDisplay('ctrl+shift+p')).toBe('Ctrl+Shift+P');
    expect(getShortcutDisplay('alt+f')).toBe('Alt+F');
  });

  it('should use first key combination from array', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true,
    });

    expect(getShortcutDisplay(['ctrl+k', 'cmd+k'])).toBe('⌃K');
  });

  it('should handle meta key same as cmd on Mac', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true,
    });

    expect(getShortcutDisplay('meta+k')).toBe('⌘K');
  });

  it('should convert meta to Ctrl on Windows', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true,
    });

    expect(getShortcutDisplay('meta+k')).toBe('Ctrl+K');
  });
});

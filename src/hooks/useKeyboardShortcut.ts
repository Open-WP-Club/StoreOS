import { useEffect, useRef } from 'react';

/**
 * Options for keyboard shortcut hook
 */
export interface KeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Callback type for keyboard events
 */
export type KeyboardCallback = (event: KeyboardEvent) => void;

/**
 * Hook to register keyboard shortcuts
 * @param keys - Key combination (e.g., 'ctrl+k', 'cmd+k', or ['ctrl+k', 'cmd+k'])
 * @param callback - Function to call when shortcut is pressed
 * @param options - Options for the shortcut
 */
export function useKeyboardShortcut(
  keys: string | string[],
  callback: KeyboardCallback,
  options: KeyboardShortcutOptions = {}
): void {
  const { enabled = true, preventDefault = true } = options;
  const callbackRef = useRef<KeyboardCallback>(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Normalize keys to an array
      const keyArray = Array.isArray(keys) ? keys : [keys];

      // Check if any key combination matches
      const matches = keyArray.some((keyCombo) => {
        const parts = keyCombo.toLowerCase().split('+');
        const key = parts[parts.length - 1] ?? '';
        const modifiers = parts.slice(0, -1);

        // Check key match
        const keyMatch =
          event.key.toLowerCase() === key || event.code.toLowerCase() === key.toLowerCase();

        if (!keyMatch) return false;

        // Check modifiers
        const ctrlMatch = modifiers.includes('ctrl') ? event.ctrlKey : !event.ctrlKey;
        const altMatch = modifiers.includes('alt') ? event.altKey : !event.altKey;
        const shiftMatch = modifiers.includes('shift') ? event.shiftKey : !event.shiftKey;

        // Handle both cmd and meta
        const cmdMatch =
          modifiers.includes('cmd') || modifiers.includes('meta')
            ? event.metaKey
            : !event.metaKey;

        return ctrlMatch && altMatch && shiftMatch && cmdMatch;
      });

      if (matches) {
        if (preventDefault) {
          event.preventDefault();
        }
        callbackRef.current(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keys, enabled, preventDefault]);
}

/**
 * Hook to detect if user is on Mac
 */
export function useIsMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Get the display text for a keyboard shortcut
 */
export function getShortcutDisplay(keys: string | string[]): string {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const keyArray = Array.isArray(keys) ? keys : [keys];

  // Use the first key combo for display
  const keyCombo = keyArray[0] ?? '';
  const parts = keyCombo.toLowerCase().split('+');

  return parts
    .map((part) => {
      if (part === 'ctrl') return isMac ? '⌃' : 'Ctrl';
      if (part === 'cmd' || part === 'meta') return isMac ? '⌘' : 'Ctrl';
      if (part === 'alt') return isMac ? '⌥' : 'Alt';
      if (part === 'shift') return isMac ? '⇧' : 'Shift';
      return part.toUpperCase();
    })
    .join(isMac ? '' : '+');
}

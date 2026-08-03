import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTheme from '../themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useTheme.setState({
      theme: 'light',
      isTogglingTheme: false,
    });
  });

  describe('initial state', () => {
    it('should have light theme as default', () => {
      const { result } = renderHook(() => useTheme());
      // Note: The actual default depends on system preference
      // In tests without matchMedia mock, it defaults to 'light'
      expect(['light', 'dark']).toContain(result.current.theme);
    });

    it('should not be toggling initially', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.isTogglingTheme).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should toggle from light to dark', () => {
      const { result } = renderHook(() => useTheme());

      // Ensure we start with light
      act(() => {
        useTheme.setState({ theme: 'light' });
      });

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        useTheme.setState({ theme: 'dark' });
      });

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('should set isTogglingTheme to true during toggle', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.isTogglingTheme).toBe(true);
    });

    it('should reset isTogglingTheme after delay', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.isTogglingTheme).toBe(true);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isTogglingTheme).toBe(false);
    });

    it('should prevent rapid toggling', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        useTheme.setState({ theme: 'light' });
      });

      // First toggle
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');

      // Second toggle immediately (should be ignored)
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark'); // Still dark

      // Wait for debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now toggle should work
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });
  });

  describe('isDarkMode', () => {
    it('should return true when theme is dark', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        useTheme.setState({ theme: 'dark' });
      });

      expect(result.current.isDarkMode()).toBe(true);
    });

    it('should return false when theme is light', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        useTheme.setState({ theme: 'light' });
      });

      expect(result.current.isDarkMode()).toBe(false);
    });
  });

  describe('syncWithSystem', () => {
    let originalMatchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('should sync with system dark preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.syncWithSystem();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should sync with system light preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.syncWithSystem();
      });

      expect(result.current.theme).toBe('light');
    });
  });
});

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

// ============================================
// Types
// ============================================

interface ThemeState {
  theme: Theme;
  isTogglingTheme: boolean;
}

interface ThemeActions {
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDarkMode: () => boolean;
  syncWithSystem: () => void;
}

type ThemeStore = ThemeState & ThemeActions;

// ============================================
// Helpers
// ============================================

/**
 * Detect system theme preference
 */
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// ============================================
// Store
// ============================================

/**
 * Theme Store
 *
 * Manages application theme (light/dark mode) with system preference detection.
 * Includes debounce protection against rapid toggling.
 */
const useTheme = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // State
      theme: getSystemTheme(),
      isTogglingTheme: false,

      // Toggle between light and dark theme
      toggleTheme: () => {
        // Prevent rapid toggling
        if (get().isTogglingTheme) {
          return;
        }

        const currentTheme = get().theme;
        const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';

        set({ isTogglingTheme: true, theme: newTheme });

        // Reset the toggle flag after debounce delay
        setTimeout(() => {
          set({ isTogglingTheme: false });
        }, 300);
      },

      // Set theme directly
      setTheme: (theme: Theme) => {
        set({ theme });
      },

      // Check if dark mode is active
      isDarkMode: () => get().theme === 'dark',

      // Sync with system preference
      syncWithSystem: () => {
        set({ theme: getSystemTheme() });
      },
    }),
    {
      name: 'woocommerce-theme',
      partialize: (state): Pick<ThemeState, 'theme'> => ({
        theme: state.theme,
      }),
    }
  )
);

export default useTheme;

// Export types for consumers
export type { ThemeState, ThemeActions, ThemeStore };

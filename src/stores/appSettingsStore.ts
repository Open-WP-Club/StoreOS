import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../utils/i18n';

// ============================================
// Types
// ============================================

export interface AppSettingsState {
  // Language
  language: Language;

  // Printer
  defaultPrinter: string | null;

  // PIN Lock
  pinEnabled: boolean;
  pinCode: string | null; // Stored as hashed value
  pinTimeout: number; // Minutes of inactivity before lock (default 30)
  lastActivity: number | null; // Timestamp of last activity
  isLocked: boolean;

  // App initialization
  isInitialized: boolean;
}

export interface AppSettingsActions {
  // Language
  setLanguage: (language: Language) => void;

  // Printer
  setDefaultPrinter: (printer: string | null) => void;

  // PIN Lock
  setPinEnabled: (enabled: boolean) => void;
  setPinCode: (code: string | null) => void;
  setPinTimeout: (minutes: number) => void;
  updateLastActivity: () => void;
  checkPinTimeout: () => boolean; // Returns true if should be locked
  lock: () => void;
  unlock: () => void;
  verifyPin: (code: string) => boolean;

  // App initialization
  setInitialized: (initialized: boolean) => void;

  // Reset
  resetAppSettings: () => void;
}

export type AppSettingsStore = AppSettingsState & AppSettingsActions;

// ============================================
// Helper Functions
// ============================================

// Simple hash function for PIN (not cryptographically secure, but sufficient for local app)
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// ============================================
// Store
// ============================================

const useAppSettings = create<AppSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      language: 'bg',
      defaultPrinter: null,
      pinEnabled: false,
      pinCode: null,
      pinTimeout: 30, // 30 minutes default
      lastActivity: null,
      isLocked: false,
      isInitialized: false,

      // Language
      setLanguage: (language: Language) => {
        set({ language });
      },

      // Printer
      setDefaultPrinter: (printer: string | null) => {
        set({ defaultPrinter: printer });
      },

      // PIN Lock
      setPinEnabled: (enabled: boolean) => {
        set({ pinEnabled: enabled });
        if (!enabled) {
          set({ pinCode: null, isLocked: false });
        }
      },

      setPinCode: (code: string | null) => {
        set({ pinCode: code ? hashPin(code) : null });
      },

      setPinTimeout: (minutes: number) => {
        set({ pinTimeout: Math.max(1, Math.min(120, minutes)) });
      },

      updateLastActivity: () => {
        set({ lastActivity: Date.now() });
      },

      checkPinTimeout: (): boolean => {
        const state = get();
        if (!state.pinEnabled || !state.pinCode) return false;
        if (!state.lastActivity) return true; // No activity recorded, should lock

        const timeoutMs = state.pinTimeout * 60 * 1000;
        const timeSinceActivity = Date.now() - state.lastActivity;

        if (timeSinceActivity > timeoutMs) {
          set({ isLocked: true });
          return true;
        }
        return false;
      },

      lock: () => {
        const state = get();
        if (state.pinEnabled && state.pinCode) {
          set({ isLocked: true });
        }
      },

      unlock: () => {
        set({ isLocked: false, lastActivity: Date.now() });
      },

      verifyPin: (code: string): boolean => {
        const state = get();
        if (!state.pinCode) return true;
        return hashPin(code) === state.pinCode;
      },

      // App initialization
      setInitialized: (initialized: boolean) => {
        set({ isInitialized: initialized });
      },

      // Reset
      resetAppSettings: () => {
        set({
          language: 'bg',
          defaultPrinter: null,
          pinEnabled: false,
          pinCode: null,
          pinTimeout: 30,
          lastActivity: null,
          isLocked: false,
        });
      },
    }),
    {
      name: 'woocommerce-app-settings',
      partialize: (state): Omit<AppSettingsState, 'isInitialized' | 'isLocked'> => ({
        language: state.language,
        defaultPrinter: state.defaultPrinter,
        pinEnabled: state.pinEnabled,
        pinCode: state.pinCode,
        pinTimeout: state.pinTimeout,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

export default useAppSettings;

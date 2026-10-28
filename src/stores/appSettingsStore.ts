import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../utils/i18n';
import { hashPin, verifyPinHash, isLegacyHash } from '../utils/pinHash';

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
  pinLength: number; // Digits in the PIN; the lock screen auto-submits at this length
  pinTimeout: number; // Minutes of inactivity before lock (default 30)
  lastActivity: number | null; // Timestamp of last activity
  isLocked: boolean;
  failedPinAttempts: number;
  pinLockedUntil: number | null; // epoch ms; verifyPin refuses until then

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
  setPinCode: (code: string | null) => Promise<void>;
  setPinTimeout: (minutes: number) => void;
  updateLastActivity: () => void;
  checkPinTimeout: () => boolean; // Returns true if should be locked
  lock: () => void;
  unlock: () => void;
  /** Throttled: after repeated failures returns false without checking until pinLockedUntil. */
  verifyPin: (code: string) => Promise<boolean>;

  // App initialization
  setInitialized: (initialized: boolean) => void;

  // Reset
  resetAppSettings: () => void;
}

export type AppSettingsStore = AppSettingsState & AppSettingsActions;

// ============================================
// Helper Functions
// ============================================

const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

// 30s after the 5th failure, doubling each further failure, capped at 15 min.
export function lockoutMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(BASE_LOCKOUT_MS * 2 ** (failures - FREE_ATTEMPTS), MAX_LOCKOUT_MS);
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
      pinLength: 4,
      pinTimeout: 30, // 30 minutes default
      lastActivity: null,
      isLocked: false,
      failedPinAttempts: 0,
      pinLockedUntil: null,
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

      setPinCode: async (code: string | null) => {
        set({
          pinCode: code ? await hashPin(code) : null,
          pinLength: code ? code.length : 4,
          failedPinAttempts: 0,
          pinLockedUntil: null,
        });
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

      verifyPin: async (code: string): Promise<boolean> => {
        const { pinCode, pinLockedUntil, failedPinAttempts } = get();
        if (!pinCode) return true;
        if (pinLockedUntil && Date.now() < pinLockedUntil) return false;

        if (await verifyPinHash(code, pinCode)) {
          set({ failedPinAttempts: 0, pinLockedUntil: null });
          // Migrate legacy 32-bit hash to salted PBKDF2 on successful unlock.
          if (isLegacyHash(pinCode)) set({ pinCode: await hashPin(code) });
          return true;
        }
        const failures = failedPinAttempts + 1;
        const wait = lockoutMs(failures);
        set({ failedPinAttempts: failures, pinLockedUntil: wait ? Date.now() + wait : null });
        return false;
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
          pinLength: 4,
          pinTimeout: 30,
          lastActivity: null,
          isLocked: false,
          failedPinAttempts: 0,
          pinLockedUntil: null,
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
        pinLength: state.pinLength,
        pinTimeout: state.pinTimeout,
        lastActivity: state.lastActivity,
        failedPinAttempts: state.failedPinAttempts,
        pinLockedUntil: state.pinLockedUntil,
      }),
    }
  )
);

export default useAppSettings;

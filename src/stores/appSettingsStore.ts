import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../utils/i18n';
import { hashPin, verifyPinHash, isLegacyHash } from '../utils/pinHash';

// ============================================
// Types
// ============================================

export interface NoteTemplate {
  id: string;
  text: string;
}

export interface AppSettingsState {
  // Canned order-note templates
  noteTemplates: NoteTemplate[];

  // Language
  language: Language;

  // Printer
  defaultPrinter: string | null;
  autoPrintReceipt: boolean; // POS: print on checkout
  receiptVatRate: number; // Receipt: VAT % included in prices; 0 hides the VAT line
  openCashDrawer: boolean; // POS: ESC/POS kick with the receipt (needs a named printer)

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
  setAutoPrintReceipt: (v: boolean) => void;
  setReceiptVatRate: (v: number) => void;
  setOpenCashDrawer: (v: boolean) => void;

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

  // Note templates
  addNoteTemplate: (text: string) => void;
  updateNoteTemplate: (id: string, text: string) => void;
  deleteNoteTemplate: (id: string) => void;

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
      autoPrintReceipt: false,
      receiptVatRate: 20,
      openCashDrawer: false,
      pinEnabled: false,
      pinCode: null,
      pinLength: 4,
      pinTimeout: 30, // 30 minutes default
      lastActivity: null,
      isLocked: false,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      isInitialized: false,
      noteTemplates: [],

      addNoteTemplate: (text: string) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({ noteTemplates: [...s.noteTemplates, { id: crypto.randomUUID(), text: t }] }));
      },
      updateNoteTemplate: (id: string, text: string) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          noteTemplates: s.noteTemplates.map((n) => (n.id === id ? { ...n, text: t } : n)),
        }));
      },
      deleteNoteTemplate: (id: string) => {
        set((s) => ({ noteTemplates: s.noteTemplates.filter((n) => n.id !== id) }));
      },

      // Language
      setLanguage: (language: Language) => {
        set({ language });
      },

      // Printer
      setDefaultPrinter: (printer: string | null) => {
        set({ defaultPrinter: printer });
      },
      setAutoPrintReceipt: (v: boolean) => set({ autoPrintReceipt: v }),
      setReceiptVatRate: (v: number) => set({ receiptVatRate: v }),
      setOpenCashDrawer: (v: boolean) => set({ openCashDrawer: v }),

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
          autoPrintReceipt: false,
          receiptVatRate: 20,
          openCashDrawer: false,
          pinEnabled: false,
          pinCode: null,
          pinLength: 4,
          pinTimeout: 30,
          lastActivity: null,
          isLocked: false,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          noteTemplates: [],
        });
      },
    }),
    {
      name: 'woocommerce-app-settings',
      partialize: (state): Omit<AppSettingsState, 'isInitialized' | 'isLocked'> => ({
        language: state.language,
        defaultPrinter: state.defaultPrinter,
        autoPrintReceipt: state.autoPrintReceipt,
        receiptVatRate: state.receiptVatRate,
        openCashDrawer: state.openCashDrawer,
        pinEnabled: state.pinEnabled,
        pinCode: state.pinCode,
        pinLength: state.pinLength,
        pinTimeout: state.pinTimeout,
        lastActivity: state.lastActivity,
        failedPinAttempts: state.failedPinAttempts,
        pinLockedUntil: state.pinLockedUntil,
        noteTemplates: state.noteTemplates,
      }),
    }
  )
);

export default useAppSettings;

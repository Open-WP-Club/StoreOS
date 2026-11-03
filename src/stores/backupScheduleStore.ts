import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BackupScheduleState {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string; // HH:MM
  weekday: number; // 0 = Sunday
  keep: number; // newest N backups retained
  includeProducts: boolean;
  /** Display copy only; the authoritative folder lives in the Electron main process. */
  outputDir: string | null;
  lastRun: number | null; // epoch ms of the last attempted run
  lastResult: { at: number; ok: boolean; message: string } | null;
  /**
   * Session-only (never persisted): without it, scheduled backups carry NO credentials, and
   * with it the credentials are written AES-GCM encrypted. We never store the passphrase.
   */
  passphrase: string;
}

interface BackupScheduleActions {
  update: (patch: Partial<BackupScheduleState>) => void;
}

const useBackupSchedule = create<BackupScheduleState & BackupScheduleActions>()(
  persist(
    (set) => ({
      enabled: false,
      frequency: 'daily',
      time: '03:00',
      weekday: 1,
      keep: 7,
      includeProducts: false,
      outputDir: null,
      lastRun: null,
      lastResult: null,
      passphrase: '',
      update: (patch) =>
        set((s) => ({
          ...patch,
          // Enabling (or changing the schedule) starts the clock now: no retroactive runs.
          ...((patch.enabled && !s.enabled) ||
          patch.time ||
          patch.frequency ||
          patch.weekday != null
            ? { lastRun: Date.now() }
            : {}),
        })),
    }),
    {
      name: 'backup-schedule',
      partialize: ({ update: _update, passphrase: _passphrase, ...state }) => state,
    }
  )
);

export default useBackupSchedule;

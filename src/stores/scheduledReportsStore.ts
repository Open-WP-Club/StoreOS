import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ScheduledReportsState {
  enabled: boolean;
  reportType: 'pos-daily' | 'sales-summary';
  frequency: 'daily' | 'weekly';
  time: string; // HH:MM
  weekday: number; // 0 = Sunday
  format: 'csv' | 'pdf';
  notify: boolean;
  /** Display copy only; the authoritative folder lives in the Electron main process. */
  outputDir: string | null;
  lastRun: number | null; // epoch ms of the last completed run
}

interface ScheduledReportsActions {
  update: (patch: Partial<ScheduledReportsState>) => void;
}

const useScheduledReports = create<ScheduledReportsState & ScheduledReportsActions>()(
  persist(
    (set) => ({
      enabled: false,
      reportType: 'sales-summary',
      frequency: 'daily',
      time: '18:00',
      weekday: 1,
      format: 'csv',
      notify: true,
      outputDir: null,
      lastRun: null,
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
      name: 'scheduled-reports',
      partialize: ({ update: _update, ...state }) => state,
    }
  )
);

export default useScheduledReports;

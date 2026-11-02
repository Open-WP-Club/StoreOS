export interface ReportSchedule {
  frequency: 'daily' | 'weekly';
  /** "HH:MM", 24h local time */
  time: string;
  /** 0 (Sunday) - 6; weekly only */
  weekday: number;
}

const DAY = 24 * 60 * 60 * 1000;

function slotOn(day: Date, time: string): Date {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

/** Most recent scheduled slot at or before `now`. */
export function lastSlot(now: Date, s: ReportSchedule): Date {
  const step = s.frequency === 'weekly' ? 7 : 1;
  const d = slotOn(now, s.time);
  if (s.frequency === 'weekly') d.setDate(d.getDate() - ((d.getDay() - s.weekday + 7) % 7));
  while (d.getTime() > now.getTime()) d.setDate(d.getDate() - step);
  return d;
}

/** First scheduled slot strictly after `now`. */
export function nextRun(now: Date, s: ReportSchedule): Date {
  const d = lastSlot(now, s);
  d.setDate(d.getDate() + (s.frequency === 'weekly' ? 7 : 1));
  return d;
}

/**
 * Due when the latest slot has not been served yet (lastRun before it). Only the latest slot is
 * considered, so any number of missed periods yields a single catch-up run, and a run recorded
 * at/after the slot is never repeated.
 */
export function isDue(now: Date, s: ReportSchedule, lastRun: number | null): boolean {
  if (lastRun == null) return false; // enabling sets lastRun, so past slots never fire retroactively
  return lastRun < lastSlot(now, s).getTime();
}

/** [start, end) window the report for `slot` covers. */
export function reportPeriod(slot: Date, s: ReportSchedule): { start: number; end: number } {
  const end = slot.getTime();
  return { start: end - (s.frequency === 'weekly' ? 7 : 1) * DAY, end };
}

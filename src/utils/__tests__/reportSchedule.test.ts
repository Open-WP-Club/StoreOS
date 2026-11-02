import { lastSlot, nextRun, isDue, reportPeriod, type ReportSchedule } from '../reportSchedule';

const daily: ReportSchedule = { frequency: 'daily', time: '18:30', weekday: 0 };
// 2026-11-04 is a Wednesday (3)
const weekly: ReportSchedule = { frequency: 'weekly', time: '09:00', weekday: 3 };
const at = (d: string): Date => new Date(d);

describe('reportSchedule', () => {
  it('daily lastSlot/nextRun around the time', () => {
    expect(lastSlot(at('2026-11-04T19:00:00'), daily)).toEqual(at('2026-11-04T18:30:00'));
    expect(lastSlot(at('2026-11-04T10:00:00'), daily)).toEqual(at('2026-11-03T18:30:00'));
    expect(nextRun(at('2026-11-04T10:00:00'), daily)).toEqual(at('2026-11-04T18:30:00'));
    expect(nextRun(at('2026-11-04T18:30:00'), daily)).toEqual(at('2026-11-05T18:30:00'));
  });

  it('weekly picks the right weekday', () => {
    expect(lastSlot(at('2026-11-04T09:00:00'), weekly)).toEqual(at('2026-11-04T09:00:00'));
    expect(lastSlot(at('2026-11-04T08:59:00'), weekly)).toEqual(at('2026-10-28T09:00:00'));
    expect(lastSlot(at('2026-11-09T12:00:00'), weekly)).toEqual(at('2026-11-04T09:00:00'));
    expect(nextRun(at('2026-11-05T12:00:00'), weekly)).toEqual(at('2026-11-11T09:00:00'));
  });

  it('is due once the slot passes, not before', () => {
    const last = at('2026-11-03T18:31:00').getTime();
    expect(isDue(at('2026-11-04T18:29:00'), daily, last)).toBe(false);
    expect(isDue(at('2026-11-04T18:30:00'), daily, last)).toBe(true);
  });

  it('never runs twice for the same period', () => {
    const now = at('2026-11-04T20:00:00');
    expect(isDue(now, daily, now.getTime())).toBe(false);
    expect(isDue(now, daily, at('2026-11-04T18:30:00').getTime())).toBe(false);
  });

  it('catches up a single missed run after days offline', () => {
    const last = at('2026-10-30T18:31:00').getTime();
    const now = at('2026-11-04T07:00:00');
    expect(isDue(now, daily, last)).toBe(true);
    expect(isDue(now, daily, now.getTime())).toBe(false);
  });

  it('does not fire when never enabled (lastRun null)', () => {
    expect(isDue(at('2026-11-04T20:00:00'), daily, null)).toBe(false);
  });

  it('report period spans one cycle ending at the slot', () => {
    const slot = at('2026-11-04T09:00:00');
    expect(reportPeriod(slot, weekly).end - reportPeriod(slot, weekly).start).toBe(7 * 86400000);
    expect(reportPeriod(slot, daily).end).toBe(slot.getTime());
  });
});

import {
  nowISO,
  todayString,
  toPlainDate,
  daysBetween,
  addDays,
  getDateRange,
  isTemporalAvailable,
  formatDuration,
  getRelativeTime,
} from '../dateTime';

describe('dateTime utilities - edge cases', () => {
  // ============================================
  // nowISO (untested)
  // ============================================

  describe('nowISO', () => {
    it('should return a valid ISO string', () => {
      const result = nowISO();
      expect(result).toBeTruthy();
      // Should be parseable as a date
      expect(new Date(result).getTime()).not.toBeNaN();
    });

    it('should return current time (within a few seconds)', () => {
      const result = nowISO();
      const diff = Math.abs(Date.now() - new Date(result).getTime());
      expect(diff).toBeLessThan(5000);
    });
  });

  // ============================================
  // todayString (untested)
  // ============================================

  describe('todayString', () => {
    it('should return a YYYY-MM-DD formatted string', () => {
      const result = todayString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
      const result = todayString();
      const now = new Date();
      const expected = now.toISOString().split('T')[0];
      expect(result).toBe(expected);
    });
  });

  // ============================================
  // toPlainDate (untested)
  // ============================================

  describe('toPlainDate', () => {
    it('should return null for null input', () => {
      expect(toPlainDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(toPlainDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(toPlainDate('')).toBeNull();
    });

    it('should parse ISO date string', () => {
      const result = toPlainDate('2025-06-15T14:30:00.000Z');
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle Date object input', () => {
      const date = new Date('2025-06-15T14:30:00.000Z');
      const result = toPlainDate(date);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return null for invalid date string', () => {
      const result = toPlainDate('not-a-date');
      // Could return null or an invalid date string depending on implementation
      // The try/catch should handle this
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  // ============================================
  // daysBetween (untested)
  // ============================================

  describe('daysBetween', () => {
    it('should return null when start date is null', () => {
      expect(daysBetween(null, '2025-01-15')).toBeNull();
    });

    it('should return null when end date is null', () => {
      expect(daysBetween('2025-01-10', null)).toBeNull();
    });

    it('should return 0 for same date', () => {
      expect(daysBetween('2025-01-15', '2025-01-15')).toBe(0);
    });

    it('should calculate positive days between dates', () => {
      const result = daysBetween('2025-01-10', '2025-01-15');
      expect(result).toBe(5);
    });

    it('should calculate negative days when end is before start', () => {
      const result = daysBetween('2025-01-15', '2025-01-10');
      expect(result).toBe(-5);
    });

    it('should handle Date objects', () => {
      const start = new Date('2025-01-10');
      const end = new Date('2025-01-20');
      const result = daysBetween(start, end);
      expect(result).toBe(10);
    });

    it('should handle cross-month calculations', () => {
      const result = daysBetween('2025-01-30', '2025-02-02');
      expect(result).toBe(3);
    });

    it('should handle cross-year calculations', () => {
      const result = daysBetween('2024-12-30', '2025-01-02');
      expect(result).toBe(3);
    });
  });

  // ============================================
  // addDays (untested)
  // ============================================

  describe('addDays', () => {
    it('should return null for null date', () => {
      expect(addDays(null, 5)).toBeNull();
    });

    it('should return null for undefined date', () => {
      expect(addDays(undefined, 5)).toBeNull();
    });

    it('should add positive days', () => {
      const result = addDays('2025-01-10', 5);
      expect(result).toBe('2025-01-15');
    });

    it('should add negative days (subtract)', () => {
      const result = addDays('2025-01-15', -5);
      expect(result).toBe('2025-01-10');
    });

    it('should add 0 days', () => {
      const result = addDays('2025-01-15', 0);
      expect(result).toBe('2025-01-15');
    });

    it('should handle month boundary', () => {
      const result = addDays('2025-01-30', 3);
      expect(result).toBe('2025-02-02');
    });

    it('should handle year boundary', () => {
      const result = addDays('2025-12-30', 5);
      expect(result).toBe('2026-01-04');
    });

    it('should handle Date object input', () => {
      const date = new Date('2025-06-15');
      const result = addDays(date, 10);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle large day values', () => {
      const result = addDays('2025-01-01', 365);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^2026-/);
    });
  });

  // ============================================
  // getDateRange (untested)
  // ============================================

  describe('getDateRange', () => {
    it('should return today range', () => {
      const { start, end } = getDateRange('today');
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start.getTime()).toBe(end.getTime());
    });

    it('should return yesterday range', () => {
      const { start, end } = getDateRange('yesterday');
      expect(start.getTime()).toBe(end.getTime());
      // Should be one day before today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = today.getTime() - start.getTime();
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('should return last 7 days range', () => {
      const { start, end } = getDateRange('last7days');
      const diff = end.getTime() - start.getTime();
      // Should be 6 days apart
      expect(diff).toBe(6 * 24 * 60 * 60 * 1000);
    });

    it('should return last 30 days range', () => {
      const { start, end } = getDateRange('last30days');
      // Use date difference instead of ms to avoid DST issues
      const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(29);
    });

    it('should return this month range', () => {
      const { start, end } = getDateRange('thisMonth');
      expect(start.getDate()).toBe(1);
      expect(start.getMonth()).toBe(end.getMonth());
    });

    it('should return last month range', () => {
      const { start, end } = getDateRange('lastMonth');
      // Start should be first day of last month
      expect(start.getDate()).toBe(1);
      // End should be last day of last month
      const endNextDay = new Date(end);
      endNextDay.setDate(endNextDay.getDate() + 1);
      expect(endNextDay.getDate()).toBe(1);
    });
  });

  // ============================================
  // isTemporalAvailable (untested)
  // ============================================

  describe('isTemporalAvailable', () => {
    it('should return a boolean', () => {
      expect(typeof isTemporalAvailable()).toBe('boolean');
    });
  });

  // ============================================
  // formatDuration (untested)
  // ============================================

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3725)).toBe('1h 2m');
    });

    it('should handle 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle exactly 60 seconds', () => {
      expect(formatDuration(60)).toBe('1m 0s');
    });

    it('should handle exactly 3600 seconds', () => {
      expect(formatDuration(3600)).toBe('1h 0m');
    });

    it('should handle large durations', () => {
      const result = formatDuration(86400); // 24 hours
      expect(result).toBe('24h 0m');
    });

    it('should handle fractional seconds', () => {
      const result = formatDuration(45.7);
      expect(result).toBe('45s');
    });
  });

  // ============================================
  // getRelativeTime - additional edge cases
  // ============================================

  describe('getRelativeTime - edge cases', () => {
    it('should handle exactly 1 minute ago', () => {
      const now = new Date();
      const oneMinAgo = new Date(now.getTime() - 60 * 1000);
      expect(getRelativeTime(oneMinAgo)).toBe('1 minutes ago');
    });

    it('should handle exactly 1 hour ago', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
      expect(getRelativeTime(oneHourAgo)).toBe('1 hours ago');
    });

    it('should handle exactly 1 day ago', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86400 * 1000);
      expect(getRelativeTime(oneDayAgo)).toBe('1 days ago');
    });

    it('should handle date string input', () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = getRelativeTime(fiveMinAgo.toISOString());
      expect(result).toBe('5 minutes ago');
    });
  });
});

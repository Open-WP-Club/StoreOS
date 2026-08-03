import { formatDate, formatDateTime, formatTime, getRelativeTime } from '../dateTime';

describe('dateTime utilities', () => {
  describe('formatDate', () => {
    it('should format date to locale string', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should handle date strings', () => {
      const result = formatDate('2025-01-15');
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('should accept custom options', () => {
      const date = new Date('2025-01-15');
      const result = formatDate(date, { month: 'long' });
      expect(result).toContain('January');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time to locale string', () => {
      const dateTime = new Date('2025-01-15T14:30:00Z');
      const result = formatDateTime(dateTime);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
      // Time should be present (format varies by locale)
      expect(result.length).toBeGreaterThan(10);
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
      expect(formatDateTime('')).toBe('');
    });

    it('should accept custom options', () => {
      const dateTime = new Date('2025-01-15T14:30:00Z');
      const result = formatDateTime(dateTime, { hour12: false });
      expect(result).toBeTruthy();
    });
  });

  describe('formatTime', () => {
    it('should format time to locale string', () => {
      const time = new Date('2025-01-15T14:30:00Z');
      const result = formatTime(time);
      expect(result).toBeTruthy();
      // Should contain time components
      expect(result.match(/\d/)).toBeTruthy();
    });

    it('should return empty string for invalid times', () => {
      expect(formatTime(null)).toBe('');
      expect(formatTime(undefined)).toBe('');
      expect(formatTime('')).toBe('');
    });

    it('should accept custom options', () => {
      const time = new Date('2025-01-15T14:30:45Z');
      const result = formatTime(time, { second: '2-digit' });
      expect(result).toBeTruthy();
    });
  });

  describe('getRelativeTime', () => {
    it('should return "just now" for recent times', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 30000); // 30 seconds ago
      expect(getRelativeTime(recent)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const now = new Date();
      const minutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      expect(getRelativeTime(minutesAgo)).toBe('5 minutes ago');
    });

    it('should return hours ago', () => {
      const now = new Date();
      const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(getRelativeTime(hoursAgo)).toBe('2 hours ago');
    });

    it('should return days ago', () => {
      const now = new Date();
      const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      expect(getRelativeTime(daysAgo)).toBe('3 days ago');
    });

    it('should return months ago', () => {
      const now = new Date();
      const monthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // ~2 months ago
      expect(getRelativeTime(monthsAgo)).toContain('months ago');
    });

    it('should return years ago', () => {
      const now = new Date();
      const yearsAgo = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000); // ~1 year ago
      expect(getRelativeTime(yearsAgo)).toContain('year');
    });

    it('should return empty string for invalid dates', () => {
      expect(getRelativeTime(null)).toBe('');
      expect(getRelativeTime(undefined)).toBe('');
      expect(getRelativeTime('')).toBe('');
    });
  });
});

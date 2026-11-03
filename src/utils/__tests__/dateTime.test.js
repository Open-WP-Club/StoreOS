import { formatDate } from '../dateTime';

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
});

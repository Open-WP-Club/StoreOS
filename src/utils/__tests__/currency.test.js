import { vi } from 'vitest';
import { formatPrice, getCurrencySymbol, formatCurrency, getCurrencyCode } from '../currency';

describe('currency utilities', () => {
  describe('formatPrice', () => {
    it('should format price with currency symbol', () => {
      expect(formatPrice('10.00', '$')).toBe('$10.00');
      expect(formatPrice(25.99, '€')).toBe('€25.99');
    });

    it('should return price without symbol when symbol is not provided', () => {
      expect(formatPrice('10.00')).toBe('10.00');
      expect(formatPrice(25.99)).toBe('25.99');
    });

    it('should handle empty or invalid prices', () => {
      expect(formatPrice(null)).toBe('');
      expect(formatPrice(undefined)).toBe('');
      expect(formatPrice('')).toBe('');
    });

    it('should ignore empty currency symbols', () => {
      expect(formatPrice('10.00', '')).toBe('10.00');
      expect(formatPrice('10.00', '   ')).toBe('10.00');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should extract currency symbol from data', () => {
      const data = { currency_symbol: '$' };
      expect(getCurrencySymbol(data)).toBe('$');
    });

    it('should return null when no symbol is found', () => {
      expect(getCurrencySymbol(null)).toBeNull();
      expect(getCurrencySymbol({})).toBeNull();
      expect(getCurrencySymbol({ currency: 'USD' })).toBeNull();
    });

    it('should ignore empty currency symbols', () => {
      expect(getCurrencySymbol({ currency_symbol: '' })).toBeNull();
      expect(getCurrencySymbol({ currency_symbol: '   ' })).toBeNull();
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with Intl.NumberFormat', () => {
      const result = formatCurrency(100, 'USD', 'en-US');
      expect(result).toContain('100');
      expect(result).toMatch(/\$/);
    });

    it('should handle different currencies', () => {
      const usd = formatCurrency(100, 'USD', 'en-US');
      const eur = formatCurrency(100, 'EUR', 'en-US');
      expect(usd).not.toBe(eur);
    });

    it('should extract currency from data object', () => {
      const data = { currency: 'GBP' };
      const result = formatCurrency(50, data, 'en-US');
      expect(result).toContain('50');
    });

    it('should handle invalid amounts', () => {
      expect(formatCurrency(null)).toBe('');
      expect(formatCurrency(undefined)).toBe('');
      expect(formatCurrency('')).toBe('');
    });

    it('should convert string amounts to numbers', () => {
      const result = formatCurrency('100.50', 'USD', 'en-US');
      expect(result).toContain('100.50');
    });

    it('should fallback to USD on invalid currency code', () => {
      // Mock console.warn to avoid cluttering test output
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const result = formatCurrency(100, 'INVALID', 'en-US');
      expect(result).toContain('100');
      warnSpy.mockRestore();
    });
  });

  describe('getCurrencyCode', () => {
    it('should extract currency code from object', () => {
      const data = { currency: 'EUR' };
      expect(getCurrencyCode(data)).toBe('EUR');
    });

    it('should extract currency from first item in array', () => {
      const data = [{ currency: 'GBP' }, { currency: 'USD' }];
      expect(getCurrencyCode(data)).toBe('GBP');
    });

    it('should return USD as fallback', () => {
      expect(getCurrencyCode(null)).toBe('USD');
      expect(getCurrencyCode({})).toBe('USD');
      expect(getCurrencyCode([])).toBe('USD');
    });
  });
});

import { formatPrice, getCurrencySymbol, formatCurrency, getCurrencyCode } from '../currency';

describe('currency utilities - edge cases', () => {
  describe('formatPrice - edge cases', () => {
    it('should handle zero price', () => {
      expect(formatPrice(0, '$')).toBe('$0');
    });

    it('should handle negative prices', () => {
      expect(formatPrice(-10.5, '$')).toBe('$-10.5');
    });

    it('should handle NaN', () => {
      expect(formatPrice(NaN, '$')).toBe('$NaN');
    });

    it('should handle very large numbers', () => {
      expect(formatPrice(999999999.99, '$')).toBe('$999999999.99');
    });

    it('should handle numeric string "0"', () => {
      expect(formatPrice('0', '$')).toBe('$0');
    });

    it('should handle boolean-like values as price', () => {
      expect(formatPrice(false)).toBe('false');
      expect(formatPrice(true)).toBe('true');
    });

    it('should handle null currency symbol explicitly', () => {
      expect(formatPrice('10.00', null)).toBe('10.00');
    });
  });

  describe('getCurrencySymbol - edge cases', () => {
    it('should return null for undefined input', () => {
      expect(getCurrencySymbol(undefined)).toBeNull();
    });

    it('should prefer currency_symbol over currency', () => {
      const data = { currency: 'USD', currency_symbol: '€' };
      expect(getCurrencySymbol(data)).toBe('€');
    });

    it('should return null when currency code exists but no symbol', () => {
      expect(getCurrencySymbol({ currency: 'BGN' })).toBeNull();
    });

    it('should handle empty object', () => {
      expect(getCurrencySymbol({})).toBeNull();
    });

    it('should handle object with only whitespace values', () => {
      expect(getCurrencySymbol({ currency_symbol: '  ', currency: '  ' })).toBeNull();
    });
  });

  describe('formatCurrency - edge cases', () => {
    it('should handle NaN amount', () => {
      const result = formatCurrency(NaN, 'USD', 'en-US');
      expect(result).toContain('NaN');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-50, 'USD', 'en-US');
      expect(result).toMatch(/-/);
      expect(result).toContain('50');
    });

    it('should handle string amount with non-numeric value', () => {
      const result = formatCurrency('abc', 'USD', 'en-US');
      expect(result).toContain('NaN');
    });

    it('should use USD default when currencyOrData is null', () => {
      const result = formatCurrency(100, null, 'en-US');
      expect(result).toContain('100');
      expect(result).toMatch(/\$/);
    });

    it('should use USD default when currencyOrData is empty string', () => {
      const result = formatCurrency(100, '', 'en-US');
      expect(result).toContain('100');
    });

    it('should handle data object without currency field', () => {
      const result = formatCurrency(100, { currency_symbol: '$' }, 'en-US');
      // Falls back to USD since no currency field
      expect(result).toContain('100');
    });

    it('should handle zero amount', () => {
      const result = formatCurrency(0, 'USD', 'en-US');
      expect(result).toContain('0');
    });

    it('should handle very small amounts', () => {
      const result = formatCurrency(0.01, 'USD', 'en-US');
      expect(result).toContain('0.01');
    });

    it('should fall back to USD for invalid currency code', () => {
      const result = formatCurrency(100, 'XXXINVALID', 'en-US');
      // Should not throw, falls back to USD
      expect(result).toContain('100');
    });
  });

  describe('getCurrencyCode - edge cases', () => {
    it('should return USD for undefined', () => {
      expect(getCurrencyCode(undefined)).toBe('USD');
    });

    it('should return USD for empty array', () => {
      expect(getCurrencyCode([])).toBe('USD');
    });

    it('should extract from first element of array', () => {
      expect(getCurrencyCode([{ currency: 'EUR' }, { currency: 'GBP' }])).toBe('EUR');
    });

    it('should return USD when currency is not a string', () => {
      expect(getCurrencyCode({ currency: 123 })).toBe('USD');
    });

    it('should return USD when currency is empty string', () => {
      expect(getCurrencyCode({ currency: '' })).toBe('USD');
    });

    it('should return USD when currency is null', () => {
      expect(getCurrencyCode({ currency: null })).toBe('USD');
    });

    it('should handle array with first item missing currency', () => {
      expect(getCurrencyCode([{}, { currency: 'GBP' }])).toBe('USD');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob } from '../csvExport';
import { storeCurrencySymbol } from '../currency';

describe('downloadBlob', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('clicks a temporary link and cleans up', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadBlob('a,b', 'text/csv', 'f.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('storeCurrencySymbol', () => {
  it('returns symbol or empty string', () => {
    expect(storeCurrencySymbol({ currencySymbol: '€' })).toBe('€');
    expect(storeCurrencySymbol({})).toBe('');
    expect(storeCurrencySymbol(null)).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import {
  CODE128_PATTERNS,
  code128Values,
  code128Modules,
  code128Svg,
  renderLabelsHtml,
  LABEL_SIZES,
} from '../barcodeLabel';

describe('code128', () => {
  it('has 107 patterns with correct module sums', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const sum = [...p].reduce((a, c) => a + Number(c), 0);
      expect(sum).toBe(i === 106 ? 13 : 11);
    });
  });
  it('computes known checksums', () => {
    expect(code128Values('A')).toEqual([104, 33, 34, 106]);
    // Wikipedia example "PJJ123C": is 54 with start A; start B shifts it by one
    expect(code128Values('PJJ123C')?.at(-2)).toBe(55);
  });
  it('rejects non-ASCII and empty', () => {
    expect(code128Values('Ж1')).toBeNull();
    expect(code128Values('')).toBeNull();
    expect(code128Svg('Ж')).toBe('');
  });
  it('total width is 11 per symbol plus stop', () => {
    const m = code128Modules('AB') as number[];
    expect(m.reduce((a, b) => a + b, 0)).toBe(11 * 4 + 13);
  });
});

describe('renderLabelsHtml', () => {
  const opts = {
    size: LABEL_SIZES[0]!,
    showName: true,
    showPrice: true,
    showSku: true,
    copies: 2,
    currencySymbol: '$',
  };
  it('escapes text and repeats copies', () => {
    const html = renderLabelsHtml([{ name: '<img onerror=x>', sku: 'A1', price: '5' }], opts);
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img');
    expect(html.match(/class="l"/g)).toHaveLength(2);
    expect(html).toContain('<svg');
  });
  it('A4 uses grid', () => {
    const html = renderLabelsHtml([{ name: 'x', sku: '', price: '' }], {
      ...opts,
      size: LABEL_SIZES[3]!,
    });
    expect(html).toContain('grid-template-columns:repeat(3,70mm)');
  });
});

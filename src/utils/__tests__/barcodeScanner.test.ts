import { describe, it, expect } from 'vitest';
import {
  createBurstDetector,
  findProductByCode,
  isTextEntryTarget,
  countDifferences,
} from '../barcodeScanner';
import { createMockProduct } from '../../__test_utils__';

const feed = (
  detect: ReturnType<typeof createBurstDetector>,
  chars: string,
  start: number,
  gap: number
): { out: string | null; t: number } => {
  let t = start;
  for (const c of chars) {
    detect(c, t);
    t += gap;
  }
  return { out: detect('Enter', t), t };
};

describe('createBurstDetector', () => {
  it('emits a fast burst ended by Enter', () => {
    expect(feed(createBurstDetector(), '5901234123457', 1000, 5).out).toBe('5901234123457');
  });

  it('ignores slow typing and short bursts', () => {
    expect(feed(createBurstDetector(), '5901234', 1000, 120).out).toBeNull();
    expect(feed(createBurstDetector(), '123', 1000, 5).out).toBeNull();
  });

  it('a pause mid-way restarts the buffer', () => {
    const d = createBurstDetector();
    'abcd'.split('').forEach((c, i) => d(c, 1000 + i * 5)); // slow, aborted
    expect(feed(d, 'XYZ12', 5000, 5).out).toBe('XYZ12');
  });

  it('does not emit twice for one burst', () => {
    const d = createBurstDetector();
    const { t } = feed(d, '12345', 0, 5);
    expect(d('Enter', t + 5)).toBeNull();
  });
});

describe('isTextEntryTarget', () => {
  it('flags text inputs but not buttons or the body', () => {
    const input = document.createElement('input');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTextEntryTarget(input)).toBe(true);
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextEntryTarget(checkbox)).toBe(false);
    expect(isTextEntryTarget(document.body)).toBe(false);
  });
});

describe('findProductByCode', () => {
  const products = [
    createMockProduct({ id: 1, sku: 'ABC-1' }),
    createMockProduct({
      id: 2,
      sku: '',
      meta_data: [{ id: 1, key: '_barcode', value: '4006381333931' }],
    }),
  ];
  it('matches SKU case-insensitively and barcode meta', () => {
    expect(findProductByCode(products, 'abc-1')?.id).toBe(1);
    expect(findProductByCode(products, '4006381333931')?.id).toBe(2);
    expect(findProductByCode(products, 'nope')).toBeUndefined();
    expect(findProductByCode(products, '')).toBeUndefined();
  });
});

describe('countDifferences', () => {
  it('keeps only changed rows', () => {
    expect(
      countDifferences([
        { productId: 1, system: 5, counted: 5 },
        { productId: 2, system: 5, counted: 3 },
      ])
    ).toEqual([{ productId: 2, system: 5, counted: 3, diff: -2 }]);
  });
});

import { describe, it, expect } from 'vitest';
import { isStockAtOrBelow } from '../stock';

describe('isStockAtOrBelow', () => {
  it('is inclusive and ignores unknown stock', () => {
    expect(isStockAtOrBelow(5, 5)).toBe(true);
    expect(isStockAtOrBelow(6, 5)).toBe(false);
    expect(isStockAtOrBelow(null, 5)).toBe(false);
    expect(isStockAtOrBelow(undefined, 5)).toBe(false);
  });
});
